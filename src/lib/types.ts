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

export const GENERATION_TEMPLATES = [
  {
    topic: "History",
    title: "The Roman emperor who accidentally invented modern HR",
    body: "Trajan's alimenta program was basically government-funded college plus startup grants 1900 years ago. The ROI was insane...",
  },
  {
    topic: "Cognitive Science",
    title: "Why your brain loves doomscrolling (and the 8-second hack that breaks it)",
    body: "Dopamine prediction error plus variable rewards. Here's the exact protocol top performers use to turn scrolling into learning.",
  },
  {
    topic: "AI",
    title: "The hidden cost of context windows nobody talks about",
    body: "Every token you feed the model shapes what it forgets. Here's how to structure prompts so your feed stays sharp instead of drifting.",
  },
  {
    topic: "Productivity",
    title: "The 12-minute rule that replaced my morning routine",
    body: "Not a hack — a constraint. One focused block before inputs, one after. The compounding effect after 30 days is wild.",
  },
];