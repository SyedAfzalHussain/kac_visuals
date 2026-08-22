-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- Adds: serial numbers, final video link, edit history, client edit window,
-- admin delete with an archived backup copy.

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
-- 1. New columns
-- ---------------------------------------------------------------------------

alter table public.projects add column if not exists final_video_link text;
alter table public.projects add column if not exists serial_number integer;

create sequence if not exists public.projects_serial_seq;

-- Give existing rows a number in submission order before the default kicks in.
with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.projects
  where serial_number is null
)
update public.projects p
set serial_number = o.rn
from ordered o
where p.id = o.id;

select setval(
  'public.projects_serial_seq',
  coalesce((select max(serial_number) from public.projects), 0) + 1,
  false
);

alter table public.projects alter column serial_number set default nextval('public.projects_serial_seq');
alter sequence public.projects_serial_seq owned by public.projects.serial_number;

create unique index if not exists projects_serial_number_idx on public.projects(serial_number);

-- ---------------------------------------------------------------------------
-- 2. Edit history
-- ---------------------------------------------------------------------------

create table if not exists public.project_edits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  edited_by uuid references auth.users(id) on delete set null,
  edited_by_name text,
  edited_by_role text,
  created_at timestamptz not null default now()
);

create index if not exists project_edits_project_id_idx on public.project_edits(project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Deleted-project archive
-- ---------------------------------------------------------------------------

create table if not exists public.deleted_projects (
  id uuid primary key,
  serial_number integer,
  project_name text,
  client_name text,
  client_email text,
  project_data jsonb not null,
  edit_history jsonb not null default '[]'::jsonb,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_by_name text
);

create index if not exists deleted_projects_deleted_at_idx on public.deleted_projects(deleted_at desc);

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

-- Clients may only edit their own project, only while it is still pre-production,
-- and never the columns the admin owns. Runs first (name sorts before the logger).
create or replace function public.guard_project_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at := now();

  if public.is_admin() then
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

  return new;
end;
$$;

drop trigger if exists a_guard_project_update on public.projects;
create trigger a_guard_project_update
before update on public.projects
for each row execute procedure public.guard_project_update();

-- Record every changed field so both the old and new value stay visible.
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
    'company', 'client_name', 'client_email', 'service_name', 'ai_addon_scenes'
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

drop trigger if exists b_log_project_edit on public.projects;
create trigger b_log_project_edit
before update on public.projects
for each row execute procedure public.log_project_edit();

-- Keep a full snapshot (plus its edit history) whenever a project is deleted.
create or replace function public.archive_deleted_project()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_name text;
begin
  select full_name into actor_name from public.profiles where id = actor;

  insert into public.deleted_projects (
    id, serial_number, project_name, client_name, client_email,
    project_data, edit_history, deleted_by, deleted_by_name
  )
  values (
    old.id, old.serial_number, old.project_name, old.client_name, old.client_email,
    to_jsonb(old),
    coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at)
      from public.project_edits e
      where e.project_id = old.id
    ), '[]'::jsonb),
    actor, actor_name
  )
  on conflict (id) do update set
    project_data = excluded.project_data,
    edit_history = excluded.edit_history,
    deleted_at = now(),
    deleted_by = excluded.deleted_by,
    deleted_by_name = excluded.deleted_by_name;

  return old;
end;
$$;

drop trigger if exists on_project_deleted on public.projects;
create trigger on_project_deleted
before delete on public.projects
for each row execute procedure public.archive_deleted_project();

-- Put an archived project back into the live table.
create or replace function public.restore_deleted_project(p_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can restore a project.';
  end if;

  select project_data into snapshot from public.deleted_projects where id = p_id;
  if snapshot is null then
    raise exception 'That archived project no longer exists.';
  end if;

  insert into public.projects
  select * from jsonb_populate_record(null::public.projects, snapshot);

  delete from public.deleted_projects where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------

alter table public.project_edits enable row level security;
alter table public.deleted_projects enable row level security;

drop policy if exists "Clients update own editable projects" on public.projects;
create policy "Clients update own editable projects"
on public.projects for update to authenticated
using (
  (select auth.uid()) = client_id
  and status in ('submitted', 'reviewing', 'awaiting_files')
)
with check ((select auth.uid()) = client_id);

drop policy if exists "Admins delete projects" on public.projects;
create policy "Admins delete projects"
on public.projects for delete to authenticated
using (public.is_admin());

drop policy if exists "Clients view own edits, admins view all" on public.project_edits;
create policy "Clients view own edits, admins view all"
on public.project_edits for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.projects p
    where p.id = project_edits.project_id and p.client_id = (select auth.uid())
  )
);

drop policy if exists "Admins view deleted projects" on public.deleted_projects;
create policy "Admins view deleted projects"
on public.deleted_projects for select to authenticated
using (public.is_admin());

drop policy if exists "Admins remove archived projects" on public.deleted_projects;
create policy "Admins remove archived projects"
on public.deleted_projects for delete to authenticated
using (public.is_admin());

grant delete on public.projects to authenticated;
grant select on public.project_edits to authenticated;
grant select, delete on public.deleted_projects to authenticated;
grant execute on function public.restore_deleted_project(uuid) to authenticated;
