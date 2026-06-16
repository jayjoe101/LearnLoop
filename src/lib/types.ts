export type FeedStyle =
  | "Balanced & insightful"
  | "Deep technical"
  | "Fun + surprising"
  | "Actionable life upgrade";

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
  "AI & Machine Learning",
  "Space & Physics",
  "History & Culture",
  "Psychology & Mind",
  "Business & Startups",
  "Health & Wellness",
  "Philosophy",
  "Climate & Nature",
  "Art & Design",
  "Technology",
  "Productivity",
  "Science",
] as const;

export const FEED_STYLE_OPTIONS: {
  value: FeedStyle;
  label: string;
  description: string;
}[] = [
  {
    value: "Balanced & insightful",
    label: "Balanced",
    description: "Clear insights across any topic — your default smart feed.",
  },
  {
    value: "Deep technical",
    label: "Technical",
    description: "Mechanisms, systems, and how things actually work.",
  },
  {
    value: "Fun + surprising",
    label: "Surprising",
    description: "Unexpected angles and ideas you wouldn't think to search for.",
  },
  {
    value: "Actionable life upgrade",
    label: "Practical",
    description: "Concrete takeaways you can apply the same day.",
  },
];

export type PostInteraction = {
  liked: boolean;
  saved: boolean;
  not_interested: boolean;
};

