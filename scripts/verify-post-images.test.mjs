import { test } from "node:test";
import assert from "node:assert/strict";

const {
  POST_IMAGE_ATTEMPT_CHANCE,
  shouldAttemptPostImage,
} = await import("../src/lib/post-images.ts");

const {
  fetchImageCandidates,
  isAllowedImageUrl,
} = await import("../src/lib/images.ts");

test("about one third of posts attempt images", () => {
  assert.equal(POST_IMAGE_ATTEMPT_CHANCE, 1 / 3);
  let attempts = 0;
  for (let i = 0; i < 3000; i++) {
    if (shouldAttemptPostImage()) attempts++;
  }
  const rate = attempts / 3000;
  assert.ok(rate > 0.25 && rate < 0.41, `expected ~0.33 got ${rate}`);
});

test("fetchImageCandidates returns allowed wikimedia thumbnails", async () => {
  const urls = await fetchImageCandidates(
    {
      topic: "Astronomy",
      title: "Why neutron stars are so dense",
      subject: "Neutron star",
      wiki_terms: [{ term: "Neutron star" }],
      links: [
        {
          label: "Neutron star",
          url: "https://en.wikipedia.org/wiki/Neutron_star",
        },
      ],
    },
    2
  );
  assert.ok(urls.length >= 1);
  for (const url of urls) {
    assert.ok(isAllowedImageUrl(url));
    assert.ok(!url.toLowerCase().includes(".webm"));
  }
});