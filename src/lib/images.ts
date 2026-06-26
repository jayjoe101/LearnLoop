import type { PostLink, PostWikiTerm } from "@/lib/types";

const WIKI_REQUEST_TIMEOUT_MS = 3_500;
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
        pageprops?: { disambiguation?: string };
      }
    >;
  };
};

function decodeWikiTitle(segment: string): string {
  return decodeURIComponent(segment.replace(/_/g, " ")).trim();
}

function slugifyTitle(title: string): string {
  return title.replace(/ /g, "_");
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

function condenseSubjectForSearch(subject: string): string {
  const stripped = subject
    .replace(/\?$/g, "")
    .replace(/^(how|why|what|when|where)\s+/i, "")
    .trim();

  const words = stripped
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  return words.join(" ");
}

/** Ordered lookup keys: wiki term → link article → condensed subject → title words. */
export function buildImageLookupQueries(ctx: ImageContext): string[] {
  const fromWikiTerms = (ctx.wiki_terms ?? [])
    .map((t) => t.term.trim())
    .filter(Boolean);
  const fromLinks = extractArticleTitlesFromLinks(ctx.links);
  const subject = ctx.subject?.trim();
  const condensedSubject = subject ? condenseSubjectForSearch(subject) : "";
  const titleWords = ctx.title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4)
    .join(" ");

  const candidates = [
    ...fromWikiTerms,
    ...fromLinks,
    ...(condensedSubject.length > 6 ? [condensedSubject] : []),
    ...(subject && subject.length <= 72 ? [subject] : []),
    ...(titleWords.length > 6 ? [titleWords] : []),
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

async function fetchSummaryThumbnail(query: string): Promise<string | null> {
  const slug = slugifyTitle(query);

  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(WIKI_REQUEST_TIMEOUT_MS),
        next: { revalidate: 86400 },
      }
    );
    if (!response.ok) return null;

    const data = (await response.json()) as {
      thumbnail?: { source?: string };
      type?: string;
    };
    if (data.type === "disambiguation") return null;
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function fetchFirstSearchThumbnail(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: query,
      gsrlimit: "5",
      prop: "pageimages|pageprops",
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
    if (!response.ok) return null;

    const data = (await response.json()) as WikimediaResponse;
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.missing || page.pageprops?.disambiguation) continue;
      const src = page.thumbnail?.source;
      if (src) return src;
    }
  } catch {
    /* no image */
  }

  return null;
}

/**
 * Fast subject-first image lookup: try wiki-linked terms and subject queries,
 * return the first relevant Wikipedia thumbnail found.
 */
export async function fetchPostImageForSubject(
  ctx: ImageContext
): Promise<string | null> {
  const queries = buildImageLookupQueries(ctx);
  if (queries.length === 0) return null;

  for (const query of queries.slice(0, 3)) {
    const direct = await fetchSummaryThumbnail(query);
    if (direct) return direct;
  }

  for (const query of queries.slice(0, 2)) {
    const fromSearch = await fetchFirstSearchThumbnail(query);
    if (fromSearch) return fromSearch;
  }

  return null;
}

/** @deprecated Use fetchPostImageForSubject */
export async function fetchFirstImageCandidate(
  ctx: ImageContext
): Promise<string | null> {
  return fetchPostImageForSubject(ctx);
}

/** @deprecated Use fetchPostImageForSubject */
export async function fetchRelevantImage(ctx: ImageContext): Promise<string | null> {
  return fetchPostImageForSubject(ctx);
}

/** @deprecated Use fetchPostImageForSubject */
export async function fetchImageCandidates(
  ctx: ImageContext,
  _limit = 3
): Promise<string[]> {
  const image = await fetchPostImageForSubject(ctx);
  return image ? [image] : [];
}