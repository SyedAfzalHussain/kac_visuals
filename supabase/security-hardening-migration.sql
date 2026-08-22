-- Run in Supabase Dashboard > SQL Editor AFTER editor-features-migration.sql.
--
-- Fixes:
--   1. A demoted editor kept write access to projects still assigned to them.
--   2. Editors could read client contact details, pricing and admin notes over the
--      API (the UI hid them, the payload did not).
--   3. Clients could read internal admin notes through the edit history.
--   4. Nothing validated INSERTs — a guest could set status, payment, serial
--      number, admin notes, the final video link, or assign themselves an editor.

-- ---------------------------------------------------------------------------
-- 1. Editor access now requires the editor role, not just an assignment
-- ---------------------------------------------------------------------------

-- Direct row access is withdrawn; editors read through the column-limited view.
drop policy if exists "Editors view assigned projects" on public.projects;

drop policy if exists "Editors update assigned projects" on public.projects;
create policy "Editors update assigned projects"
on public.projects for update to authenticated
using (assigned_editor_id = (select auth.uid()) and public.is_editor())
with check (assigned_editor_id = (select auth.uid()) and public.is_editor());

create or replace function public.guard_project_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  submitted_link text;
begin
  new.updated_at := now();

  if public.is_admin() then
    return new;
  end if;

  -- Assigned editor: may change the final video link and nothing else.
  -- The role check matters — an assignment alone must not grant write access
  -- once the person has been demoted.
  if old.assigned_editor_id is not null
     and old.assigned_editor_id = (select auth.uid())
     and public.is_editor() then
    submitted_link := new.final_video_link;
    new := old;
    new.final_video_link := submitted_link;
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

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Editors read a brief-only view (no client contact, no pricing)
-- ---------------------------------------------------------------------------

drop view if exists public.editor_assignments;
create view public.editor_assignments as
select
  p.id, p.serial_number, p.project_name, p.service_name, p.project_number,
  p.format, p.aimed_length, p.color_profile, p.preferred_music,
  p.ai_addon_scenes, p.footage_link, p.reference_link, p.creative_notes,
  p.final_video_link, p.status, p.services, p.created_at, p.is_custom
from public.projects p
where p.assigned_editor_id = (select auth.uid())
  and public.is_editor();

-- The view runs with the owner's rights, so it bypasses row security on
-- projects; its WHERE clause is what restricts each caller to their own work.
alter view public.editor_assignments set (security_invoker = false);
grant select on public.editor_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Clients read a view too — `select *` was returning admin_notes to them
-- ---------------------------------------------------------------------------

drop view if exists public.my_projects;
create view public.my_projects as
select
  p.id, p.client_id, p.serial_number, p.submission_id, p.project_number,
  p.client_name, p.client_email, p.phone, p.company,
  p.project_name, p.service_id, p.service_name, p.services,
  p.format, p.aimed_length, p.color_profile, p.preferred_music,
  p.footage_link, p.reference_link, p.creative_notes, p.final_video_link,
  p.ai_addon_scenes, p.ai_addon_price, p.unit_price, p.estimated_total,
  p.client_budget, p.is_custom, p.status, p.payment_status,
  p.created_at, p.updated_at
from public.projects p
where p.client_id = (select auth.uid());

alter view public.my_projects set (security_invoker = false);
grant select on public.my_projects to authenticated;

-- Direct row reads are now admin-only; clients go through my_projects, editors
-- through editor_assignments. Updates are unaffected (they need no SELECT).
drop policy if exists "Clients view own projects, admins view all" on public.projects;
drop policy if exists "Admins view all projects" on public.projects;
create policy "Admins view all projects"
on public.projects for select to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Internal admin notes stay out of the client-visible edit history
-- ---------------------------------------------------------------------------

-- Row security applies inside policy expressions too, and clients no longer
-- have SELECT on projects — so the ownership test must run as definer or the
-- history would come back empty for every client.
create or replace function public.owns_project(p_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists(
    select 1 from public.projects
    where id = p_id and client_id = (select auth.uid())
  );
$$;

grant execute on function public.owns_project(uuid) to authenticated;

drop policy if exists "Clients view own edits, admins view all" on public.project_edits;
create policy "Clients view own edits, admins view all"
on public.project_edits for select to authenticated
using (
  public.is_admin()
  or (field <> 'admin_notes' and public.owns_project(project_edits.project_id))
);

-- ---------------------------------------------------------------------------
-- 4. Validate INSERTs: server owns the workflow columns
-- ---------------------------------------------------------------------------

alter table public.projects alter column serial_number drop default;

create or replace function public.guard_project_insert()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.created_at := now();
  new.updated_at := now();

  -- Serial numbers are issued by the server, never accepted from the client.
  if new.serial_number is null or not public.is_admin() then
    new.serial_number := nextval('public.projects_serial_seq');
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Anything a client or guest must not be able to choose for themselves.
  new.assigned_editor_id := null;
  new.assigned_editor_name := null;
  new.final_video_link := null;
  new.admin_notes := null;
  new.status := 'submitted';
  new.payment_status := 'unpaid';

  return new;
end;
$$;

drop trigger if exists a_guard_project_insert on public.projects;
create trigger a_guard_project_insert
before insert on public.projects
for each row execute procedure public.guard_project_insert();

-- ---------------------------------------------------------------------------
-- 5. Demoting an editor releases their assignments
-- ---------------------------------------------------------------------------

create or replace function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can change roles.';
  end if;
  if p_role not in ('client', 'editor', 'admin') then
    raise exception 'Invalid role.';
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_user;

  -- No longer an editor: hand their projects back to the unassigned pool so a
  -- stale assignment can never be mistaken for continued access.
  if p_role <> 'editor' then
    update public.projects
    set assigned_editor_id = null, assigned_editor_name = null
    where assigned_editor_id = p_user;
  end if;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;
