import { test } from "node:test";
import assert from "node:assert/strict";

const {
  stripInvalidWikiMarkers,
  stripInvalidEmbeddedLinks,
  extractWikiTermsFromBody,
  validateGeneratedPostReferences,
} = await import("../src/lib/validate-post-references.ts");

const {
  wikipediaPageExists,
  externalUrlExists,
  clearLinkExistenceCache,
} = await import("../src/lib/link-exists.ts");

test("stripInvalidWikiMarkers removes brackets for invalid terms only", () => {
  const body = "See [[Photosynthesis]] and [[NotARealPageZZZ99]] for context.";
  const stripped = stripInvalidWikiMarkers(
    body,
    new Set(["notarealpagezzz99"])
  );
  assert.match(stripped, /\[\[Photosynthesis\]\]/);
  assert.ok(!stripped.includes("[[NotARealPageZZZ99]]"));
  assert.match(stripped, /NotARealPageZZZ99/);
});

test("stripInvalidEmbeddedLinks keeps label when url is invalid", () => {
  const dead =
    "https://en.wikipedia.org/wiki/ThisArticleDefinitelyDoesNotExistZZZ_99999";
  const body = `Read [Photosynthesis](https://en.wikipedia.org/wiki/Photosynthesis) and [missing](${dead}) next.`;
  const stripped = stripInvalidEmbeddedLinks(body, new Set([dead]));
  assert.match(stripped, /\[Photosynthesis\]\(/);
  assert.match(stripped, /missing next\./);
  assert.ok(!stripped.includes(dead));
});

test("extractWikiTermsFromBody deduplicates terms", () => {
  const terms = extractWikiTermsFromBody(
    "[[Gravity]] affects [[mass]] and [[gravity]] again."
  );
  assert.deepEqual(terms, ["Gravity", "mass"]);
});

test("wikipediaPageExists accepts real articles and rejects missing titles", async () => {
  clearLinkExistenceCache();
  assert.equal(await wikipediaPageExists("Photosynthesis"), true);
  assert.equal(
    await wikipediaPageExists("ThisArticleDefinitelyDoesNotExistZZZ_99999"),
    false
  );
});

test("validateGeneratedPostReferences drops dead wiki terms and source links", async () => {
  clearLinkExistenceCache();
  const result = await validateGeneratedPostReferences({
    body: "Learn [[Photosynthesis]] and [[FakePageZZZ_99999]] today. Also [missing](https://en.wikipedia.org/wiki/ThisArticleDefinitelyDoesNotExistZZZ_99999).",
    links: [
      {
        label: "Photosynthesis on Wikipedia",
        url: "https://en.wikipedia.org/wiki/Photosynthesis",
      },
      {
        label: "Missing page",
        url: "https://en.wikipedia.org/wiki/ThisArticleDefinitelyDoesNotExistZZZ_99999",
      },
    ],
    wiki_terms: [
      { term: "Photosynthesis" },
      { term: "FakePageZZZ_99999" },
    ],
  });

  assert.ok(result.wiki_terms.some((t) => t.term === "Photosynthesis"));
  assert.ok(!result.wiki_terms.some((t) => t.term.includes("FakePage")));
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].url.includes("Photosynthesis"), true);
  assert.match(result.body, /\[\[Photosynthesis\]\]/);
  assert.ok(!result.body.includes("[[FakePageZZZ_99999]]"));
  assert.ok(!result.body.includes("ThisArticleDefinitelyDoesNotExistZZZ_99999"));
});

test("externalUrlExists accepts live wikipedia urls", async () => {
  clearLinkExistenceCache();
  const ok = await externalUrlExists(
    "https://en.wikipedia.org/wiki/Neutron_star"
  );
  assert.equal(ok, true);
});