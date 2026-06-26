import { wikipediaUrl } from "@/lib/wiki-links";
import {
  isOffTopicTeachingSentence,
  isOffTopicWikiTitle,
  scoreSentenceForTeachingGoal,
  parseTeachingGoal,
} from "@/lib/teaching-intent";
import { extractSubjectKeywords } from "@/lib/teaching-validate";

export type WikiSummary = {
  title: string;
  extract: string;
  url: string;
};

const WIKI_HEADERS = {
  Accept: "application/json",
  "User-Agent": "LearnLoop/1.0 (educational feed bot)",
};

const summaryCache = new Map<string, WikiSummary | null>();
const fullExtractCache = new Map<string, string | null>();
const searchCache = new Map<string, string[]>();
const subjectCandidatesCache = new Map<string, WikiSummary[]>();

const PLACEHOLDER_PATTERNS = [
  /^a specific, lesser-known example within\b/i,
  /^an? (interesting|specific|lesser-known) (example|topic|concept) (within|in|about)\b/i,
  /^something (interesting|specific) (about|in|within)\b/i,
  /^a topic (within|in|about)\b/i,
];

export function isPlaceholderSubject(subject: string, topic?: string): boolean {
  const trimmed = subject.trim();
  if (trimmed.length < 12) return true;
  if (PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed))) return true;

  if (topic) {
    const topicLower = topic.toLowerCase().trim();
    const subjectLower = trimmed.toLowerCase();
    if (
      subjectLower === topicLower ||
      subjectLower === `a specific, lesser-known example within ${topicLower}`
    ) {
      return true;
    }
  }

  return false;
}

function slugifyTitle(title: string): string {
  return title.replace(/ /g, "_");
}

const SEARCH_STOP =
  /^(how|why|what|when|where|the|and|for|that|with|from|into|after|before|during|while|because|since|until|than|then|also|just|only|even|still|already|very|much|many|some|any|each|every|both|such|more|most|less|least|other|another|same|different|like|unlike|using|used|they|them|their|avoid|backs|back|off|does|can|will|are|was|were|have|has|had|your|this|these|those|about|through|between|within|without)$/i;

function extractSubjectAcronyms(subject: string): string[] {
  return [
    ...(subject.match(/\b[A-Z]{2,}\b/g) ?? []),
    ...(subject.match(/\b[A-Z][a-z]?[A-Z][A-Za-z]*\b/g) ?? []),
  ].map((token) => token.toLowerCase());
}

function extractSearchTokens(subject: string): string[] {
  const acronyms = new Set(extractSubjectAcronyms(subject));
  const raw = subject
    .replace(/\?$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");

  const tokens = new Set<string>();
  for (const chunk of raw.split(/\s+/)) {
    if (!chunk) continue;
    if (acronyms.has(chunk)) {
      tokens.add(chunk);
      continue;
    }
    if (SEARCH_STOP.test(chunk)) continue;
    tokens.add(chunk);
    for (const part of chunk.split("-")) {
      if (part.length > 2 && !SEARCH_STOP.test(part)) tokens.add(part);
      if (acronyms.has(part)) tokens.add(part);
    }
  }
  return [...tokens];
}

function extractSearchPhrases(subject: string): string[] {
  const stripped = subject.replace(/\?$/g, "").replace(/^(how|why|what|when)\s+/i, "").trim();
  const tokens = extractSearchTokens(subject);
  const phrases: string[] = [];

  if (stripped.length > 8) phrases.push(stripped);

  for (const compound of subject.match(/\b[\w]+(?:-[\w]+)+\b/g) ?? []) {
    phrases.push(compound.replace(/-/g, " "));
    if (tokens.length >= 2) {
      phrases.push(`${tokens[0]} ${tokens[1]} ${compound.replace(/-/g, " ")}`);
    }
  }

  const meaningful = tokens.filter((t) => t.length > 2);
  for (let i = 0; i < meaningful.length - 1; i++) {
    phrases.push(`${meaningful[i]} ${meaningful[i + 1]}`);
    if (i + 2 < meaningful.length) {
      phrases.push(`${meaningful[i]} ${meaningful[i + 1]} ${meaningful[i + 2]}`);
    }
  }

  if (tokens.length >= 2) phrases.push(tokens.slice(0, 4).join(" "));
  if (tokens.length >= 2) phrases.push(tokens.join(" "));

  const seen = new Set<string>();
  return phrases.filter((q) => q.length > 6 && !seen.has(q) && seen.add(q));
}

function buildSubjectSearchQueries(subject: string): string[] {
  const phrases = extractSearchPhrases(subject);
  const acronyms = extractSubjectAcronyms(subject);
  const tokens = extractSearchTokens(subject);
  const boosted: string[] = [];

  for (const acronym of acronyms) {
    const upper = acronym.toUpperCase();
    if (tokens.length >= 2) {
      boosted.push(`${upper} ${tokens.slice(0, 4).join(" ")}`);
      boosted.push(`${upper} ${tokens.slice(0, 2).join(" ")}`);
    }
    for (const phrase of phrases.slice(0, 4)) {
      boosted.push(`${upper} ${phrase}`);
    }
  }

  const seen = new Set<string>();
  return [...boosted, ...phrases]
    .filter((q) => q.length > 6 && !seen.has(q) && seen.add(q))
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);
}

function keywordHitsInText(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => {
    const variants = [kw, kw.replace(/-/g, " "), kw.replace(/-/g, "")];
    return variants.some((v) => v.length > 3 && lower.includes(v));
  }).length;
}

function scoreCandidateRelevance(
  title: string,
  extract: string,
  subject: string
): number {
  const keywords = [
    ...extractSubjectKeywords(subject),
    ...extractSubjectAcronyms(subject),
  ];
  const titleLower = title.toLowerCase();
  const extractHits = keywordHitsInText(extract, keywords);
  const titleHits = keywordHitsInText(title, keywords);

  const acronyms = extractSubjectAcronyms(subject);
  const titleHasAcronym = acronyms.some((ac) => titleLower.includes(ac));
  const extractHasAcronym = acronyms.some((ac) => extract.toLowerCase().includes(ac));

  let hits = extractHits + titleHits * 1.2;

  if (isOffTopicWikiTitle(title, subject)) hits -= 20;
  if (titleHits >= 2) hits += titleHits * 1.5;
  if (titleHits === 0 && keywords.length >= 3) hits -= 4;
  if (extractHits >= 3 && titleHits === 0) hits -= 5;
  if (title.length < 14 && titleHits < 2) hits -= 2;
  if (acronyms.length > 0 && !titleHasAcronym && !extractHasAcronym) hits -= 8;
  if (acronyms.length > 0 && titleHasAcronym) hits += 4;
  const wantsSlowStart =
    keywords.some((kw) => kw.includes("slow")) &&
    keywords.some((kw) => kw === "start" || kw.includes("start"));
  if (
    wantsSlowStart &&
    /\bslow\b/i.test(extract) &&
    /\bstart\b/i.test(extract)
  ) {
    hits += 6;
  }
  if (/\bidiom\b/i.test(extract)) hits -= 15;
  if (/\bwestwood\b/i.test(titleLower) && !subject.toLowerCase().includes("westwood")) {
    hits -= 10;
  }

  const stripped = subject.replace(/\?$/g, "").replace(/^(how|why|what|when)\s+/i, "").trim();
  const anchor = stripped.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
  if (anchor.length > 10 && titleLower.includes(anchor.slice(0, Math.min(anchor.length, 24)))) {
    hits += 3;
  }

  return hits;
}

export async function searchWikipediaTitles(
  query: string,
  limit = 10
): Promise<string[]> {
  const cacheKey = `${query}::${limit}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey)!;

  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }

    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?${params.toString()}`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(8_000) }
      );
      if (!response.ok) continue;

      const data = (await response.json()) as {
        query?: { search?: Array<{ title?: string }> };
      };
      const titles = (data.query?.search ?? [])
        .map((item) => item.title?.trim() ?? "")
        .filter(Boolean);

      if (titles.length > 0) {
        searchCache.set(cacheKey, titles);
      }
      return titles;
    } catch {
      /* retry */
    }
  }

  return [];
}

export async function fetchWikipediaSummary(
  term: string
): Promise<WikiSummary | null> {
  if (summaryCache.has(term)) return summaryCache.get(term)!;

  const slug = slugifyTitle(term);

  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      {
        headers: WIKI_HEADERS,
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!response.ok) return null;

    const data = (await response.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };

    const extract = data.extract?.trim() ?? "";
    const title = data.title?.trim() ?? term;
    if (extract.length < 40) return null;

    const result = {
      title,
      extract,
      url: data.content_urls?.desktop?.page ?? wikipediaUrl(title),
    };
    summaryCache.set(term, result);
    return result;
  } catch {
    summaryCache.set(term, null);
    return null;
  }
}

function subjectNeedsRicherExtract(subject: string, extract: string): boolean {
  if (extract.length < 1500) return true;
  return !extractCoversSubject(subject, extract);
}

async function enrichCandidateExtract(
  title: string,
  extract: string,
  subject: string
): Promise<string> {
  if (!subjectNeedsRicherExtract(subject, extract)) return extract;

  const full = await fetchWikipediaFullExtract(title);
  if (full && full.length > extract.length) return full;
  if (extract.length >= 900) return extract;
  const sectionSearch = await searchWithExtracts(title, subject, 3);
  const richest = sectionSearch.find((entry) => entry.title === title);
  if (richest && richest.extract.length > extract.length) return richest.extract;
  return extract;
}

async function fetchWikipediaFullExtract(title: string): Promise<string | null> {
  const cached = fullExtractCache.get(title);
  if (cached) return cached;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    prop: "extracts",
    explaintext: "1",
    exsectionformat: "plain",
    exchars: "1200",
    titles: title,
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?${params.toString()}`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(14_000) }
      );
      if (response.status === 429) continue;
      if (!response.ok) continue;

      const data = (await response.json()) as {
        query?: { pages?: Record<string, { extract?: string }> };
      };
      const pages = data.query?.pages ?? {};
      const extract = Object.values(pages)[0]?.extract?.trim() ?? "";
      if (extract.length > 80) {
        fullExtractCache.set(title, extract);
        return extract;
      }
    } catch {
      /* retry */
    }
  }

  return null;
}

async function searchWithExtracts(
  query: string,
  subject: string,
  limit = 8
): Promise<WikiSummary[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: "pageprops|extracts|info",
    inprop: "url",
    ppprop: "disambiguation",
    redirects: "1",
    explaintext: "1",
    exintro: "false",
    exsectionformat: "plain",
    exchars: "12000",
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }

    try {
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?${params.toString()}`,
        { headers: WIKI_HEADERS, signal: AbortSignal.timeout(16_000) }
      );
      if (response.status === 429) continue;
      if (!response.ok) continue;

      const data = (await response.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              extract?: string;
              fullurl?: string;
              pageprops?: { disambiguation?: string };
            }
          >;
        };
      };

      const pages = data.query?.pages ?? {};
      const pageList = Object.values(pages).filter((page) => {
        if (page.pageprops?.disambiguation) return false;
        const title = page.title?.trim() ?? "";
        const extract = page.extract?.trim() ?? "";
        return Boolean(title && extract.length >= 200);
      });

      const results = await Promise.all(
        pageList.map(async (page) => {
          const title = page.title!.trim();
          const extract = page.extract!.trim();
          const enriched = await enrichCandidateExtract(title, extract, subject);
          return {
            title,
            extract: enriched,
            url: page.fullurl ?? wikipediaUrl(title),
          };
        })
      );

      return results;
    } catch {
      /* retry */
    }
  }

  return [];
}

function mergeCandidateBatches(
  batches: WikiSummary[][],
  subject: string
): WikiSummary[] {
  const seen = new Set<string>();
  const candidates: WikiSummary[] = [];

  for (const batch of batches) {
    for (const entry of batch) {
      if (seen.has(entry.title)) continue;
      seen.add(entry.title);
      candidates.push(entry);
      if (seen.size >= 12) break;
    }
    if (seen.size >= 12) break;
  }

  return candidates.sort(
    (a, b) =>
      scoreCandidateRelevance(b.title, b.extract, subject) -
      scoreCandidateRelevance(a.title, a.extract, subject)
  );
}

async function collectSubjectCandidates(subject: string): Promise<WikiSummary[]> {
  const queries = buildSubjectSearchQueries(subject).slice(0, 3);
  const batches = await Promise.all(
    queries.map((query) => searchWithExtracts(query, subject, 8))
  );
  return mergeCandidateBatches(batches, subject);
}

async function collectSubjectCandidatesSequential(
  subject: string
): Promise<WikiSummary[]> {
  const queries = buildSubjectSearchQueries(subject).slice(0, 3);
  const batches: WikiSummary[][] = [];

  for (let q = 0; q < queries.length; q++) {
    if (q > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    batches.push(await searchWithExtracts(queries[q], subject, 8));
  }

  return mergeCandidateBatches(batches, subject);
}

export async function resolveSubjectWikipediaSummary(
  subject: string
): Promise<WikiSummary | null> {
  const listed = await resolveSubjectWikipediaCandidates(subject);
  return listed[0] ?? null;
}

export async function resolveSubjectWikipediaCandidates(
  subject: string
): Promise<WikiSummary[]> {
  const cacheKey = subject.toLowerCase().trim();
  if (subjectCandidatesCache.has(cacheKey)) {
    const cached = subjectCandidatesCache.get(cacheKey)!;
    if (cached.length > 0) return cached;
    subjectCandidatesCache.delete(cacheKey);
  }

  let candidates = await collectSubjectCandidates(subject);
  if (candidates.length === 0) {
    candidates = await collectSubjectCandidatesSequential(subject);
  }

  const titleGuesses = new Set<string>();
  for (const acronym of extractSubjectAcronyms(subject)) {
    const upper = acronym.toUpperCase();
    const tokens = extractSearchTokens(subject);
    if (tokens.length >= 2) {
      titleGuesses.add(`${upper} ${tokens.slice(0, 2).join(" ")}`);
    }
    titleGuesses.add(`${upper} congestion control`);
    if (tokens.some((token) => token === "loss" || token === "packet")) {
      titleGuesses.add(`${upper} global synchronization`);
    }
  }
  for (const phrase of extractSearchPhrases(subject).slice(0, 6)) {
    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;

    titleGuesses.add(
      words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    );
    if (words.length > 2) {
      titleGuesses.add(
        words
          .slice(0, 2)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      );
    }
  }

  const directLookups = await Promise.all(
    [...titleGuesses].slice(0, 8).map(async (titleGuess) => {
      const direct = await fetchWikipediaSummary(titleGuess);
      if (!direct || isOffTopicWikiTitle(direct.title, subject)) return null;
      const enriched = await enrichCandidateExtract(
        direct.title,
        direct.extract,
        subject
      );
      return { ...direct, extract: enriched };
    })
  );
  for (const entry of directLookups) {
    if (!entry || candidates.some((c) => c.title === entry.title)) continue;
    candidates.push(entry);
  }

  const supplementalQueries = buildSubjectSearchQueries(subject).slice(0, 2);
  const supplementalTitles = (
    await Promise.all(
      supplementalQueries.map((query) => searchWikipediaTitles(query, 4))
    )
  )
    .flat()
    .filter((title) => !isOffTopicWikiTitle(title, subject))
    .slice(0, 4);

  const supplementalLookups = await Promise.all(
    supplementalTitles.map(async (title) => {
      const direct = await fetchWikipediaSummary(title);
      if (!direct) return null;
      const enriched = await enrichCandidateExtract(
        direct.title,
        direct.extract,
        subject
      );
      return { ...direct, extract: enriched };
    })
  );
  for (const entry of supplementalLookups) {
    if (!entry || candidates.some((c) => c.title === entry.title)) continue;
    candidates.push(entry);
  }

  candidates = candidates.filter((candidate) => {
    if (isOffTopicWikiTitle(candidate.title, subject)) return false;
    return scoreCandidateRelevance(candidate.title, candidate.extract, subject) > -5;
  });

  if (candidates.length > 1) {
    candidates.sort(
      (a, b) =>
        scoreCandidateRelevance(b.title, b.extract, subject) -
        scoreCandidateRelevance(a.title, a.extract, subject)
    );
  }

  const topScore =
    candidates.length > 0
      ? scoreCandidateRelevance(
          candidates[0].title,
          candidates[0].extract,
          subject
        )
      : 0;

  if (candidates.length > 0 && topScore > 0) {
    subjectCandidatesCache.set(cacheKey, candidates);
  }

  return candidates;
}

function splitWikiSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function scoreSentenceForMerge(sentence: string, subject: string): number {
  if (isOffTopicTeachingSentence(sentence)) return -10;
  const goal = parseTeachingGoal(subject);
  return scoreSentenceForTeachingGoal(sentence, goal);
}

/** Does the extract mention enough subject keywords to compose from? */
export function extractCoversSubject(subject: string, extract: string): boolean {
  const keywords = extractSubjectKeywords(subject);
  if (keywords.length === 0) return extract.length > 200;

  const lower = extract.toLowerCase();
  const matched = keywords.filter((kw) => {
    const variants = [kw, kw.replace(/-/g, " "), kw.replace(/-/g, "")];
    return variants.some((v) => v.length > 3 && lower.includes(v));
  }).length;

  return matched >= Math.max(2, Math.ceil(keywords.length * 0.45));
}

/** Merge the best sentences from ranked candidates into one teaching extract. */
export function mergeCandidateExtracts(
  subject: string,
  candidates: WikiSummary[],
  startIndex = 0
): string {
  const pool: { sentence: string; score: number }[] = [];
  const topCandidate = [...candidates].sort(
    (a, b) =>
      scoreCandidateRelevance(b.title, b.extract, subject) -
      scoreCandidateRelevance(a.title, a.extract, subject)
  )[0];
  if (topCandidate) {
    for (const sentence of splitWikiSentences(topCandidate.extract).slice(0, 2)) {
      pool.push({
        sentence,
        score: 50 + scoreSentenceForMerge(sentence, subject),
      });
    }
  }

  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      relevance: scoreCandidateRelevance(
        candidate.title,
        candidate.extract,
        subject
      ),
    }))
    .filter((entry) => entry.relevance >= 1)
    .sort((a, b) => b.relevance - a.relevance);

  const mergeSet =
    ranked.length > 0
      ? ranked.slice(0, 4)
      : candidates.slice(startIndex, startIndex + 2).map((candidate, offset) => ({
          candidate,
          index: startIndex + offset,
          relevance: scoreCandidateRelevance(
            candidate.title,
            candidate.extract,
            subject
          ),
        }));

  for (const { candidate, relevance } of mergeSet) {
    const sentences = splitWikiSentences(candidate.extract);
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const primaryBoost = relevance >= 4 && i < 2 ? 2.5 : 0;
      pool.push({
        sentence,
        score: scoreSentenceForMerge(sentence, subject) + relevance * 0.35 + primaryBoost,
      });
    }
  }

  pool.sort((a, b) => b.score - a.score);
  const picked: string[] = [];
  const seen = new Set<string>();

  for (const item of pool) {
    const key = item.sentence.toLowerCase().slice(0, 90);
    if (seen.has(key) || item.score < 0.5) continue;
    seen.add(key);
    picked.push(item.sentence);
    if (picked.length >= 6) break;
  }

  return picked.join(" ");
}

export async function discoverWikipediaSubject(
  topic: string,
  seed: number,
  avoidSubjects: string[]
): Promise<string | null> {
  const avoid = new Set(
    avoidSubjects.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim())
  );

  const queries = [
    `${topic} mechanism`,
    `${topic} discovery`,
    `${topic} paradox`,
    `${topic} experiment`,
    topic,
  ];

  const titleBatches = await Promise.all(
    queries.map((_, q) =>
      searchWikipediaTitles(queries[(seed + q) % queries.length], 12)
    )
  );

  for (let q = 0; q < titleBatches.length; q++) {
    const titles = titleBatches[q];
    for (let i = 0; i < titles.length; i++) {
      const title = titles[(seed + i) % titles.length];
      const key = title.toLowerCase();
      if (avoid.has(key)) continue;
      if (key === topic.toLowerCase()) continue;
      if (title.length < 4 || title.length > 80) continue;

      return title;
    }
  }

  return null;
}