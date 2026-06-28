import {
  resolveCanonicalExternalUrl,
  resolveGrokipediaCanonicalUrl,
  wikiTermPageExists,
  wikipediaPageExists,
} from "@/lib/link-exists";
import {
  sanitizeExternalUrl,
  wikipediaUrl,
  type WikiSource,
} from "@/lib/wiki-links";
import type { PostLink, PostWikiTerm } from "@/lib/types";

export type ReferencePostSlice = {
  body: string;
  links: PostLink[];
  wiki_terms: PostWikiTerm[];
};

export type ValidateReferencesOptions = {
  wikiSource?: WikiSource;
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

function rewriteEmbeddedLinkUrl(
  body: string,
  originalUrl: string,
  canonicalUrl: string
): string {
  if (originalUrl === canonicalUrl) return body;

  return body.replace(
    EMBEDDED_LINK_PATTERN,
    (match, label: string, rawUrl: string) => {
      const url = sanitizeExternalUrl(rawUrl);
      if (url === originalUrl) {
        return `[${label}](${canonicalUrl})`;
      }
      return match;
    }
  );
}

async function partitionWikiTerms(
  terms: string[],
  wikiSource: WikiSource
): Promise<{ valid: PostWikiTerm[]; invalid: Set<string> }> {
  const valid: PostWikiTerm[] = [];
  const invalid = new Set<string>();
  const seen = new Set<string>();

  await Promise.all(
    terms.map(async (term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const exists = await wikiTermPageExists(term, wikiSource);
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

      const canonical = await resolveCanonicalExternalUrl(url);
      if (!canonical) {
        invalidUrls.add(url);
        return;
      }
      if (seen.has(canonical)) return;
      seen.add(canonical);

      valid.push({ label: link.label.trim(), url: canonical });
    })
  );

  return { valid: valid.slice(0, 3), invalidUrls };
}

async function partitionEmbeddedUrls(
  body: string,
  knownInvalid: ReadonlySet<string>
): Promise<{
  invalid: Set<string>;
  rewrites: Array<{ from: string; to: string }>;
}> {
  const invalid = new Set<string>();
  const rewrites: Array<{ from: string; to: string }> = [];

  await Promise.all(
    [...body.matchAll(EMBEDDED_LINK_PATTERN)].map(async (match) => {
      const url = sanitizeExternalUrl(match[2]);
      if (!url || knownInvalid.has(url) || invalid.has(url)) return;

      const canonical = await resolveCanonicalExternalUrl(url);
      if (!canonical) {
        invalid.add(url);
        return;
      }

      if (canonical !== url) {
        rewrites.push({ from: url, to: canonical });
      }
    })
  );

  return { invalid, rewrites };
}

/**
 * Drop reference links and inline embeds whose target pages do not exist.
 * Wiki [[terms]] with no page are unlinked (plain text).
 */
export async function validateGeneratedPostReferences<
  T extends ReferencePostSlice,
>(post: T, options: ValidateReferencesOptions = {}): Promise<T> {
  const wikiSource = options.wikiSource ?? "wikipedia";
  const bodyTerms = extractWikiTermsFromBody(post.body);
  const listedTerms = post.wiki_terms.map((t) => t.term);
  const allTerms = [...bodyTerms, ...listedTerms];

  const { valid: wiki_terms, invalid: invalidWiki } =
    await partitionWikiTerms(allTerms, wikiSource);

  const { valid: links, invalidUrls: invalidSourceUrls } =
    await partitionPostLinks(post.links);

  const { invalid: invalidEmbedded, rewrites } = await partitionEmbeddedUrls(
    post.body,
    invalidSourceUrls
  );

  const invalidUrls = new Set([...invalidSourceUrls, ...invalidEmbedded]);

  let body = stripInvalidWikiMarkers(post.body, invalidWiki);
  body = stripInvalidEmbeddedLinks(body, invalidUrls);

  for (const rewrite of rewrites) {
    body = rewriteEmbeddedLinkUrl(body, rewrite.from, rewrite.to);
  }

  let finalLinks = links;
  if (finalLinks.length === 0 && wiki_terms[0]) {
    const term = wiki_terms[0].term;
    const termKey = term.toLowerCase();

    if (!invalidWiki.has(termKey)) {
      if (wikiSource === "grokipedia") {
        const url = await resolveGrokipediaCanonicalUrl(term);
        if (url) {
          finalLinks = [{ label: `${term} on Grokipedia`, url }];
        }
      } else if (await wikipediaPageExists(term)) {
        finalLinks = [{ label: `${term} on Wikipedia`, url: wikipediaUrl(term) }];
      }
    }
  }

  return {
    ...post,
    body,
    links: finalLinks,
    wiki_terms,
  };
}