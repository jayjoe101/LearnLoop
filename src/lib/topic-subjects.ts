import type { PostWikiTerm } from "@/lib/types";

const META_TITLE_HOOKS = [
  "not what you think",
  "trick experts",
  "breaks every rule",
  "part nobody talks about",
  "fact changes the whole game",
  "just got weird",
];

function normalizeTopicKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reject posts that describe the interest label itself instead of a subject within it. */
export function isMetaTopicPost(
  title: string,
  body: string,
  topicLabel: string,
  wikiTerms: PostWikiTerm[]
): boolean {
  const topic = normalizeTopicKey(topicLabel);
  if (!topic) return false;

  const combined = `${title} ${body}`.toLowerCase();

  const metaPatterns = [
    `what is ${topic}`,
    `what are ${topic}`,
    `introduction to ${topic}`,
    `overview of ${topic}`,
    `basics of ${topic}`,
    `fundamentals of ${topic}`,
    `field of ${topic}`,
    `world of ${topic}`,
    `discipline of ${topic}`,
    `learn about ${topic}`,
    `getting started with ${topic}`,
    `${topic} as a field`,
    `${topic} as a subject`,
    `${topic} as a discipline`,
    `history of ${topic}`,
  ];

  if (metaPatterns.some((phrase) => combined.includes(phrase))) return true;

  const titleL = title.toLowerCase();
  if (
    META_TITLE_HOOKS.some((hook) => titleL.includes(hook)) &&
    titleL.includes(topic)
  ) {
    return true;
  }

  const topicTokens = topic.split(/\s+/).filter((w) => w.length > 2);
  if (wikiTerms.length > 0 && topicTokens.length > 0) {
    const onlyTopicWiki = wikiTerms.every((t) => {
      const term = normalizeTopicKey(t.term);
      return (
        term === topic ||
        topicTokens.every((tok) => term.includes(tok)) ||
        topic.includes(term)
      );
    });
    if (onlyTopicWiki) return true;
  }

  const bodyL = body.toLowerCase();
  const opensMeta =
    bodyL.startsWith(`researchers and practitioners in [[${topicTokens[0]}]]`) ||
    bodyL.startsWith(`researchers and practitioners in ${topic}`) ||
    bodyL.includes(`in the field of ${topic}`) ||
    bodyL.includes(`in the world of ${topic}`);

  return opensMeta;
}