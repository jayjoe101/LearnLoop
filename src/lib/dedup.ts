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