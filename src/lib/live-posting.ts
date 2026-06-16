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

export const MAX_PENDING_LIVE_POSTS = 5;

export type LiveSessionContext = {
  recentTitles: string[];
  recentFingerprints: string[];
  postCountOffset: number;
};