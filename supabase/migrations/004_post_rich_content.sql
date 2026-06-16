-- Rich post content: external links and wiki highlight terms
alter table public.posts
  add column if not exists links jsonb not null default '[]'::jsonb,
  add column if not exists wiki_terms jsonb not null default '[]'::jsonb;