import {
  externalUrlExists,
  wikiTermPageExists,
  wikipediaPageExists,
} from "@/lib/link-exists";
import { sanitizeExternalUrl, wikipediaUrl } from "@/lib/wiki-links";
import type { PostLink, PostWikiTerm } from "@/lib/types";

export type ReferencePostSlice = {
  body: string;
  links: PostLink[];
  wiki_terms: PostWikiTerm[];
};

const WIKI_MARKER_PATTERN = /\[\[([^\]]+)\]\]/g;
const EMBEDDED_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export function extractWikiTermsFromBody(body: string): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(WIKI_MARKER_PATTERN)) {
    const term = match[1]?.trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }

  return terms;
}

export function stripInvalidWikiMarkers(
  body: string,
  invalidTerms: ReadonlySet<string>
): string {
  if (!invalidTerms.size) return body;

  return body.replace(WIKI_MARKER_PATTERN, (match, rawTerm: string) => {
    const term = rawTerm.trim();
    if (!invalidTerms.has(term.toLowerCase())) return match;
    return term;
  });
}

export function stripInvalidEmbeddedLinks(
  body: string,
  invalidUrls: ReadonlySet<string>
): string {
  if (!invalidUrls.size) return body;

  return body.replace(
    EMBEDDED_LINK_PATTERN,
    (match, label: string, rawUrl: string) => {
      const url = sanitizeExternalUrl(rawUrl);
      if (url && invalidUrls.has(url)) return label.trim();
      return match;
    }
  );
}

async function partitionWikiTerms(
  terms: string[]
): Promise<{ valid: PostWikiTerm[]; invalid: Set<string> }> {
  const valid: PostWikiTerm[] = [];
  const invalid = new Set<string>();
  const seen = new Set<string>();

  await Promise.all(
    terms.map(async (term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const exists = await wikiTermPageExists(term, "wikipedia");
      if (exists) {
        valid.push({ term });
      } else {
        invalid.add(key);
      }
    })
  );

  return { valid: valid.slice(0, 4), invalid };
}

async function partitionPostLinks(
  links: PostLink[]
): Promise<{ valid: PostLink[]; invalidUrls: Set<string> }> {
  const valid: PostLink[] = [];
  const invalidUrls = new Set<string>();
  const seen = new Set<string>();

  await Promise.all(
    links.map(async (link) => {
      const url = sanitizeExternalUrl(link.url);
      if (!url || !link.label?.trim()) {
        if (url) invalidUrls.add(url);
        return;
      }
      if (seen.has(url)) return;
      seen.add(url);

      const exists = await externalUrlExists(url);
      if (exists) {
        valid.push({ label: link.label.trim(), url });
      } else {
        invalidUrls.add(url);
      }
    })
  );

  return { valid: valid.slice(0, 3), invalidUrls };
}

async function partitionEmbeddedUrls(
  body: string,
  knownInvalid: ReadonlySet<string>
): Promise<Set<string>> {
  const invalid = new Set<string>();

  await Promise.all(
    [...body.matchAll(EMBEDDED_LINK_PATTERN)].map(async (match) => {
      const url = sanitizeExternalUrl(match[2]);
      if (!url || knownInvalid.has(url) || invalid.has(url)) return;

      const exists = await externalUrlExists(url);
      if (!exists) invalid.add(url);
    })
  );

  return invalid;
}

/**
 * Drop reference links and inline embeds whose target pages do not exist.
 * Wiki [[terms]] with no page are unlinked (plain text).
 */
export async function validateGeneratedPostReferences<
  T extends ReferencePostSlice,
>(post: T): Promise<T> {
  const bodyTerms = extractWikiTermsFromBody(post.body);
  const listedTerms = post.wiki_terms.map((t) => t.term);
  const allTerms = [...bodyTerms, ...listedTerms];

  const { valid: wiki_terms, invalid: invalidWiki } =
    await partitionWikiTerms(allTerms);

  const { valid: links, invalidUrls: invalidSourceUrls } =
    await partitionPostLinks(post.links);

  const invalidEmbedded = await partitionEmbeddedUrls(
    post.body,
    invalidSourceUrls
  );

  const invalidUrls = new Set([...invalidSourceUrls, ...invalidEmbedded]);

  let body = stripInvalidWikiMarkers(post.body, invalidWiki);
  body = stripInvalidEmbeddedLinks(body, invalidUrls);

  let finalLinks = links;
  if (
    finalLinks.length === 0 &&
    wiki_terms[0] &&
    !invalidWiki.has(wiki_terms[0].term.toLowerCase()) &&
    (await wikipediaPageExists(wiki_terms[0].term))
  ) {
    const term = wiki_terms[0].term;
    finalLinks = [{ label: `${term} on Wikipedia`, url: wikipediaUrl(term) }];
  }

  return {
    ...post,
    body,
    links: finalLinks,
    wiki_terms,
  };
}