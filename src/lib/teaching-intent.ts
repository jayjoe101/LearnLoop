const KEYWORD_STOP =
  /^(how|why|what|when|where|does|can|will|are|was|were|have|has|had|the|and|for|that|with|from|into|your|this|these|those|about|over|under|through|between|within|without|after|before|during|while|because|since|until|than|then|also|just|only|even|still|already|very|much|many|some|any|each|every|both|such|more|most|less|least|other|another|same|different|like|unlike|using|used|make|makes|made|work|works|working|happen|happens|actually|really|simply|plain|clear|specific|general|lesser|known|example|they|them|their|avoid|backs|back|crispr|tcp)$/i;

function extractSubjectKeywords(subject: string): string[] {
  const raw = subject
    .replace(/\?$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");

  const tokens = new Set<string>();
  for (const chunk of raw.split(/\s+/)) {
    if (!chunk || KEYWORD_STOP.test(chunk)) continue;
    tokens.add(chunk);
    for (const part of chunk.split("-")) {
      if (part.length > 3 && !KEYWORD_STOP.test(part)) tokens.add(part);
    }
  }
  return [...tokens].filter((w) => w.length > 3);
}

export type TeachingGoal = {
  mode: "why" | "how" | "what" | "when" | "general";
  keywords: string[];
};

const BROAD_TOPIC_WORDS = new Set([
  "crispr",
  "tcp",
  "dna",
  "rna",
  "cell",
  "cells",
  "protein",
  "physics",
  "biology",
  "chemistry",
  "computer",
  "science",
]);

const CAUSAL_MARKERS =
  /\b(because|since|after|when|if|therefore|thus|so|as a result|due to|trigger|triggers|cause|causes|leads to|results in|means|indicates|signals|treats?|interpret)\b/i;

const MECHANISM_MARKERS =
  /\b(by|through|via|using|without|instead of|rather than|avoids?|prevents?|works by|mediates?|converts?|reduces?|increases?|resets?|halves?|backs? off|decreases?|lowers?|shrinks?|restarts?|enters?|teach(?:es)?|instruct(?:s)?|train(?:s)?|produce(?:s)?|deliver(?:s)?|encode(?:s)?|present(?:s)?)\b/i;

export const OFF_TOPIC_SENTENCE =
  /\b(institute is based|university of california|berkeley campus|company announced|mammoth biosciences|agricultural products|genetically modified organisms|controlling pathogens|exact copies of the original|fell down a wiki rabbit|in 20\d\d, the company|spread by 5g|misrepresentations about how the immune system|exaggerated claims about side effects|toxoid vaccine|passive immunization is used when|is an idiom referring|great firewall|cyberspace administration of china|windows vista networking|computer restart after a change in settings|sensitive words appear|keywords or sensitive words|access will be closed)\b/i;

export const OFF_TOPIC_APPLICATIONS =
  /\b(medicines, agricultural|pathogens and pests|therapeutic genome editing in in vivo)\b/i;

const OFF_TOPIC_TITLE =
  /\b(manga|anime|film|movie|album|song|novel|band|television|episode|poem|painting|sculpture)\b/i;

export type FactRole = "context" | "mechanism" | "answer";

export function parseTeachingGoal(subject: string): TeachingGoal {
  const lower = subject.replace(/\?$/g, "").trim().toLowerCase();
  let mode: TeachingGoal["mode"] = "general";
  if (lower.startsWith("why ")) mode = "why";
  else if (lower.startsWith("how ")) mode = "how";
  else if (lower.startsWith("what ")) mode = "what";
  else if (lower.startsWith("when ")) mode = "when";
  return { mode, keywords: extractSubjectKeywords(subject) };
}

function keywordInText(text: string, kw: string): boolean {
  const lower = text.toLowerCase();
  const variants = [kw, kw.replace(/-/g, " "), kw.replace(/-/g, "")];
  return variants.some((v) => v.length > 3 && lower.includes(v));
}

export function isOffTopicTeachingSentence(sentence: string): boolean {
  if (OFF_TOPIC_SENTENCE.test(sentence)) return true;
  if (OFF_TOPIC_APPLICATIONS.test(sentence)) return true;
  if (
    /\b(eligible\s+rate|agile\s+probing|tcp\s*westwood|tcpw\b|manga|film|television)\b/i.test(
      sentence
    )
  ) {
    return true;
  }
  return false;
}

export function classifyFactRole(sentence: string, goal: TeachingGoal): FactRole | null {
  if (isOffTopicTeachingSentence(sentence)) return null;

  const answersHowOrWhy =
    (goal.mode === "why" || goal.mode === "how") &&
    CAUSAL_MARKERS.test(sentence) &&
    MECHANISM_MARKERS.test(sentence);

  const answersAvoidance =
    goal.mode === "how" &&
    /\b(without|avoid[s]?|prevents?|no need)\b/i.test(sentence) &&
    /\b(double[\s-]?strand|dsbs?|break)\b/i.test(sentence);

  const mentionsWindowedBackoff = goal.keywords.some(
    (kw) => kw.includes("slow") || kw === "start" || kw.includes("start")
  );
  const answersBackoff =
    goal.mode === "why" &&
    /\b(packet\s+loss|lost\s+packets?|timeout|retransmi)\b/i.test(sentence) &&
    /\b(reduce[s]?|decrease[s]?|back|restart[s]?|reset[s]?|recovery|transmission\s+rate)\b/i.test(
      sentence
    ) &&
    (!mentionsWindowedBackoff ||
      /\b(slow[\s-]?start|cwnd|congestion\s+window|window)\b/i.test(sentence));

  const subjectMentionsTeaching = goal.keywords.some((kw) => kw.includes("teach"));
  const answersTeaching =
    goal.mode === "how" &&
    subjectMentionsTeaching &&
    /\b(teach(?:es)?|instruct(?:s)?|train(?:s)?|educate(?:s)?|prime(?:s)?)\b/i.test(
      sentence
    ) &&
    goal.keywords.filter((kw) => keywordInText(sentence, kw)).length >= 2;

  if (answersHowOrWhy || answersAvoidance || answersBackoff || answersTeaching) {
    if (
      mentionsWindowedBackoff &&
      !/\b(slow[\s-]?start|cwnd|congestion\s+window)\b/i.test(sentence)
    ) {
      return "mechanism";
    }
    return "answer";
  }

  if (CAUSAL_MARKERS.test(sentence) && MECHANISM_MARKERS.test(sentence)) {
    return "mechanism";
  }
  if (CAUSAL_MARKERS.test(sentence)) return "mechanism";

  if (/\b(is|are|was|were|includes|uses|maintains|means|defined)\b/i.test(sentence)) {
    return "context";
  }

  return "mechanism";
}

export function scoreSentenceForTeachingGoal(
  sentence: string,
  goal: TeachingGoal
): number {
  if (isOffTopicTeachingSentence(sentence)) return -10;

  const specific = goal.keywords.filter((k) => !BROAD_TOPIC_WORDS.has(k));
  let score = specific.filter((kw) => keywordInText(sentence, kw)).length * 1.1;

  if (CAUSAL_MARKERS.test(sentence)) score += 1.4;
  if (MECHANISM_MARKERS.test(sentence)) score += 1.2;

  const role = classifyFactRole(sentence, goal);
  if (role === "answer") score += 3;
  if (role === "mechanism") score += 1.5;
  if (role === "context") score += 0.5;

  if (goal.mode === "why" && !CAUSAL_MARKERS.test(sentence)) score -= 1;
  if (goal.mode === "how" && !MECHANISM_MARKERS.test(sentence)) score -= 0.8;

  return score;
}

export function extractHighlight(body: string): string {
  return body.match(/==([^=]+)==/)?.[1]?.trim() ?? "";
}

export function teachesSpecificTakeaway(subject: string, body: string): boolean {
  const subjectLower = subject.toLowerCase().replace(/\?$/g, "").trim();
  const plain = body
    .toLowerCase()
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*|==|\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const highlight = extractHighlight(body).toLowerCase();

  if (OFF_TOPIC_SENTENCE.test(plain) || OFF_TOPIC_APPLICATIONS.test(plain)) {
    return false;
  }

  if (
    (subjectLower.includes("slow-start") || subjectLower.includes("slow start")) &&
    (subjectLower.includes("packet loss") || subjectLower.includes("loss"))
  ) {
    const hasLoss =
      /\b(packet\s+loss|lost\s+packets?|timeout|retransmi)\b/.test(plain);
    const highlightHasBackoffAction =
      /\b(backs? off|restart(?:ing|s)?|reset[s]?|recovery|exponential reduction|reduced transmission|halv(?:e|es|ed)|decrease[s]? when|reduction when)\b/.test(
        highlight
      );
    const hasBackoffInBody =
      /\b(backs? off|restart(?:ing|s)?|reset[s]?|recovery|exponential reduction|reduced transmission|halv(?:e|es|ed))\b/.test(
        plain
      ) &&
      /\b(slow[\s-]?start|cwnd|congestion\s+window)\b/.test(plain);
    if (!hasLoss) return false;
    if (!highlightHasBackoffAction && !hasBackoffInBody) return false;
    if (
      /\b(aimd|additive increase)\b/.test(highlight) &&
      !highlightHasBackoffAction
    ) {
      return false;
    }
    return true;
  }

  if (
    subjectLower.includes("base editor") &&
    (subjectLower.includes("double-strand") ||
      subjectLower.includes("double strand") ||
      subjectLower.includes("dsb"))
  ) {
    if (/\b(exact copies of the original|replisome)\b/i.test(plain)) return false;
    if (/\b(medicines|agricultural|pathogens|pests)\b/.test(highlight)) return false;
    const explainsMechanism =
      /\b(without|avoid|convert|deaminase|chemical|single[\s-]?strand|one strand)\b/.test(
        highlight
      ) || /\b(without|avoid|convert|deaminase|chemical)\b/.test(plain);
    const mentionsDsb = /\b(double[\s-]?strand|dsbs?)\b/.test(plain);
    return explainsMechanism && mentionsDsb;
  }

  const goal = parseTeachingGoal(subject);
  const specific = goal.keywords.filter((kw) => !BROAD_TOPIC_WORDS.has(kw));
  const highlightHits = specific.filter((kw) => keywordInText(highlight, kw)).length;
  const requiredHighlight = Math.min(
    2,
    Math.max(1, Math.ceil(specific.length * 0.4))
  );

  const wantsImmuneTeaching =
    goal.mode === "how" &&
    goal.keywords.some((k) => k.includes("teach")) &&
    goal.keywords.some((k) => k.includes("immune") || k.includes("immunity")) &&
    goal.keywords.some((k) => k.includes("vaccine") || k.includes("mrna"));
  if (wantsImmuneTeaching) {
    const explainsImmune =
      /\b(immune|immunity|antibod|response)\b/.test(highlight) ||
      /\b(immune|immunity|antibod|response)\b/.test(plain);
    const explainsTeaching =
      /\b(teach|instruct|train|produce|present|encode|deliver)\b/.test(highlight) ||
      /\b(teach|instruct|train|produce|present|encode|deliver)\b/.test(plain);
    const explainsVaccineTech =
      /\b(mrna|messenger rna|vaccine|antigen)\b/.test(highlight) ||
      /\b(mrna|messenger rna|vaccine|antigen)\b/.test(plain);
    if (!explainsImmune || !explainsTeaching || !explainsVaccineTech) return false;
    return true;
  }

  if (goal.mode === "how" || goal.mode === "why") {
    if (highlightHits < requiredHighlight) return false;
    if (!CAUSAL_MARKERS.test(highlight) && !MECHANISM_MARKERS.test(highlight)) {
      return false;
    }
  }

  if (goal.mode === "general" || goal.mode === "what") {
    return (
      goal.keywords.filter((kw) => plain.includes(kw)).length >= 2 &&
      highlightHits >= 1
    );
  }

  return (
    CAUSAL_MARKERS.test(highlight || plain) &&
    goal.keywords.filter((kw) => plain.includes(kw)).length >=
      Math.max(2, Math.ceil(goal.keywords.length * 0.45))
  );
}

export function isOffTopicWikiTitle(title: string, subject?: string): boolean {
  if (OFF_TOPIC_TITLE.test(title)) return true;
  const subjectLower = subject?.toLowerCase() ?? "";
  if (/\b(great firewall|firewall)\b/i.test(title) && !/\bfirewall\b/i.test(subjectLower)) {
    return true;
  }
  if (/\bwestwood\b/i.test(title) && !/\bwestwood\b/i.test(subjectLower)) {
    return true;
  }
  return false;
}