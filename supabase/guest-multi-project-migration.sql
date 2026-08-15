-- Run this once in Supabase Dashboard > SQL Editor.
-- It allows guest orders and stores each selected video as its own project.

alter table public.projects alter column client_id drop not null;
alter table public.projects add column if not exists submission_id uuid not null default gen_random_uuid();
alter table public.projects add column if not exists project_number integer not null default 1;
alter table public.projects add column if not exists service_id text;
alter table public.projects add column if not exists service_name text;
alter table public.projects add column if not exists unit_price numeric(10,2);
alter table public.projects add column if not exists aimed_length integer;
alter table public.projects add column if not exists color_profile text;
alter table public.projects add column if not exists ai_addon_scenes integer not null default 0;
alter table public.projects add column if not exists ai_addon_price numeric(10,2) not null default 0;

drop policy if exists "Clients create own projects" on public.projects;
create policy "Clients create own projects"
on public.projects for insert to authenticated
with check (
  (select auth.uid()) = client_id
  and status = 'submitted'
  and admin_notes is null
  and char_length(phone) between 5 and 50
  and aimed_length between 1 and 600
  and ai_addon_scenes between 0 and 5
  and ai_addon_price = ai_addon_scenes * 5
);

drop policy if exists "Guests create project requests" on public.projects;
create policy "Guests create project requests"
on public.projects for insert to anon
with check (
  client_id is null
  and status = 'submitted'
  and admin_notes is null
  and char_length(client_name) between 1 and 200
  and char_length(client_email) between 3 and 320
  and client_email like '%@%'
  and char_length(project_name) between 1 and 200
  and char_length(creative_notes) between 1 and 10000
  and char_length(phone) between 5 and 50
  and project_number between 1 and 100
  and aimed_length between 1 and 600
  and ai_addon_scenes between 0 and 5
  and ai_addon_price = ai_addon_scenes * 5
  and estimated_total between 0 and 100000
  and jsonb_typeof(services) = 'array'
);

grant usage on schema public to anon;
grant insert on public.projects to anon;

create index if not exists projects_submission_id_idx on public.projects(submission_id);
