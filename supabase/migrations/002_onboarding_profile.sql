-- Interest profiles + onboarding completion flag
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Existing users with topics already set are considered onboarded
update public.profiles p
set onboarding_completed = true
where onboarding_completed = false
  and exists (select 1 from public.topics t where t.user_id = p.id);