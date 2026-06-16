import type { PostLink, PostWikiTerm } from "@/lib/types";

const WIKI_REQUEST_TIMEOUT_MS = 2_500;
const THUMB_SIZE = 800;

export type ImageContext = {
  topic: string;
  title: string;
  subject?: string;
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

type CommonsResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: Array<{ thumburl?: string; url?: string }>;
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

  const subject = ctx.subject?.trim();

  const candidates = [
    ...(subject ? [subject] : []),
    ...fromLinks,
    ...fromWikiTerms,
    ctx.topic.replace(/[^\w\s&+-]/g, " ").trim(),
  ];

  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = c.toLowerCase();
    if (!c || c.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSearchQuery(ctx: ImageContext): string {
  const subject = ctx.subject?.trim();
  if (subject) return subject;

  const wikiTerm = ctx.wiki_terms?.[0]?.term?.trim();
  if (wikiTerm) return wikiTerm;

  const linkTitle = extractArticleTitlesFromLinks(ctx.links)[0];
  if (linkTitle) return linkTitle;

  const titleWords = ctx.title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4)
    .join(" ");

  return titleWords || ctx.topic;
}

async function fetchWikipediaImagesBatch(
  titles: string[]
): Promise<string[]> {
  if (titles.length === 0) return [];

  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      titles: titles.slice(0, 3).join("|"),
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
      pithumbsize: String(THUMB_SIZE),
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

function isLikelyDecorativeCommonsFile(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes("icon") ||
    lower.includes("logo") ||
    lower.includes("pictogram")
  );
}

/** Wikimedia Commons search — many Wikipedia articles have no lead image. */
async function fetchCommonsSearchImages(
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
      gsrnamespace: "6",
      gsrlimit: String(Math.min(limit * 3, 12)),
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: String(THUMB_SIZE),
    });

    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      {
        signal: AbortSignal.timeout(WIKI_REQUEST_TIMEOUT_MS),
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) return [];

    const data = (await response.json()) as CommonsResponse;
    const urls: string[] = [];

    for (const page of Object.values(data.query?.pages ?? {})) {
      const title = page.title ?? "";
      if (isLikelyDecorativeCommonsFile(title)) continue;

      const src =
        page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url ?? null;
      if (src) urls.push(src);
      if (urls.length >= limit) break;
    }

    return urls;
  } catch {
    return [];
  }
}

function appendUniqueUrls(
  urls: string[],
  seen: Set<string>,
  incoming: string[],
  limit: number
): void {
  for (const url of incoming) {
    if (urls.length >= limit) return;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
}

/** Collect up to 3 unique thumbnails (Wikipedia batch, search, then Commons). */
export async function fetchImageCandidates(
  ctx: ImageContext,
  limit = 3
): Promise<string[]> {
  const titles = buildTitleCandidates(ctx);
  const search = buildSearchQuery(ctx);
  const fromTitles = await fetchWikipediaImagesBatch(titles);

  const seen = new Set<string>();
  const urls: string[] = [];
  appendUniqueUrls(urls, seen, fromTitles, limit);

  if (urls.length < limit) {
    const [fromSearch, fromCommons] = await Promise.all([
      fetchWikipediaSearchImages(search, limit - urls.length),
      fetchCommonsSearchImages(search, limit - urls.length),
    ]);
    appendUniqueUrls(urls, seen, fromSearch, limit);
    appendUniqueUrls(urls, seen, fromCommons, limit);
  }

  return urls.slice(0, limit);
}

export async function fetchFirstImageCandidate(
  ctx: ImageContext
): Promise<string | null> {
  const urls = await fetchImageCandidates(ctx, 1);
  return urls[0] ?? null;
}

export async function fetchRelevantImage(ctx: ImageContext): Promise<string | null> {
  return fetchFirstImageCandidate(ctx);
}