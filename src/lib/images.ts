const WIKIMEDIA_TIMEOUT_MS = 3_000;
const SYNC_IMAGE_BUDGET_MS = 2_800;

type WikimediaResponse = {
  query?: {
    pages?: Record<
      string,
      { thumbnail?: { source?: string }; title?: string }
    >;
  };
};

export function buildImageSearchQueries(topic: string, title: string): string[] {
  const titleWords = title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(" ");

  const topicWords = topic.replace(/[^\w\s]/g, " ").trim();

  return [...new Set([`${topicWords} ${titleWords}`.trim(), topicWords, titleWords])].filter(
    Boolean
  );
}

async function fetchCommonsImage(search: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: `filetype:bitmap ${search}`,
      gsrnamespace: "6",
      gsrlimit: "5",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "900",
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
    for (const page of Object.values(data.query?.pages ?? {})) {
      const src = page.thumbnail?.source;
      if (src) return src;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchWikipediaArticleImage(search: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: search,
      gsrlimit: "3",
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "900",
    });

    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        signal: AbortSignal.timeout(WIKIMEDIA_TIMEOUT_MS),
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as WikimediaResponse;
    for (const page of Object.values(data.query?.pages ?? {})) {
      const src = page.thumbnail?.source;
      if (src) return src;
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchRelevantImage(
  topic: string,
  title: string
): Promise<string | null> {
  const queries = buildImageSearchQueries(topic, title);

  for (const query of queries) {
    const commons = await fetchCommonsImage(query);
    if (commons) return commons;
  }

  for (const query of queries) {
    const wiki = await fetchWikipediaArticleImage(query);
    if (wiki) return wiki;
  }

  return null;
}

export async function resolvePostImage(
  topic: string,
  title: string,
  budgetMs = SYNC_IMAGE_BUDGET_MS
): Promise<string | null> {
  return Promise.race([
    fetchRelevantImage(topic, title),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
  ]);
}