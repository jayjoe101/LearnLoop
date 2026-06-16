import type { PostLink, PostWikiTerm } from "@/lib/types";

const WIKI_REQUEST_TIMEOUT_MS = 1_400;
const THUMB_SIZE = 640;

export type ImageContext = {
  topic: string;
  title: string;
  links?: PostLink[];
  wiki_terms?: PostWikiTerm[];
};

type WikimediaResponse = {
  query?: {
    pages?: Record<
      string,
      {
        thumbnail?: { source?: string };
        title?: string;
        missing?: boolean;
        index?: number;
      }
    >;
  };
};

function decodeWikiTitle(segment: string): string {
  return decodeURIComponent(segment.replace(/_/g, " ")).trim();
}

/** Pull exact article titles from Wikipedia / Grokipedia URLs in post sources. */
export function extractArticleTitlesFromLinks(links: PostLink[] = []): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    try {
      const url = new URL(link.url);
      const host = url.hostname.replace(/^www\./, "");
      let title: string | null = null;

      if (host.endsWith("wikipedia.org") && url.pathname.startsWith("/wiki/")) {
        title = decodeWikiTitle(url.pathname.slice("/wiki/".length));
      } else if (host === "grokipedia.com" && url.pathname.startsWith("/page/")) {
        title = decodeWikiTitle(url.pathname.slice("/page/".length));
      }

      if (!title || title.toLowerCase() === "main page") continue;

      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      titles.push(title);
    } catch {
      // skip invalid URLs
    }
  }

  return titles;
}

function buildTitleCandidates(ctx: ImageContext): string[] {
  const fromLinks = extractArticleTitlesFromLinks(ctx.links);
  const fromWikiTerms = (ctx.wiki_terms ?? [])
    .map((t) => t.term.trim())
    .filter(Boolean);

  const candidates = [...fromLinks, ...fromWikiTerms];

  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = c.toLowerCase();
    if (!c || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One Wikipedia API round-trip for up to two article titles. */
async function fetchWikipediaImagesBatch(
  titles: string[]
): Promise<string[]> {
  if (titles.length === 0) return [];

  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      titles: titles.slice(0, 2).join("|"),
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: String(THUMB_SIZE),
      redirects: "1",
    });

    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        signal: AbortSignal.timeout(WIKI_REQUEST_TIMEOUT_MS),
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) return [];

    const data = (await response.json()) as WikimediaResponse;
    const urls: string[] = [];

    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.missing) continue;
      const src = page.thumbnail?.source;
      if (src) urls.push(src);
    }

    return urls;
  } catch {
    return [];
  }
}

/** Fast path: best-guess article only, single batched Wikipedia request. */
export async function fetchFirstImageCandidate(
  ctx: ImageContext
): Promise<string | null> {
  const titles = buildTitleCandidates(ctx);
  if (titles.length === 0) return null;

  const urls = await fetchWikipediaImagesBatch(titles.slice(0, 2));
  return urls[0] ?? null;
}

export async function fetchImageCandidates(
  ctx: ImageContext,
  limit = 2
): Promise<string[]> {
  const titles = buildTitleCandidates(ctx).slice(0, limit);
  const urls = await fetchWikipediaImagesBatch(titles);
  return urls.slice(0, limit);
}

export async function fetchRelevantImage(ctx: ImageContext): Promise<string | null> {
  return fetchFirstImageCandidate(ctx);
}