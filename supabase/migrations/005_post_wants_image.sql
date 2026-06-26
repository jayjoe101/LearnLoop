-- Whether this post was selected to attempt a Wikipedia thumbnail (1/3 of posts).
alter table public.posts
  add column if not exists wants_image boolean not null default false;