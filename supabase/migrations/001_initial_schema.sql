-- InsightScroll production schema
-- Run in Supabase SQL Editor or via Supabase CLI

create extension if not exists "uuid-ossp";

-- User profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  feed_style text not null default 'Balanced & insightful',
  personalization_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User interest topics
create table public.topics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Feed posts
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  title text not null,
  body text not null,
  image_url text,
  likes_count integer not null default 0,
  comments_count integer not null default 47,
  source text not null default 'grok' check (source in ('grok', 'seed', 'remix')),
  prompt text,
  created_at timestamptz not null default now()
);

-- User interactions with posts
create table public.post_interactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  liked boolean not null default false,
  saved boolean not null default false,
  not_interested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- Saved notes / knowledge base
create table public.saved_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index posts_user_id_created_at_idx on public.posts (user_id, created_at desc);
create index topics_user_id_idx on public.topics (user_id);
create index post_interactions_user_post_idx on public.post_interactions (user_id, post_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger post_interactions_updated_at
  before update on public.post_interactions
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'InsightScroll User'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.posts enable row level security;
alter table public.post_interactions enable row level security;
alter table public.saved_notes enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Topics policies
create policy "Users can view own topics"
  on public.topics for select using (auth.uid() = user_id);
create policy "Users can insert own topics"
  on public.topics for insert with check (auth.uid() = user_id);
create policy "Users can update own topics"
  on public.topics for update using (auth.uid() = user_id);
create policy "Users can delete own topics"
  on public.topics for delete using (auth.uid() = user_id);

-- Posts policies
create policy "Users can view own posts"
  on public.posts for select using (auth.uid() = user_id);
create policy "Users can insert own posts"
  on public.posts for insert with check (auth.uid() = user_id);
create policy "Users can update own posts"
  on public.posts for update using (auth.uid() = user_id);
create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- Post interactions policies
create policy "Users can view own interactions"
  on public.post_interactions for select using (auth.uid() = user_id);
create policy "Users can insert own interactions"
  on public.post_interactions for insert with check (auth.uid() = user_id);
create policy "Users can update own interactions"
  on public.post_interactions for update using (auth.uid() = user_id);

-- Saved notes policies
create policy "Users can view own notes"
  on public.saved_notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes"
  on public.saved_notes for insert with check (auth.uid() = user_id);
create policy "Users can delete own notes"
  on public.saved_notes for delete using (auth.uid() = user_id);