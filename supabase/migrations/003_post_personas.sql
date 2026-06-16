-- Author personas attached to generated posts
alter table public.posts
  add column if not exists persona_id text,
  add column if not exists author_name text,
  add column if not exists author_role text,
  add column if not exists author_handle text;

create index if not exists posts_persona_id_idx on public.posts (persona_id);