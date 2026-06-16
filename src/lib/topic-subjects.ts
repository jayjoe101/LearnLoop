import type { PostWikiTerm } from "@/lib/types";

const SUBJECT_POOLS: Record<string, string[]> = {
  "computer science": [
    "how CPU branch predictors guess your code's next jump",
    "why hash table load factor suddenly kills performance",
    "how virtual memory tricks programs into thinking RAM is infinite",
    "the surprising reason quicksort isn't always fastest",
    "how compilers turn code into machine instructions",
    "why floating-point math breaks financial calculators",
  ],
  "computer programming": [
    "how recursion can silently blow the call stack",
    "why immutability makes concurrent code safer",
    "how garbage collectors decide what memory to free",
    "the real cost of premature optimization in hot loops",
    "how debuggers set breakpoints without stopping the CPU",
    "why API design mistakes haunt teams for years",
  ],
  mathematics: [
    "why π appears in problems that have nothing to do with circles",
    "how eigenvalues secretly control system stability",
    "the pigeonhole principle and impossible coincidences",
    "why prime numbers are the locks of modern encryption",
    "how calculus models change with infinitesimal steps",
    "the Banach-Tarski paradox and volume duplication",
  ],
  statistics: [
    "why p-values are widely misread even by scientists",
    "how Simpson's paradox reverses trends in aggregated data",
    "the difference between correlation and causation in A/B tests",
    "why the median beats the mean for skewed incomes",
    "how Bayesian updating beats gut instinct with sparse data",
    "survivorship bias in success stories and fund returns",
  ],
  "machine learning": [
    "how gradient descent finds valleys in million-dimensional loss",
    "why overfitting memorizes noise instead of learning patterns",
    "how attention lets transformers focus on relevant tokens",
    "the bias-variance tradeoff in model complexity",
    "why embeddings turn words into geometry you can search",
    "how backpropagation distributes blame through neural layers",
  ],
  ai: [
    "how chain-of-thought changes LLM reasoning quality",
    "why RLHF nudges models toward helpful but cautious answers",
    "how tokenization splits language into model-readable chunks",
    "the scaling laws linking compute to capability jumps",
    "why hallucinations persist even in large language models",
    "how retrieval-augmented generation grounds answers in documents",
  ],
  stocks: [
    "how market makers profit from the bid-ask spread",
    "why index funds quietly reshaped corporate governance",
    "how short selling bets against overpriced companies",
    "the earnings surprise effect on post-report price jumps",
    "why volatility clustering shows up after market shocks",
    "how discounted cash flow models value future profits today",
  ],
  news: [
    "how breaking news algorithms prioritize speed over verification",
    "why headlines exploit negativity bias in attention",
    "how wire services propagate stories worldwide in minutes",
    "the filter bubble effect in personalized news feeds",
    "how primary sources differ from analysis in reporting",
    "why correction rates reveal systemic newsroom pressure",
  ],
  science: [
    "how CRISPR edits genes with molecular scissors",
    "why placebo effects show mind-body feedback loops",
    "how radiocarbon dating estimates ancient artifact ages",
    "the replication crisis and what failed studies teach us",
    "how vaccines train immune memory without causing disease",
    "why controlled experiments beat anecdotal evidence",
  ],
  physics: [
    "how neutron stars pack a sun's mass into a city-sized sphere",
    "why laser cooling slows atoms to near absolute zero",
    "how general relativity bends light around black holes",
    "the double-slit experiment and measurement weirdness",
    "how superconductors expel magnetic fields below critical temp",
    "why entropy always increases in closed systems",
  ],
};

const GENERIC_SUBJECT_TEMPLATES = [
  "a specific breakthrough or discovery inside {topic}",
  "one named mechanism or effect from {topic}",
  "how a real system in {topic} actually works under the hood",
  "a counterintuitive result from {topic} with a concrete example",
  "a historical figure's contribution that changed {topic}",
  "a modern application of {topic} most people haven't heard of",
];

function normalizeTopicKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();
}

function findSubjectPool(topic: string): string[] | null {
  const key = normalizeTopicKey(topic);
  if (SUBJECT_POOLS[key]) return SUBJECT_POOLS[key];

  for (const [poolKey, pool] of Object.entries(SUBJECT_POOLS)) {
    if (key.includes(poolKey) || poolKey.includes(key)) return pool;
  }

  return null;
}

export function pickConcreteSubject(topic: string, index: number): string {
  const pool = findSubjectPool(topic);
  if (pool?.length) return pool[Math.abs(index) % pool.length];

  const templates = GENERIC_SUBJECT_TEMPLATES;
  return templates[Math.abs(index) % templates.length].replace(
    "{topic}",
    topic
  );
}

const META_TITLE_HOOKS = [
  "not what you think",
  "trick experts",
  "breaks every rule",
  "part nobody talks about",
  "fact changes the whole game",
  "just got weird",
];

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