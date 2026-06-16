export type FeedStyle =
  | "Balanced & insightful"
  | "Deep technical"
  | "Fun + surprising"
  | "Actionable life upgrade";

export type PostLink = {
  label: string;
  url: string;
};

export type PostWikiTerm = {
  term: string;
};

export type Post = {
  id: string;
  user_id: string;
  topic: string;
  title: string;
  body: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  source: "grok" | "seed" | "remix";
  prompt: string | null;
  persona_id: string | null;
  author_name: string | null;
  author_role: string | null;
  author_handle: string | null;
  links: PostLink[] | null;
  wiki_terms: PostWikiTerm[] | null;
  created_at: string;
};

export type Topic = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  feed_style: FeedStyle;
  personalization_enabled: boolean;
  onboarding_completed: boolean;
};

export const ONBOARDING_TOPICS = [
  "Computer Science",
  "Computer Programming",
  "Mathematics",
  "Statistics",
  "Machine Learning",
  "AI",
  "Science",
  "Physics",
] as const;

export type PostInteraction = {
  liked: boolean;
  saved: boolean;
  not_interested: boolean;
};

