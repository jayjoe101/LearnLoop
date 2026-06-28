import type { FeedStyle } from "@/lib/types";

const TECH_PERSONA_IDS = new Set([
  "researcher",
  "engineer",
  "explorer",
  "skeptic",
  "historian",
]);

export type WikiSource = "wikipedia" | "grokipedia";

export function slugifyWikiTerm(term: string): string {
  return term.trim().replace(/\s+/g, "_");
}

/** Grokipedia slugs use Title_Case words joined by underscores. */
export function grokipediaSlug(term: string): string {
  return term
    .trim()
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("_");
}

export function wikipediaUrl(term: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(slugifyWikiTerm(term))}`;
}

export function grokipediaUrl(term: string): string {
  return `https://grokipedia.com/page/${encodeURIComponent(grokipediaSlug(term))}`;
}

export function pickWikiSource(
  style: FeedStyle,
  personaId?: string | null
): WikiSource {
  if (style === "Deep technical") return "grokipedia";
  if (personaId && TECH_PERSONA_IDS.has(personaId)) return "grokipedia";
  return "wikipedia";
}

export function wikiUrlForTerm(
  term: string,
  source: WikiSource
): string {
  return source === "grokipedia" ? grokipediaUrl(term) : wikipediaUrl(term);
}

export function sanitizeExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}