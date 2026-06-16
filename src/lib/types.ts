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
};

export type PostInteraction = {
  liked: boolean;
  saved: boolean;
  not_interested: boolean;
};

export const DEFAULT_TOPICS = [
  "AI & LLMs",
  "Space Exploration",
  "Ancient History",
  "Cognitive Science",
  "Productivity",
];

export const SEED_POSTS = [
  {
    topic: "Space",
    title: "JWST just proved the early universe is way weirder than we thought",
    body: "Astronomers expected tiny galaxies. Instead we found massive, mature ones only 300M years after the Big Bang. This breaks every formation model. Here's the simplest analogy that actually works...",
    image_url: "https://picsum.photos/id/1015/600/340",
    likes_count: 1243,
  },
  {
    topic: "AI",
    title: "The one reasoning trick that makes Grok outperform almost everything",
    body: "Chain-of-thought is old news. The real leap is reasoning effort control plus tool use in one pass. Mind-blowing example inside.",
    image_url: null,
    likes_count: 892,
  },
];

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