-- Run in Supabase Dashboard > SQL Editor AFTER security-hardening-migration.sql.
--
-- Adds:
--   1. priority           -- admin sets it; admin + editor see it, clients never do
--   2. editor_stage       -- the editor's own progress: received > downloaded >
--                            working > complete
--   3. admin_stage        -- the admin's internal progress, including the two
--                            revision states
--   4. final_link_released -- the final video stays between admin and editor
--                            until the admin explicitly releases it, which is
--                            only possible once admin_stage is 'completed'
--
-- All of it is idempotent; running it twice is safe.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists priority text not null default 'normal',
  add column if not exists editor_stage text not null default 'received',
  add column if not exists admin_stage text not null default 'added',
  add column if not exists final_link_released boolean not null default false,
  add column if not exists final_link_released_at timestamptz;

alter table public.projects drop constraint if exists projects_priority_check;
alter table public.projects add constraint projects_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.projects drop constraint if exists projects_editor_stage_check;
alter table public.projects add constraint projects_editor_stage_check
  check (editor_stage in ('received', 'downloaded', 'working', 'complete'));

alter table public.projects drop constraint if exists projects_admin_stage_check;
alter table public.projects add constraint projects_admin_stage_check
  check (admin_stage in ('added', 'in_progress', 'completed', 'needs_revision_admin', 'needs_revision_client'));

-- Anything already delivered stays visible to the client it was delivered to.
-- The update guard rejects writes from a session with no auth.uid() (which is
-- what the SQL Editor is), and the edit log would record a change nobody made,
-- so both triggers step aside for this one backfill.
alter table public.projects disable trigger a_guard_project_update;
alter table public.projects disable trigger b_log_project_edit;

update public.projects
set final_link_released = true, final_link_released_at = coalesce(updated_at, now())
where final_video_link is not null and final_link_released = false;

alter table public.projects enable trigger a_guard_project_update;
alter table public.projects enable trigger b_log_project_edit;

-- ---------------------------------------------------------------------------
-- 2. Editors see priority and both stages; they still never see the client
-- ---------------------------------------------------------------------------

drop view if exists public.editor_assignments;
create view public.editor_assignments as
select
  p.id, p.serial_number, p.project_name, p.service_name, p.project_number,
  p.format, p.aimed_length, p.color_profile, p.preferred_music,
  p.ai_addon_scenes, p.footage_link, p.reference_link, p.creative_notes,
  p.final_video_link, p.status, p.services, p.created_at, p.is_custom,
  p.priority, p.editor_stage, p.admin_stage, p.final_link_released
from public.projects p
where p.assigned_editor_id = (select auth.uid())
  and public.is_editor();

alter view public.editor_assignments set (security_invoker = false);
grant select on public.editor_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Clients: no priority, no stages, and no final link until it is released
-- ---------------------------------------------------------------------------

drop view if exists public.my_projects;
create view public.my_projects as
select
  p.id, p.client_id, p.serial_number, p.submission_id, p.project_number,
  p.client_name, p.client_email, p.phone, p.company,
  p.project_name, p.service_id, p.service_name, p.services,
  p.format, p.aimed_length, p.color_profile, p.preferred_music,
  p.footage_link, p.reference_link, p.creative_notes,
  case when p.final_link_released then p.final_video_link end as final_video_link,
  p.final_link_released, p.final_link_released_at,
  p.ai_addon_scenes, p.ai_addon_price, p.unit_price, p.estimated_total,
  p.client_budget, p.is_custom, p.status, p.payment_status,
  p.created_at, p.updated_at
from public.projects p
where p.client_id = (select auth.uid());

alter view public.my_projects set (security_invoker = false);
grant select on public.my_projects to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Write rules
-- ---------------------------------------------------------------------------

create or replace function public.guard_project_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  submitted_link text;
  submitted_stage text;
begin
  new.updated_at := now();

  if public.is_admin() then
    -- Releasing the final video to the client is a deliberate, separate act,
    -- and only makes sense once the work is finished.
    if new.final_link_released and not old.final_link_released then
      if new.admin_stage is distinct from 'completed' then
        raise exception 'Set the admin stage to Completed before releasing the final video to the client.';
      end if;
      new.final_link_released_at := now();
    elsif old.final_link_released and not new.final_link_released then
      new.final_link_released_at := null;
    end if;
    return new;
  end if;

  -- Assigned editor: may change the final video link and their own stage.
  -- The role check matters — an assignment alone must not grant write access
  -- once the person has been demoted.
  if old.assigned_editor_id is not null
     and old.assigned_editor_id = (select auth.uid())
     and public.is_editor() then
    submitted_link := new.final_video_link;
    submitted_stage := new.editor_stage;
    new := old;
    new.final_video_link := submitted_link;
    new.editor_stage := submitted_stage;
    new.updated_at := now();
    return new;
  end if;

  if old.client_id is null or old.client_id is distinct from (select auth.uid()) then
    raise exception 'You can only edit your own projects.';
  end if;

  if old.status not in ('submitted', 'reviewing', 'awaiting_files') then
    raise exception 'This project has already moved into production and can no longer be edited.';
  end if;

  new.id := old.id;
  new.client_id := old.client_id;
  new.serial_number := old.serial_number;
  new.submission_id := old.submission_id;
  new.created_at := old.created_at;
  new.status := old.status;
  new.payment_status := old.payment_status;
  new.admin_notes := old.admin_notes;
  new.final_video_link := old.final_video_link;
  new.estimated_total := old.estimated_total;
  new.unit_price := old.unit_price;
  new.ai_addon_price := old.ai_addon_price;
  new.services := old.services;
  new.assigned_editor_id := old.assigned_editor_id;
  new.assigned_editor_name := old.assigned_editor_name;
  new.is_custom := old.is_custom;
  new.client_budget := old.client_budget;
  new.priority := old.priority;
  new.editor_stage := old.editor_stage;
  new.admin_stage := old.admin_stage;
  new.final_link_released := old.final_link_released;
  new.final_link_released_at := old.final_link_released_at;

  return new;
end;
$$;

create or replace function public.guard_project_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.created_at := now();
  new.updated_at := now();

  if new.serial_number is null or not public.is_admin() then
    new.serial_number := nextval('public.projects_serial_seq');
  end if;

  if public.is_admin() then
    return new;
  end if;

  new.assigned_editor_id := null;
  new.assigned_editor_name := null;
  new.final_video_link := null;
  new.admin_notes := null;
  new.status := 'submitted';
  new.payment_status := 'unpaid';
  new.priority := 'normal';
  new.editor_stage := 'received';
  new.admin_stage := 'added';
  new.final_link_released := false;
  new.final_link_released_at := null;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. History: track the new fields, keep the internal ones off the client view
-- ---------------------------------------------------------------------------

create or replace function public.log_project_edit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_name text;
  actor_role text;
  old_json jsonb := to_jsonb(old);
  new_json jsonb := to_jsonb(new);
  tracked text[] := array[
    'project_name', 'status', 'payment_status', 'final_video_link', 'creative_notes',
    'admin_notes', 'format', 'preferred_music', 'footage_link', 'reference_link',
    'aimed_length', 'color_profile', 'estimated_total', 'unit_price', 'phone',
    'company', 'client_name', 'client_email', 'service_name', 'ai_addon_scenes',
    'priority', 'editor_stage', 'admin_stage', 'final_link_released'
  ];
  col text;
begin
  select full_name, role into actor_name, actor_role from public.profiles where id = actor;

  foreach col in array tracked loop
    if (old_json ->> col) is distinct from (new_json ->> col) then
      insert into public.project_edits (project_id, field, old_value, new_value, edited_by, edited_by_name, edited_by_role)
      values (new.id, col, old_json ->> col, new_json ->> col, actor, actor_name, coalesce(actor_role, 'client'));
    end if;
  end loop;

  return new;
end;
$$;

-- The client history must not leak internal workflow chatter. The final video
-- link is withheld until it is released, so its history stays internal too.
drop policy if exists "Clients view own edits, admins view all" on public.project_edits;
create policy "Clients view own edits, admins view all"
on public.project_edits for select to authenticated
using (
  public.is_admin()
  or (
    field not in ('admin_notes', 'priority', 'editor_stage', 'admin_stage',
                  'final_link_released', 'final_video_link')
    and public.owns_project(project_edits.project_id)
  )
);

-- ---------------------------------------------------------------------------
-- 6. Re-assert the editor write path
--    The older migrations own these policies, and they are now guarded against
--    being re-run — so this file has to be able to restore them on its own.
-- ---------------------------------------------------------------------------

drop policy if exists "Editors update assigned projects" on public.projects;
create policy "Editors update assigned projects"
on public.projects for update to authenticated
using (assigned_editor_id = (select auth.uid()) and public.is_editor())
with check (assigned_editor_id = (select auth.uid()) and public.is_editor());

grant update on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Diagnostic — run separately if an editor still cannot save
--    Expect one row per policy: "Editors update assigned projects" must appear.
-- ---------------------------------------------------------------------------

-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'projects' order by policyname;
