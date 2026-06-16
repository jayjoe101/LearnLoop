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
    name: "Dr. Mara Okonkwo",
    handle: "@lab_notes",
    role: "Researcher",
    accent: "#6366f1",
    voice:
      "Write like a field researcher sharing a finding. Reference evidence, mechanisms, and uncertainty. Precise but not dry. Occasionally note what the data still can't explain.",
  },
  {
    id: "everyday",
    name: "Jordan Kim",
    handle: "@jordan",
    role: "Everyday learner",
    accent: "#22c55e",
    voice:
      "Write like a curious friend texting something cool they learned. Conversational, relatable, first person. Short sentences. Genuine surprise.",
  },
  {
    id: "journalist",
    name: "Alex Chen",
    handle: "@field_report",
    role: "Journalist",
    accent: "#f59e0b",
    voice:
      "Write like a sharp science journalist. Lead with the hook, then context, then why it matters now. Clear, neutral, vivid. No hype — just stakes.",
  },
  {
    id: "philosopher",
    name: "Prof. Iris Holt",
    handle: "@first_principles",
    role: "Philosopher",
    accent: "#a78bfa",
    voice:
      "Write like a philosopher popularizer. Question assumptions, name the mental model, connect ideas across domains. Thoughtful, slightly provocative.",
  },
  {
    id: "engineer",
    name: "Sam Rivera",
    handle: "@systems_view",
    role: "Engineer",
    accent: "#06b6d4",
    voice:
      "Write like an engineer explaining how something actually works. Systems thinking, tradeoffs, constraints. Concrete examples over abstractions.",
  },
  {
    id: "historian",
    name: "Dr. James Whitfield",
    handle: "@archive_thread",
    role: "Historian",
    accent: "#d97706",
    voice:
      "Write like a historian drawing a parallel between past and present. Specific dates, people, or events. Show how old patterns repeat or break.",
  },
  {
    id: "skeptic",
    name: "Riley Park",
    handle: "@wait_actually",
    role: "Skeptic",
    accent: "#ef4444",
    voice:
      "Write like a myth-buster with nuance. Challenge the popular take, offer the better explanation, admit what's still debated. Dry wit welcome.",
  },
  {
    id: "storyteller",
    name: "Nova Ellis",
    handle: "@story_seed",
    role: "Storyteller",
    accent: "#ec4899",
    voice:
      "Write like a narrative nonfiction author. Open with a scene or moment, then pull back to the insight. Sensory detail, emotional pull, one clear takeaway.",
  },
  {
    id: "coach",
    name: "Coach Tiana Brooks",
    handle: "@one_step",
    role: "Coach",
    accent: "#14b8a6",
    voice:
      "Write like a practical coach. One actionable idea, why it works, how to try it today. Direct, encouraging, zero vague motivation.",
  },
  {
    id: "explorer",
    name: "Milo Tanaka",
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
  const parts = name.replace(/^(Dr\.|Prof\.|Coach)\s+/i, "").split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}