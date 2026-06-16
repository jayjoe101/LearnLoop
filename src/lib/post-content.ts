import {
  sanitizeExternalUrl,
  wikipediaUrl,
  wikiUrlForTerm,
  type WikiSource,
} from "@/lib/wiki-links";
import type { PostLink, PostWikiTerm } from "@/lib/types";

export type InlineSegment =
  | { type: "text"; value: string }
  | { type: "wiki"; term: string; url: string }
  | { type: "link"; label: string; url: string };

export type RichTextSegment =
  | { type: "plain"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "highlight"; value: string };

const INLINE_PATTERN = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/g;
const RICH_TEXT_PATTERN = /\*\*([^*]+)\*\*|\*([^*]+)\*|==([^=]+)==/g;

export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export function parseInlineSegments(
  text: string,
  wikiSource: WikiSource
): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    if (match[1]) {
      const term = match[1].trim();
      segments.push({
        type: "wiki",
        term,
        url: wikiUrlForTerm(term, wikiSource),
      });
    } else if (match[2] && match[3]) {
      const url = sanitizeExternalUrl(match[3]);
      if (url) {
        segments.push({ type: "link", label: match[2].trim(), url });
      } else {
        segments.push({ type: "text", value: match[0] });
      }
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: "text", value: text }];
}

export function parseRichTextSegments(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(RICH_TEXT_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ type: "plain", value: text.slice(lastIndex, index) });
    }

    if (match[1]) {
      segments.push({ type: "bold", value: match[1] });
    } else if (match[2]) {
      segments.push({ type: "italic", value: match[2] });
    } else if (match[3]) {
      segments.push({ type: "highlight", value: match[3] });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "plain", value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: "plain", value: text }];
}

export function normalizePostLinks(
  links: Array<{ label?: string; url?: string }> | undefined
): PostLink[] {
  if (!links?.length) return [];

  const seen = new Set<string>();
  const normalized: PostLink[] = [];

  for (const link of links) {
    const label = link.label?.trim();
    const url = link.url ? sanitizeExternalUrl(link.url) : null;
    if (!label || !url || seen.has(url)) continue;
    seen.add(url);
    normalized.push({ label, url });
  }

  return normalized.slice(0, 3);
}

/** Guarantee a Wikipedia source — avoids expensive AI retries when the model omits one. */
export function ensureWikipediaLink(
  links: PostLink[],
  topic: string,
  wikiTerms: PostWikiTerm[]
): PostLink[] {
  if (links.some((l) => l.url.includes("wikipedia.org/wiki/"))) {
    return links.slice(0, 3);
  }

  const term = wikiTerms[0]?.term ?? topic;
  return [
    ...links,
    { label: `${term} on Wikipedia`, url: wikipediaUrl(term) },
  ].slice(0, 3);
}

export function finalizePostLinks(
  raw: Array<{ label?: string; url?: string }> | undefined,
  topic: string,
  wikiTerms: PostWikiTerm[]
): PostLink[] {
  const normalized = normalizePostLinks(raw);
  if (normalized.length === 0) {
    const term = wikiTerms[0]?.term ?? topic;
    return [{ label: `${term} on Wikipedia`, url: wikipediaUrl(term) }];
  }
  return ensureWikipediaLink(normalized, topic, wikiTerms);
}

export function normalizeWikiTerms(
  terms: Array<{ term?: string }> | undefined
): PostWikiTerm[] {
  if (!terms?.length) return [];

  const seen = new Set<string>();
  const normalized: PostWikiTerm[] = [];

  for (const entry of terms) {
    const term = entry.term?.trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ term });
  }

  return normalized.slice(0, 4);
}

/** Wrap bare wiki terms in [[brackets]] when the model listed them but forgot markers. */
export function enrichBodyWithWikiTerms(
  body: string,
  wikiTerms: PostWikiTerm[]
): string {
  let enriched = body;

  for (const { term } of wikiTerms) {
    if (!term || enriched.includes(`[[${term}]]`)) continue;

    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, "i");
    enriched = enriched.replace(pattern, "[[$1]]");
  }

  return enriched;
}