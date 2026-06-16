import type { PostLink, PostWikiTerm } from "@/lib/types";

const WIKI_REQUEST_TIMEOUT_MS = 2_000;
/** Brief sync race — post shows immediately; full fetch runs in background. */
export const SYNC_IMAGE_BUDGET_MS = 450;

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
  const topic = ctx.topic.replace(/[^\w\s&+-]/g, " ").trim();

  const candidates = [...fromLinks, ...fromWikiTerms, topic];

  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = c.toLowerCase();
    if (!c || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchWikipediaImageByTitle(title: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      titles: title,
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "900",
      redirects: "1",
    });

    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        signal: AbortSignal.timeout(WIKI_REQUEST_TIMEOUT_MS),
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as WikimediaResponse;
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.missing) continue;
      const src = page.thumbnail?.source;
      if (src) return src;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchWikipediaSearchImages(
  search: string,
  limit = 3
): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: search,
      gsrlimit: String(limit),
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "900",
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
      const src = page.thumbnail?.source;
      if (src) urls.push(src);
    }

    return urls;
  } catch {
    return [];
  }
}

export async function fetchImageCandidates(
  ctx: ImageContext,
  limit = 4
): Promise<string[]> {
  const titles = buildTitleCandidates(ctx).slice(0, limit);
  const fromTitles = await Promise.all(
    titles.map((title) => fetchWikipediaImageByTitle(title))
  );

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const url of fromTitles) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  if (urls.length < limit) {
    const search = titles[0] ?? ctx.title ?? ctx.topic;
    const fromSearch = await fetchWikipediaSearchImages(
      search,
      limit - urls.length
    );
    for (const url of fromSearch) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }

  return urls.slice(0, limit);
}

export async function fetchRelevantImage(ctx: ImageContext): Promise<string | null> {
  const candidates = await fetchImageCandidates(ctx, 3);
  return candidates[0] ?? null;
}

export async function resolvePostImage(
  ctx: ImageContext,
  budgetMs = SYNC_IMAGE_BUDGET_MS
): Promise<string | null> {
  return Promise.race([
    fetchRelevantImage(ctx),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
  ]);
}