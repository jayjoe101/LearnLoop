/** ~1 in 5 posts include an image */
export const IMAGE_INCLUDE_PROBABILITY = 0.2;

const WIKIMEDIA_TIMEOUT_MS = 1_500;

export function shouldIncludeImage(): boolean {
  return Math.random() < IMAGE_INCLUDE_PROBABILITY;
}

export function buildImageSearchQuery(topic: string, title: string): string {
  const titleWords = title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");

  return [topic, titleWords].filter(Boolean).join(" ").trim();
}

type WikimediaResponse = {
  query?: {
    pages?: Record<
      string,
      { thumbnail?: { source?: string }; title?: string }
    >;
  };
};

export async function fetchRelevantImage(
  topic: string,
  title: string
): Promise<string | null> {
  const search = buildImageSearchQuery(topic, title);
  if (!search) return null;

  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: search,
      gsrnamespace: "6",
      gsrlimit: "3",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "800",
    });

    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      {
        signal: AbortSignal.timeout(WIKIMEDIA_TIMEOUT_MS),
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as WikimediaResponse;
    const pages = data.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages)) {
      const src = page.thumbnail?.source;
      if (src) return src;
    }

    return null;
  } catch {
    return null;
  }
}

export async function resolvePostImage(
  topic: string,
  title: string
): Promise<string | null> {
  if (!shouldIncludeImage()) return null;
  return fetchRelevantImage(topic, title);
}