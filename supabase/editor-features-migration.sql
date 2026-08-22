-- Run this in Supabase Dashboard > SQL Editor AFTER admin-features-migration.sql.
-- Adds: editor role + project assignment, custom-project flag, client-entered budget.

-- ---------------------------------------------------------------------------
-- STOP if this database has already run workflow-migration.sql.
-- This file carries an older copy of guard_project_update(). Re-running it
-- afterwards silently reverts that trigger to a body which discards
-- editor_stage, so an editor's progress change saves and then reappears as
-- "Received". workflow-migration.sql owns the current body and is idempotent —
-- run that instead. The check below stops this file rather than let it happen.
-- ---------------------------------------------------------------------------
do $guard$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'editor_stage'
  ) then
    raise exception 'Superseded: this database is already past this migration. Run supabase/workflow-migration.sql instead.';
  end if;
end
$guard$;


-- ---------------------------------------------------------------------------
-- 1. Columns and role
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('client', 'admin', 'editor'));

alter table public.projects add column if not exists assigned_editor_id uuid references auth.users(id) on delete set null;
alter table public.projects add column if not exists assigned_editor_name text;
alter table public.projects add column if not exists is_custom boolean not null default false;
alter table public.projects add column if not exists client_budget numeric(10,2);

alter table public.projects drop constraint if exists projects_client_budget_check;
alter table public.projects add constraint projects_client_budget_check
  check (client_budget is null or (client_budget >= 0 and client_budget <= 1000000));

create index if not exists projects_assigned_editor_idx on public.projects(assigned_editor_id);
create index if not exists projects_is_custom_idx on public.projects(is_custom);

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'editor');
$$;

-- Role changes go through this function only. The `role` column is never
-- granted to `authenticated`, so a client cannot promote themselves.
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
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Update guard: admin > assigned editor > client
-- ---------------------------------------------------------------------------

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

  -- The assigned editor may change the final video link and nothing else.
  if old.assigned_editor_id is not null
     and old.assigned_editor_id = (select auth.uid()) then
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

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Row level security for editors
-- ---------------------------------------------------------------------------

drop policy if exists "Editors view assigned projects" on public.projects;
create policy "Editors view assigned projects"
on public.projects for select to authenticated
using (assigned_editor_id = (select auth.uid()));

drop policy if exists "Editors update assigned projects" on public.projects;
create policy "Editors update assigned projects"
on public.projects for update to authenticated
using (assigned_editor_id = (select auth.uid()))
with check (assigned_editor_id = (select auth.uid()));

grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.is_editor() to authenticated;
