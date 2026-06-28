import {
  sanitizeExternalUrl,
  slugifyWikiTerm,
  type WikiSource,
} from "@/lib/wiki-links";

const CHECK_TIMEOUT_MS = 3_500;
const WIKI_USER_AGENT =
  "LearnLoop/1.0 (educational feed; contact: learnloop-app)";

const existenceCache = new Map<string, boolean>();

function cacheKey(kind: string, value: string): string {
  return `${kind}:${value.toLowerCase()}`;
}

async function remember(
  kind: string,
  value: string,
  check: () => Promise<boolean>
): Promise<boolean> {
  const key = cacheKey(kind, value);
  if (existenceCache.has(key)) return existenceCache.get(key)!;

  const exists = await check();
  existenceCache.set(key, exists);
  return exists;
}

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

function decodeWikiPathSegment(segment: string): string {
  return decodeURIComponent(segment.replace(/_/g, " ")).trim();
}

export function wikipediaTitleFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (!host.endsWith("wikipedia.org") || !parsed.pathname.startsWith("/wiki/")) {
      return null;
    }
    const title = decodeWikiPathSegment(parsed.pathname.slice("/wiki/".length));
    return title && title.toLowerCase() !== "main page" ? title : null;
  } catch {
    return null;
  }
}

export function grokipediaTermFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") !== "grokipedia.com") return null;
    if (!parsed.pathname.startsWith("/page/")) return null;
    return decodeWikiPathSegment(parsed.pathname.slice("/page/".length)) || null;
  } catch {
    return null;
  }
}

export async function wikipediaPageExists(title: string): Promise<boolean> {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length < 2) return false;

  return remember("wikipedia", trimmed, async () => {
    try {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        titles: slugifyWikiTerm(trimmed),
        redirects: "1",
      });

      const response = await wikiFetch(
        `https://en.wikipedia.org/w/api.php?${params}`,
        { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
      );
      if (!response.ok) return false;

      const data = (await response.json()) as {
        query?: {
          pages?: Record<string, { missing?: string; title?: string }>;
        };
      };

      for (const page of Object.values(data.query?.pages ?? {})) {
        if (page.missing !== undefined) return false;
        if (page.title) return true;
      }
      return false;
    } catch {
      return false;
    }
  });
}

function grokipediaSlugCandidates(term: string): string[] {
  const normalized = term.trim().replace(/_/g, " ");
  if (!normalized || normalized.length < 2) return [];

  const words = normalized.split(/\s+/).filter(Boolean);
  const titleUnderscore = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("_");
  const titleSpaces = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  const candidates = new Set<string>();
  if (titleUnderscore) candidates.add(titleUnderscore);
  if (titleSpaces) candidates.add(titleSpaces);
  if (normalized !== titleUnderscore && normalized !== titleSpaces) {
    candidates.add(normalized);
  }
  return [...candidates];
}

async function grokipediaSlugExists(slug: string): Promise<boolean> {
  return remember("grokipedia-slug", slug, async () => {
    try {
      const response = await fetch(
        `https://grokipedia.com/page/${encodeURIComponent(slug)}`,
        {
          method: "HEAD",
          signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
          headers: { "User-Agent": WIKI_USER_AGENT },
          redirect: "follow",
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  });
}

export async function resolveGrokipediaCanonicalUrl(
  term: string
): Promise<string | null> {
  for (const slug of grokipediaSlugCandidates(term)) {
    if (await grokipediaSlugExists(slug)) {
      return `https://grokipedia.com/page/${encodeURIComponent(slug)}`;
    }
  }
  return null;
}

export async function grokipediaPageExists(term: string): Promise<boolean> {
  return (await resolveGrokipediaCanonicalUrl(term)) !== null;
}

export async function wikiTermPageExists(
  term: string,
  source: WikiSource = "wikipedia"
): Promise<boolean> {
  return source === "grokipedia"
    ? grokipediaPageExists(term)
    : wikipediaPageExists(term);
}

export async function resolveCanonicalExternalUrl(
  url: string
): Promise<string | null> {
  const normalized = sanitizeExternalUrl(url);
  if (!normalized) return null;

  const grokTerm = grokipediaTermFromUrl(normalized);
  if (grokTerm) {
    return resolveGrokipediaCanonicalUrl(grokTerm);
  }

  const wikiTitle = wikipediaTitleFromUrl(normalized);
  if (wikiTitle) {
    return (await wikipediaPageExists(wikiTitle)) ? normalized : null;
  }

  return (await externalUrlExists(normalized)) ? normalized : null;
}

export async function externalUrlExists(url: string): Promise<boolean> {
  const normalized = sanitizeExternalUrl(url);
  if (!normalized) return false;

  const wikiTitle = wikipediaTitleFromUrl(normalized);
  if (wikiTitle) return wikipediaPageExists(wikiTitle);

  const grokTerm = grokipediaTermFromUrl(normalized);
  if (grokTerm) return grokipediaPageExists(grokTerm);

  return remember("url", normalized, async () => {
    try {
      const response = await fetch(normalized, {
        method: "HEAD",
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        headers: { "User-Agent": WIKI_USER_AGENT },
        redirect: "follow",
      });
      if (response.status === 405 || response.status === 501) {
        const getResponse = await fetch(normalized, {
          method: "GET",
          signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
          headers: { "User-Agent": WIKI_USER_AGENT },
          redirect: "follow",
        });
        return getResponse.ok;
      }
      return response.ok;
    } catch {
      return false;
    }
  });
}

/** Clear cache between posts in tests or long-running workers. */
export function clearLinkExistenceCache(): void {
  existenceCache.clear();
}