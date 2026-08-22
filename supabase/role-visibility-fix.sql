-- Run this once in Supabase Dashboard > SQL Editor.
--
-- Symptom this fixes: a person promoted to Editor still sees "Client" in the
-- portal and none of the projects assigned to them.
--
-- Cause: the portal decided the role from a direct read of public.profiles.
-- That read goes through row security, so anything that makes it come back
-- empty -- a missing profile row, a policy change, a stale PostgREST schema
-- cache -- silently degrades the person to "client", and the client portal
-- reads nothing from editor_assignments because is_editor() is false there too.
--
-- Everything below is idempotent; running it twice is safe.

-- ---------------------------------------------------------------------------
-- 1. Make sure the role column actually accepts 'editor'
--    (no-op if editor-features-migration.sql already ran; a partial run of
--    that file would leave the original client/admin-only constraint behind,
--    and every promotion would fail with a check-constraint violation.)
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('client', 'admin', 'editor'));

-- ---------------------------------------------------------------------------
-- 2. Every auth user needs a profile row -- no row means no role
-- ---------------------------------------------------------------------------

insert into public.profiles (id, email, full_name, company)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'company'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. An authoritative role lookup the portal can trust
--    SECURITY DEFINER, so it answers correctly regardless of row security.
-- ---------------------------------------------------------------------------

create or replace function public.my_role()
returns text
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())),
    'client'
  );
$$;

grant execute on function public.my_role() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Diagnostics -- run these separately and read the output
-- ---------------------------------------------------------------------------

-- Who is what, and how much work is on them:
--   select p.email, p.full_name, p.role,
--          count(pr.id) filter (where pr.assigned_editor_id = p.id) as assigned
--   from public.profiles p
--   left join public.projects pr on pr.assigned_editor_id = p.id
--   group by p.id, p.email, p.full_name, p.role
--   order by p.role, p.email;

-- Projects pointing at someone who is not an editor (these are invisible to
-- the assignee, because editor_assignments requires is_editor()):
--   select pr.serial_number, pr.project_name, p.email, p.role
--   from public.projects pr
--   join public.profiles p on p.id = pr.assigned_editor_id
--   where p.role <> 'editor';
