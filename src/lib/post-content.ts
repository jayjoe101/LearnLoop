import { sanitizeExternalUrl, wikiUrlForTerm, type WikiSource } from "@/lib/wiki-links";
import type { PostLink, PostWikiTerm } from "@/lib/types";

export type InlineSegment =
  | { type: "text"; value: string }
  | { type: "wiki"; term: string; url: string }
  | { type: "link"; label: string; url: string };

const INLINE_PATTERN = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/g;

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