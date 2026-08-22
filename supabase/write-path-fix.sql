-- Run in Supabase Dashboard > SQL Editor AFTER workflow-migration.sql.
--
-- The bug: an editor's progress change (and their final video link, and a
-- client's own edits) saved without error and then reverted.
--
-- The cause: PostgreSQL applies SELECT policies to the WHERE clause of an
-- UPDATE, not just to reads. security-hardening-migration.sql replaced the
-- projects SELECT policy with an admin-only one, so for anybody who is not an
-- admin, `update projects ... where id = '...'` matches zero rows. Row security
-- skips the row silently, PostgREST answers 204, and the UI shows the old value
-- again. Admin writes kept working because admins still hold a SELECT policy.
--
-- The fix: do NOT hand SELECT back to editors and clients — that would undo the
-- column leaks that migration closed (editors reading client contact details
-- and pricing, clients reading admin_notes). Route their writes through
-- SECURITY DEFINER functions instead. The BEFORE UPDATE guard still runs and
-- still decides what each role may actually change; auth.uid() is a session
-- setting, so it is unaffected by the definer context.
--
-- Idempotent; safe to run twice.

-- ---------------------------------------------------------------------------
-- 1. Editor: own progress stage
-- ---------------------------------------------------------------------------

create or replace function public.set_editor_stage(p_id uuid, p_stage text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  saved text;
begin
  if p_stage not in ('received', 'downloaded', 'working', 'complete') then
    raise exception 'Unknown progress stage.';
  end if;
  if not public.is_editor() then
    raise exception 'Only an editor can update progress.';
  end if;

  update public.projects
  set editor_stage = p_stage
  where id = p_id and assigned_editor_id = (select auth.uid())
  returning editor_stage into saved;

  if saved is null then
    raise exception 'That project is not assigned to you.';
  end if;
  return saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Editor: final video link
-- ---------------------------------------------------------------------------

create or replace function public.set_final_video_link(p_id uuid, p_link text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  cleaned text := nullif(btrim(coalesce(p_link, '')), '');
  saved uuid;
begin
  if not public.is_editor() then
    raise exception 'Only an editor can deliver a final video link.';
  end if;
  if cleaned is not null and (cleaned !~* '^https?://' or length(cleaned) > 2048) then
    raise exception 'Enter a link that starts with http:// or https:// and is under 2048 characters.';
  end if;

  update public.projects
  set final_video_link = cleaned
  where id = p_id and assigned_editor_id = (select auth.uid())
  returning id into saved;

  if saved is null then
    raise exception 'That project is not assigned to you.';
  end if;
  return cleaned;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Client: edit their own project while it is still pre-production
--    Only the keys listed here are read out of the patch; anything else the
--    caller sends is ignored, and the update guard enforces the rest.
-- ---------------------------------------------------------------------------

create or replace function public.update_my_project(p_id uuid, p_patch jsonb)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  saved uuid;
begin
  update public.projects set
    project_name    = case when p_patch ? 'project_name'    then nullif(p_patch ->> 'project_name', '')    else project_name end,
    phone           = case when p_patch ? 'phone'           then nullif(p_patch ->> 'phone', '')           else phone end,
    company         = case when p_patch ? 'company'         then nullif(p_patch ->> 'company', '')         else company end,
    format          = case when p_patch ? 'format'          then nullif(p_patch ->> 'format', '')          else format end,
    aimed_length    = case when p_patch ? 'aimed_length'    then nullif(p_patch ->> 'aimed_length', '')::integer else aimed_length end,
    color_profile   = case when p_patch ? 'color_profile'   then nullif(p_patch ->> 'color_profile', '')   else color_profile end,
    preferred_music = case when p_patch ? 'preferred_music' then nullif(p_patch ->> 'preferred_music', '') else preferred_music end,
    footage_link    = case when p_patch ? 'footage_link'    then nullif(p_patch ->> 'footage_link', '')    else footage_link end,
    reference_link  = case when p_patch ? 'reference_link'  then nullif(p_patch ->> 'reference_link', '')  else reference_link end,
    creative_notes  = case when p_patch ? 'creative_notes'  then nullif(p_patch ->> 'creative_notes', '')  else creative_notes end
  where id = p_id and client_id = (select auth.uid())
  returning id into saved;

  if saved is null then
    raise exception 'That project is not yours to edit.';
  end if;
  return saved;
end;
$$;

grant execute on function public.set_editor_stage(uuid, text) to authenticated;
grant execute on function public.set_final_video_link(uuid, text) to authenticated;
grant execute on function public.update_my_project(uuid, jsonb) to authenticated;
