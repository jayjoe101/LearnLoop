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
  "the naive story hides the constraint",
  "how they connect",
  "forms the chain step by step",
  "forces the shift because",
  "is the variable that makes the difference",
  "sets the constraint",
  "determines what happens next",
  "frames the answer to",
  "is the concept that makes this precise",
  "lesser-known example within",
];

const BOILERPLATE_STRUCTURES = [
  /\bthe reason:\s*\*[^*]+\*\s*forces the shift\b/i,
  /\*\w+\*\s*and\s*\*\w+\*\s*form the chain\b/i,
  /\band\s+\w+\s+and\s+\w+:\s*how they connect\b/i,
  /\bremember:\s*==the trigger is\b/i,
];

/** Detect templated posts that only swap keywords into fixed frames. */
export function isBoilerplatePost(title: string, body: string): boolean {
  const combined = `${title} ${body}`.toLowerCase();
  const markerHits = BOILERPLATE_MARKERS.filter((m) => combined.includes(m)).length;
  if (markerHits >= 1) return true;
  return BOILERPLATE_STRUCTURES.some((pattern) => pattern.test(combined));
}