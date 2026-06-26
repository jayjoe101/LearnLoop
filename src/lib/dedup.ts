export function normalizeBody(body: string): string {
  return body
    .toLowerCase()
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentFingerprint(title: string, body: string): string {
  const titleKey = normalizeTitleKey(title);
  const bodyKey = normalizeBody(body).slice(0, 400);
  return `${titleKey}::${bodyKey}`;
}

export function isTooSimilar(title: string, recentTitles: string[]): boolean {
  const normalized = normalizeTitleKey(title);
  if (!normalized) return true;

  return recentTitles.some((recent) => {
    const r = normalizeTitleKey(recent);
    if (!r) return false;
    if (r === normalized) return true;
    if (r.includes(normalized) || normalized.includes(r)) return true;
    const a = new Set(normalized.split(" "));
    const b = new Set(r.split(" "));
    let overlap = 0;
    for (const w of a) {
      if (w.length > 3 && b.has(w)) overlap++;
    }
    return overlap >= 4;
  });
}

export function isDuplicateContent(
  title: string,
  body: string,
  existing: string[]
): boolean {
  const fp = contentFingerprint(title, body);
  return existing.includes(fp);
}

export function appendFingerprint(
  existing: string[],
  title: string,
  body: string
): string[] {
  const fp = contentFingerprint(title, body);
  if (existing.includes(fp)) return existing;
  return [...existing, fp];
}

const BOILERPLATE_MARKERS = [
  "most people overlook how",
  "once you see it, you can't unsee it",
  "worth a minute before you scroll on",
  "the weird truth about how",
  "one of those ideas that sounds simple",
  "textbooks rush past",
  "shows up in more places than you'd expect",
  "stop right before it gets good",
  "feels fuzzy, you're not alone",
  "reputation problem: people treat it like trivia",
  "wilder than it sounds",
  "the part everyone hand-waves",
  "actually works like this",
  "explained without the fluff",
  "nobody tells you this about",
  "interesting world of",
  "something cool about",
  "fascinating field of",
];

/** Detect templated fallback posts that only swap the subject name. */
export function isBoilerplatePost(title: string, body: string): boolean {
  const combined = `${title} ${body}`.toLowerCase();
  const hits = BOILERPLATE_MARKERS.filter((m) => combined.includes(m)).length;
  return hits >= 2;
}