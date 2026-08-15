-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references auth.users(id) on delete cascade,
  client_name text not null,
  client_email text not null,
  phone text,
  company text,
  project_name text not null,
  format text,
  preferred_music text,
  footage_link text,
  reference_link text,
  creative_notes text not null,
  services jsonb not null default '[]'::jsonb,
  estimated_total numeric(10,2) not null default 0,
  status text not null default 'submitted' check (status in ('submitted','reviewing','awaiting_files','in_progress','in_review','completed','cancelled')),
  admin_notes text,
  submission_id uuid not null default gen_random_uuid(),
  project_number integer not null default 1,
  service_id text,
  service_name text,
  unit_price numeric(10,2),
  aimed_length integer,
  color_profile text,
  ai_addon_scenes integer not null default 0,
  ai_addon_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep existing installations compatible with guest and multi-video requests.
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, company, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company',
    case when lower(new.email) = 'karrarvisuals@gmail.com' then 'admin' else 'client' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill profiles if an account was created before this schema was installed.
insert into public.profiles (id, email, full_name, company)
select id, email, raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'company'
from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

drop policy if exists "Users view own profile, admins view all" on public.profiles;
create policy "Users view own profile, admins view all"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or public.is_admin());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

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

drop policy if exists "Clients view own projects, admins view all" on public.projects;
create policy "Clients view own projects, admins view all"
on public.projects for select to authenticated
using ((select auth.uid()) = client_id or public.is_admin());

drop policy if exists "Admins update projects" on public.projects;
create policy "Admins update projects"
on public.projects for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant usage on schema public to authenticated;
grant usage on schema public to anon;
grant select on public.profiles to authenticated;
grant update (full_name, company, updated_at) on public.profiles to authenticated;
grant select, insert on public.projects to authenticated;
grant update on public.projects to authenticated;
grant insert on public.projects to anon;

create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists projects_created_at_idx on public.projects(created_at desc);
create index if not exists projects_status_idx on public.projects(status);
create index if not exists projects_submission_id_idx on public.projects(submission_id);

-- The account registered with this email becomes the portal administrator.
update public.profiles set role = 'admin' where lower(email) = 'karrarvisuals@gmail.com';
