/** Human-paced intervals — ~2–3 posts/minute with natural jitter. */
export function nextLiveDelayMs(): number {
  const roll = Math.random();

  if (roll < 0.08) {
    return 48_000 + Math.floor(Math.random() * 27_000);
  }
  if (roll < 0.22) {
    return 15_000 + Math.floor(Math.random() * 9_000);
  }

  return 21_000 + Math.floor(Math.random() * 18_000);
}

/** Random cap for queued posts before generation pauses (4–11). */
export function randomPendingPostLimit(): number {
  return 4 + Math.floor(Math.random() * 8);
}

export type LiveSessionContext = {
  recentTitles: string[];
  recentFingerprints: string[];
  postCountOffset: number;
};