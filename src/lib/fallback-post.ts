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

const TITLE_BUILDERS = [
  (hook: string) => `Why ${hook} is wilder than it sounds`,
  (hook: string) => `${hook}: the part everyone hand-waves`,
  (hook: string) => `Wait — ${hook} actually works like this`,
  (hook: string) => `The ${hook} detail that changes the whole picture`,
  (hook: string) => `${hook} explained without the fluff`,
  (hook: string) => `Nobody tells you this about ${hook}`,
];

const BODY_BUILDERS = [
  (wiki: string, subject: string) =>
    `**[[${wiki}]]** is one of those ideas that sounds simple until you trace it step by step.\n\n${capitalizeSubject(subject)}. The catch: ==the naive story hides the constraint that actually drives the outcome==.`,
  (wiki: string, subject: string) =>
    `Here's the angle textbooks rush past on **[[${wiki}]]**.\n\n${capitalizeSubject(subject)}. Once you see the mechanism, ==a bunch of "weird" results suddenly look inevitable==.`,
  (wiki: string, subject: string) =>
    `**[[${wiki}]]** shows up in more places than you'd expect — and *not* as a buzzword.\n\n${capitalizeSubject(subject)}. The interesting bit is ==what breaks when you push the system slightly out of spec==.`,
  (wiki: string, subject: string) =>
    `Most explanations of **[[${wiki}]]** stop right before it gets good.\n\n${capitalizeSubject(subject)}. The version worth knowing ==names the tradeoff explicitly== instead of waving at intuition.`,
  (wiki: string, subject: string) =>
    `If **[[${wiki}]]** feels fuzzy, you're not alone — the clean diagram is a lie of omission.\n\n${capitalizeSubject(subject)}. Follow the chain of cause and effect and ==the whole thing snaps into focus==.`,
  (wiki: string, subject: string) =>
    `**[[${wiki}]]** has a reputation problem: people treat it like trivia instead of a tool.\n\n${capitalizeSubject(subject)}. The practical takeaway is ==smaller than a lecture but more useful than an overview==.`,
];

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
      subjectIndex: input.subjectIndex ?? variant,
      recentTitles: input.recentTitles,
    }));
  const wikiTerm = extractPrimaryWikiTerm(subject);
  const hook = extractHook(subject);
  const recentTitles = input.recentTitles ?? [];

  let title = TITLE_BUILDERS[variant % TITLE_BUILDERS.length](hook);
  let tries = 0;
  while (isTooSimilar(title, recentTitles) && tries < 6) {
    const v = variant + tries + 1;
    title = TITLE_BUILDERS[v % TITLE_BUILDERS.length](hook);
    tries++;
  }

  const body = BODY_BUILDERS[variant % BODY_BUILDERS.length](wikiTerm, subject);
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