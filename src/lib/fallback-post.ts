import { isTooSimilar } from "@/lib/dedup";
import { finalizePostLinks } from "@/lib/post-content";
import type { Persona } from "@/lib/personas";
import { discoverConcreteSubject } from "@/lib/subject-discovery";
import type { PostLink, PostWikiTerm } from "@/lib/types";

export type FallbackPostInput = {
  topics: string[];
  focusTopic?: string;
  concreteSubject?: string;
  subjectIndex?: number;
  recentTitles?: string[];
  avoidSubjects?: string[];
};

export type FallbackPost = {
  topic: string;
  title: string;
  body: string;
  links: PostLink[];
  wiki_terms: PostWikiTerm[];
  persona: Persona;
  subject: string;
};

const WIKI_TERM_OVERRIDES: [RegExp, string][] = [
  [/branch predict/i, "Branch predictor"],
  [/simpson/i, "Simpson's paradox"],
  [/attention.*transformer|transformer.*attention/i, "Transformer (machine learning)"],
  [/gradient descent/i, "Gradient descent"],
  [/hash table/i, "Hash table"],
  [/virtual memory/i, "Virtual memory"],
  [/neutron star/i, "Neutron star"],
  [/superconduct/i, "Superconductivity"],
  [/p-value/i, "P-value"],
  [/crispr/i, "CRISPR"],
  [/entropy/i, "Entropy"],
  [/eigenvalue/i, "Eigenvalues and eigenvectors"],
  [/short selling/i, "Short (finance)"],
  [/tcp/i, "TCP congestion control"],
];

function pickFocusTopic(topics: string[], explicit?: string): string {
  if (explicit) return explicit;
  if (topics.length === 0) return "general knowledge";
  return topics[Math.floor(Math.random() * topics.length)];
}

export function extractPrimaryWikiTerm(subject: string): string {
  for (const [pattern, term] of WIKI_TERM_OVERRIDES) {
    if (pattern.test(subject)) return term;
  }

  const stripped = subject
    .replace(/^(how|why|when|the|what)\s+/i, "")
    .replace(/\?$/g, "")
    .trim();

  const words = stripped
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !/^(the|and|for|that|with|from|into|your|lets|relevant|aggregated)$/i.test(
          w
        )
    );

  if (words.length >= 2) {
    return words
      .slice(0, Math.min(4, words.length))
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  const first = words[0] ?? stripped.split(" ")[0] ?? "concept";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function extractHook(subject: string): string {
  const wiki = extractPrimaryWikiTerm(subject);
  if (wiki.length < 60) return wiki;
  return subject
    .replace(/^(how|why|when|the)\s+/i, "")
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

function capitalizeSubject(subject: string): string {
  if (!subject) return subject;
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function subjectSeed(subject: string, variant: number): number {
  let h = variant >>> 0;
  for (let i = 0; i < subject.length; i++) {
    h = (Math.imul(31, h) + subject.charCodeAt(i)) >>> 0;
  }
  return h;
}

function subjectTokens(subject: string): string[] {
  return subject
    .replace(/\?$/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 3);
}

function buildDynamicTitle(subject: string, variant: number): string {
  const seed = subjectSeed(subject, variant);
  const hook = extractHook(subject);
  const tokens = subjectTokens(subject);
  const anchor = tokens[seed % Math.max(tokens.length, 1)] ?? hook.split(" ")[0] ?? "this";
  const openers = ["Learn", "Understand", "Know", "See"];
  const opener = openers[seed % openers.length];
  const focus =
    hook.length > 48 ? hook.split(/\s+/).slice(0, 4).join(" ") : hook;

  if (seed % 5 === 0) {
    return `${opener} how ${focus} works — in plain language`.slice(0, 90);
  }
  if (seed % 5 === 1) {
    return `${capitalizeSubject(focus)}: what "${anchor}" actually means`.slice(0, 90);
  }
  if (seed % 5 === 2) {
    return `The ${anchor} idea behind ${focus}`.slice(0, 90);
  }
  if (seed % 5 === 3) {
    return `${opener} ${focus} without the jargon`.slice(0, 90);
  }
  return `${capitalizeSubject(focus)} explained simply`.slice(0, 90);
}

function deriveInsightHighlight(subject: string, seed: number): string {
  const tokens = subjectTokens(subject);
  const anchor = tokens[(seed >> 3) % Math.max(tokens.length, 1)] ?? "the core step";
  const verbs = ["drives", "limits", "explains", "changes"];
  const verb = verbs[(seed >> 5) % verbs.length];
  return `==${capitalizeSubject(anchor)} ${verb} the outcome — that is the part summaries skip==`;
}

function buildDynamicBody(
  wiki: string,
  subject: string,
  variant: number,
  persona: Persona
): string {
  const seed = subjectSeed(subject, variant + 17);
  const clean = capitalizeSubject(subject.replace(/\?$/g, "").trim());
  const wikiLinked = `**[[${wiki}]]**`;
  const tokens = subjectTokens(subject);
  const mechanismWord = tokens[(seed >> 2) % Math.max(tokens.length, 1)] ?? wiki.split(" ")[0];
  const insight = deriveInsightHighlight(subject, seed);

  const goal =
    seed % 2 === 0
      ? `You'll learn how ${clean} works and what to take away from it.`
      : `This post teaches one concrete idea: ${clean}.`;

  const mechanism = `${wikiLinked} is the anchor. Stated plainly: ${clean}. The process hinges on **${mechanismWord}** — not on a vague overview of the field.`;

  const plainExplain =
    seed % 3 === 0
      ? `Because ${mechanismWord} sets the constraint, the result follows directly once you name that step.`
      : seed % 3 === 1
        ? `The reason is mechanical: when ${mechanismWord} shifts, the downstream effect changes predictably.`
        : `In simple terms: track ${mechanismWord} first, then the rest of the story stops sounding mysterious.`;

  const takeaway = `*Takeaway (${persona.role}):* ${insight.replace(/==/g, "")}`;

  return `${goal}\n\n${mechanism}\n\n${plainExplain}\n\n${insight}\n\n${takeaway}`;
}

export async function buildVariedFallbackPost(
  input: FallbackPostInput,
  persona: Persona,
  variant: number
): Promise<FallbackPost> {
  const focus = pickFocusTopic(input.topics, input.focusTopic);
  const subject =
    input.concreteSubject ??
    (await discoverConcreteSubject({
      topic: focus,
      subjectIndex: (input.subjectIndex ?? 0) + variant,
      recentTitles: input.recentTitles,
      avoidSubjects: input.avoidSubjects,
    }));
  const wikiTerm = extractPrimaryWikiTerm(subject);
  const recentTitles = input.recentTitles ?? [];

  let title = buildDynamicTitle(subject, variant);
  let tries = 0;
  while (isTooSimilar(title, recentTitles) && tries < 8) {
    title = buildDynamicTitle(subject, variant + tries + 1);
    tries++;
  }

  const body = buildDynamicBody(wikiTerm, subject, variant, persona);
  const wiki_terms = [{ term: wikiTerm }];

  return {
    topic: focus,
    title,
    body,
    links: finalizePostLinks([], wikiTerm, wiki_terms),
    wiki_terms,
    persona,
    subject,
  };
}