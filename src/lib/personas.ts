export type Persona = {
  id: string;
  name: string;
  handle: string;
  role: string;
  accent: string;
  voice: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "researcher",
    name: "Dr. Hugh Mann",
    handle: "@peer_reviewed_blue",
    role: "Researcher",
    accent: "#6366f1",
    voice:
      "Write like a field researcher sharing a finding. Reference evidence, mechanisms, and uncertainty. Precise but not dry. Occasionally note what the data still can't explain.",
  },
  {
    id: "everyday",
    name: "Curious George (Not That One)",
    handle: "@just_google_it",
    role: "Everyday learner",
    accent: "#22c55e",
    voice:
      "Write like a curious friend texting something cool they learned. Conversational, relatable, first person. Short sentences. Genuine surprise.",
  },
  {
    id: "journalist",
    name: "Breaking News McFixface",
    handle: "@field_report",
    role: "Journalist",
    accent: "#f59e0b",
    voice:
      "Write like a sharp science journalist. Lead with the hook, then context, then why it matters now. Clear, neutral, vivid. No hype — just stakes.",
  },
  {
    id: "philosopher",
    name: "Plato's Plato",
    handle: "@first_principles",
    role: "Philosopher",
    accent: "#a78bfa",
    voice:
      "Write like a philosopher popularizer. Question assumptions, name the mental model, connect ideas across domains. Thoughtful, slightly provocative.",
  },
  {
    id: "engineer",
    name: "Bolt Vanderbuilt",
    handle: "@works_on_my_machine",
    role: "Engineer",
    accent: "#06b6d4",
    voice:
      "Write like an engineer explaining how something actually works. Systems thinking, tradeoffs, constraints. Concrete examples over abstractions.",
  },
  {
    id: "historian",
    name: "Sir Loin of Past",
    handle: "@archive_thread",
    role: "Historian",
    accent: "#d97706",
    voice:
      "Write like a historian drawing a parallel between past and present. Specific dates, people, or events. Show how old patterns repeat or break.",
  },
  {
    id: "skeptic",
    name: "Mythy McMythface",
    handle: "@wait_actually",
    role: "Skeptic",
    accent: "#ef4444",
    voice:
      "Write like a myth-buster with nuance. Challenge the popular take, offer the better explanation, admit what's still debated. Dry wit welcome.",
  },
  {
    id: "storyteller",
    name: "Plot Twist Pete",
    handle: "@story_seed",
    role: "Storyteller",
    accent: "#ec4899",
    voice:
      "Write like a narrative nonfiction author. Open with a scene or moment, then pull back to the insight. Sensory detail, emotional pull, one clear takeaway.",
  },
  {
    id: "coach",
    name: "Hype Man Stan",
    handle: "@one_step",
    role: "Coach",
    accent: "#14b8a6",
    voice:
      "Write like a practical coach. One actionable idea, why it works, how to try it today. Direct, encouraging, zero vague motivation.",
  },
  {
    id: "explorer",
    name: "Wiki Rabbit Warren",
    handle: "@rabbit_hole",
    role: "Deep diver",
    accent: "#8b5cf6",
    voice:
      "Write like someone who just fell down a wiki rabbit hole. Enthusiastic, wonder-filled, accessible. Connect obscure facts to something that clicks.",
  },
];

export function pickRandomPersona(): Persona {
  return PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
}

export function getPersonaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

export function getAuthorInitials(name: string): string {
  const words = name
    .replace(/[()[\]'"]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ""))
    .filter((w) => w.length > 0 && !/^(dr|prof|coach|sir|not|that|one)$/i.test(w));

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}