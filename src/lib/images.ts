import type { PostLink, PostWikiTerm } from "@/lib/types";

const WIKI_REQUEST_TIMEOUT_MS = 4_500;
const THUMB_SIZE = 800;
const WIKI_USER_AGENT =
  "LearnLoop/1.0 (educational feed; contact: learnloop-app)";

function wikiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "User-Agent": WIKI_USER_AGENT,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
}

const ALLOWED_IMAGE_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
] as const;

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

/** Subject-first Wikipedia title lookups for direct thumbnail batch. */
export function buildTitleCandidates(ctx: ImageContext): string[] {
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

/** Subject-led fallback search when exact titles miss thumbnails. */
export function buildSearchQuery(ctx: ImageContext): string {
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

export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    return ALLOWED_IMAGE_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

function isUsableImageUrl(url: string): boolean {
  if (!isAllowedImageUrl(url)) return false;
  const lower = url.toLowerCase();
  if (lower.includes(".webm") || lower.includes("/video/")) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg)/i.test(lower) || lower.includes("/thumb/");
}

function normalizeImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of urls) {
    if (!isUsableImageUrl(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }

  return out;
}

function encodeWikiTitle(title: string): string {
  return encodeURIComponent(title.trim().replace(/ /g, "_"));
}

/** Fast REST summary lookup — often the most reliable thumbnail source. */
async function fetchWikipediaRestThumbnails(
  titles: string[]
): Promise<string[]> {
  const urls: string[] = [];

  for (const title of titles.slice(0, 4)) {
    if (!title.trim()) continue;
    try {
      const response = await wikiFetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeWikiTitle(title)}`,
        { signal: AbortSignal.timeout(WIKI_REQUEST_TIMEOUT_MS) }
      );
      if (!response.ok) continue;

      const data = (await response.json()) as {
        thumbnail?: { source?: string };
      };
      const src = data.thumbnail?.source;
      if (src && isUsableImageUrl(src)) urls.push(src);
    } catch {
      // try next title
    }
  }

  return normalizeImageUrls(urls);
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

    const response = await wikiFetch(
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

    return normalizeImageUrls(urls);
  } catch {
    return [];
  }
}

async function fetchWikipediaSearchImages(
  search: string,
  limit = 3
): Promise<string[]> {
  if (!search.trim()) return [];

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

    const response = await wikiFetch(
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

    return normalizeImageUrls(urls);
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
  if (!search.trim()) return [];

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

    const response = await wikiFetch(
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

    return normalizeImageUrls(urls);
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

/** Collect up to `limit` unique thumbnails — parallel wiki lookups, subject-first merge. */
export async function fetchImageCandidates(
  ctx: ImageContext,
  limit = 3
): Promise<string[]> {
  const titles = buildTitleCandidates(ctx);
  const search = buildSearchQuery(ctx);

  const [fromRest, fromTitles, fromSearch, fromCommons] = await Promise.all([
    fetchWikipediaRestThumbnails(titles),
    fetchWikipediaImagesBatch(titles),
    fetchWikipediaSearchImages(search, limit),
    fetchCommonsSearchImages(search, limit),
  ]);

  const seen = new Set<string>();
  const urls: string[] = [];
  appendUniqueUrls(urls, seen, fromRest, limit);
  appendUniqueUrls(urls, seen, fromTitles, limit);
  appendUniqueUrls(urls, seen, fromSearch, limit);
  appendUniqueUrls(urls, seen, fromCommons, limit);

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

/** @deprecated Use fetchImageCandidates / fetchFirstImageCandidate */
export async function fetchPostImageForSubject(
  ctx: ImageContext
): Promise<string | null> {
  return fetchFirstImageCandidate(ctx);
}

/** @deprecated Use buildTitleCandidates / buildSearchQuery */
export function buildImageLookupQueries(ctx: ImageContext): string[] {
  return buildTitleCandidates(ctx);
}