-- Run in Supabase Dashboard > SQL Editor AFTER security-hardening-migration.sql.
--
-- Why: length and format limits lived only in the *guest* insert policy. Signed-in
-- clients had none on insert, and NO path had any on update. Table CHECK
-- constraints apply to every role on both insert and update, so the rules hold
-- no matter which policy allowed the write.
--
-- Added NOT VALID: new and updated rows are checked immediately, existing rows
-- are left alone so this can never fail on legacy data. Run the VALIDATE block
-- at the bottom once you've confirmed nothing old violates them.

-- ---------------------------------------------------------------------------
-- Text length bounds
-- ---------------------------------------------------------------------------

alter table public.projects drop constraint if exists projects_text_len_check;
alter table public.projects add constraint projects_text_len_check check (
  char_length(client_name) between 1 and 200
  and char_length(client_email) between 3 and 320
  and char_length(project_name) between 1 and 200
  and char_length(creative_notes) between 1 and 10000
  and (company is null or char_length(company) <= 200)
  and (format is null or char_length(format) <= 120)
  and (color_profile is null or char_length(color_profile) <= 200)
  and (preferred_music is null or char_length(preferred_music) <= 300)
  and (service_name is null or char_length(service_name) <= 200)
  and (service_id is null or char_length(service_id) <= 100)
  and (assigned_editor_name is null or char_length(assigned_editor_name) <= 200)
  and (admin_notes is null or char_length(admin_notes) <= 20000)
) not valid;

-- ---------------------------------------------------------------------------
-- Email and phone shape
-- ---------------------------------------------------------------------------

alter table public.projects drop constraint if exists projects_contact_check;
alter table public.projects add constraint projects_contact_check check (
  client_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  and (
    phone is null
    or (
      phone ~ '^\+?[-0-9() ]+$'
      and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
    )
  )
) not valid;

-- ---------------------------------------------------------------------------
-- Links must be real http(s) URLs, not javascript:/data: payloads
-- ---------------------------------------------------------------------------

alter table public.projects drop constraint if exists projects_links_check;
alter table public.projects add constraint projects_links_check check (
  (footage_link is null or (footage_link ~* '^https?://' and char_length(footage_link) <= 2048))
  and (reference_link is null or char_length(reference_link) <= 2048)
  and (final_video_link is null or (final_video_link ~* '^https?://' and char_length(final_video_link) <= 2048))
) not valid;

-- ---------------------------------------------------------------------------
-- Numeric ranges and the services payload — previously guest-insert only
-- ---------------------------------------------------------------------------

alter table public.projects drop constraint if exists projects_numeric_check;
alter table public.projects add constraint projects_numeric_check check (
  (aimed_length is null or aimed_length between 1 and 600)
  and ai_addon_scenes between 0 and 5
  and ai_addon_price >= 0
  and estimated_total between 0 and 100000
  and (unit_price is null or unit_price between 0 and 100000)
  and project_number between 1 and 100
  and (serial_number is null or serial_number > 0)
) not valid;

alter table public.projects drop constraint if exists projects_services_check;
alter table public.projects add constraint projects_services_check check (
  jsonb_typeof(services) = 'array'
  and jsonb_array_length(services) <= 50
  and octet_length(services::text) <= 20000
) not valid;

-- ---------------------------------------------------------------------------
-- Same bounds for the profile fields a user controls
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_text_len_check;
alter table public.profiles add constraint profiles_text_len_check check (
  (full_name is null or char_length(full_name) <= 200)
  and (company is null or char_length(company) <= 200)
  and char_length(email) between 3 and 320
) not valid;

-- ---------------------------------------------------------------------------
-- Optional: run once you've confirmed no existing row violates the rules.
-- Each will raise an error naming the constraint if old data is out of bounds.
-- ---------------------------------------------------------------------------
-- alter table public.projects validate constraint projects_text_len_check;
-- alter table public.projects validate constraint projects_contact_check;
-- alter table public.projects validate constraint projects_links_check;
-- alter table public.projects validate constraint projects_numeric_check;
-- alter table public.projects validate constraint projects_services_check;
-- alter table public.profiles validate constraint profiles_text_len_check;
