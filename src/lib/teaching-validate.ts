import {
  extractHighlight,
  isOffTopicTeachingSentence,
  OFF_TOPIC_APPLICATIONS,
  OFF_TOPIC_SENTENCE,
  teachesSpecificTakeaway,
} from "@/lib/teaching-intent";

const KEYWORD_STOP =
  /^(how|why|what|when|where|does|can|will|are|was|were|have|has|had|the|and|for|that|with|from|into|your|this|these|those|about|over|under|through|between|within|without|after|before|during|while|because|since|until|than|then|also|just|only|even|still|already|very|much|many|some|any|each|every|both|such|more|most|less|least|other|another|same|different|like|unlike|using|used|make|makes|made|work|works|working|happen|happens|actually|really|simply|plain|clear|specific|general|lesser|known|example|they|them|their|avoid|backs|back|crispr|tcp)$/i;

const CAUSAL_OR_MECHANISM =
  /\b(because|since|after|when|if|therefore|thus|so|as a result|due to|trigger|triggers|cause|causes|leads to|results in|means|indicates|signals|by|through|via|using|without|instead of|rather than|avoids?|prevents?|works by|mediates?|converts?|reduces?|increases?|resets?|halves?|backs? off|decreases?|lowers?|shrinks?|treats?|interpret|teach(?:es)?|instruct(?:s)?|train(?:s)?|produce(?:s)?|deliver(?:s)?|encode(?:s)?|stimulat(?:e|es))\b/i;

export function extractSubjectKeywords(subject: string): string[] {
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

function plainBody(body: string): string {
  return body
    .toLowerCase()
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*|==|\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDuplicateParagraphs(body: string): boolean {
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) =>
      p
        .replace(/\*\*|\[\[|\]\]|==/g, "")
        .trim()
        .toLowerCase()
    )
    .filter((p) => p.length > 30);
  return new Set(paragraphs).size < paragraphs.length;
}

function sentenceCount(body: string): number {
  return body
    .split(/(?<=[.!?])\s+|\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25).length;
}

function sentenceWordOverlap(a: string, b: string): number {
  const wordsA = a.split(/\s+/).filter((w) => w.length > 3);
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.length === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / wordsA.length;
}

const FRAGMENT_OPENER =
  /^(and|or|but|as well as|including|through|along with)\b/i;

const FINITE_VERB =
  /\b(is|are|was|were|has|have|had|uses|use|means|includes|works|happens|occurs|reduce|reduces|increase|increases|convert|converts|mediates|avoids|prevent|prevents|maintains|combines|allows|requires|signals|treats|interprets|detects|detected|backs|restarts|enters|applies|shrinks|expands|grows|decrease|decreases|enables|provides|creates|makes|performs|operates|functions|serves|supports|limits|controls|edit|edits|editing|teach|teaches|deliver|delivers|produce|produces|stimulate|stimulates)\b/i;

/** Reject incoherent stitched bodies: fragments, gibberish, or takeaway repeating setup. */
export function isCoherentTeachingBody(body: string, subject?: string): boolean {
  if (!body || body.length < 120) return false;

  const plain = plainBody(body);
  const subjectLower = subject?.toLowerCase() ?? "";
  if (/\band one dna base to another conversions\b/i.test(plain)) return false;
  if ((plain.match(/\bwithout the need\b/g) ?? []).length > 1) return false;
  if (/\bBecause\s+It\b/.test(body)) return false;
  if (/\bbecause\b[^.]{0,200}\bbecause\b/i.test(plain)) return false;
  if (
    /\b(biosciences|biotechnology company|company announced)\b/i.test(plain) &&
    !/\bcompany\b/i.test(plain.slice(0, 40))
  ) {
    return false;
  }
  if (OFF_TOPIC_SENTENCE.test(plain) || OFF_TOPIC_APPLICATIONS.test(plain)) {
    return false;
  }
  if (/\b(exact copies of the original double stranded)\b/i.test(plain)) {
    return false;
  }

  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 2 || paragraphs.length > 4) return false;

  const opener = paragraphs[0];
  const afterDash = opener
    .split(/—/)[1]
    ?.replace(/\*\*|\[\[[^\]]+\]\]/g, "")
    .trim() ?? "";
  if (afterDash.length < 35) return false;
  if (FRAGMENT_OPENER.test(afterDash)) return false;
  if (!FINITE_VERB.test(afterDash)) return false;

  for (let i = 1; i < paragraphs.length; i++) {
    const text = paragraphs[i].replace(/==/g, "").replace(/\*\*/g, "").trim();
    if (text.split(/\s+/).length < 6) return false;
    if (FRAGMENT_OPENER.test(text) && !FINITE_VERB.test(text)) return false;
    if (isOffTopicTeachingSentence(text)) return false;
  }

  if (paragraphs.length >= 3) {
    const setupText = plainBody(opener.split(/—/).slice(1).join("—"));
    const last = paragraphs[paragraphs.length - 1];
    const takeawayText = plainBody(last);
    if (sentenceWordOverlap(setupText, takeawayText) >= 0.78) return false;

    const highlight = last.match(/==([^=]+)==/)?.[1]?.trim().toLowerCase() ?? "";
    if (highlight.length > 24 && setupText.includes(highlight.slice(0, 40))) {
      return false;
    }
  }

  return !hasDuplicateParagraphs(body);
}

export function isVerbatimWikiStitch(
  body: string,
  sourceSentences: string[]
): boolean {
  const plain = plainBody(body);
  const bodySentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  let copied = 0;
  for (const source of sourceSentences) {
    const sourceParts = plainBody(source)
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30);

    for (const src of sourceParts) {
      for (const paragraph of bodySentences) {
        if (sentenceWordOverlap(src, paragraph) >= 0.9) copied++;
      }
    }
  }

  return copied >= 3;
}

function validateTcpSlowStartBackoff(body: string): boolean {
  if (
    /\b(tcp\s*westwood|tcpw\b|eligible\s+rate|agile\s+probing|westwood\+|new\s+reno\s+modification)\b/i.test(
      body
    )
  ) {
    return false;
  }

  const flat = body.replace(/\s+/g, " ");
  const hasSlowStart = /\bslow[\s-]?start\b/.test(body);
  const hasPacketLoss =
    /\b(packet\s+loss|packet[s]?\s+lost|lost\s+packets?|retransmi|timeout|duplicate\s+ack)\b/.test(
      body
    );
  const hasWindowBackoff =
    /\b(back(?:s|ed)?\s+off|reset[s]?|halv(?:e|es|ed)|multiplicative\s+decrease|reduce[sd]?|decrease[sd]?|reduction|congestion\s+avoidance|smaller\s+window|recovery)\b.{0,120}\b(cwnd|congestion\s+window|window|slow[\s-]?start)\b/.test(
      flat
    ) ||
    /\b(cwnd|congestion\s+window|window|slow[\s-]?start)\b.{0,120}\b(back(?:s|ed)?\s+off|reset[s]?|halv(?:e|es|ed)|multiplicative\s+decrease|reduce[sd]?|decrease[sd]?|reduction|recovery)\b/.test(
      flat
    );
  const explainsCausalLink =
    /\b(because|since|after|when|if|due\s+to|treat(?:s|ed)|interpret(?:s|ed)?|signal(?:s)?|indicat(?:e|es|ed)|mean(?:s)?)\b/.test(
      flat
    ) &&
    hasPacketLoss &&
    hasWindowBackoff;

  if (!/\btcp\b/.test(body)) return false;
  if (!hasSlowStart || !hasPacketLoss || !hasWindowBackoff) return false;
  if (!explainsCausalLink) return false;
  if (sentenceCount(body) < 2) return false;

  const highlight = extractHighlight(body).toLowerCase();
  const highlightHasBackoffAction =
    /\b(backs? off|restart(?:ing|s)?|reset[s]?|recovery|exponential reduction|reduced transmission|halv(?:e|es|ed)|decrease[s]? when|reduction when)\b/.test(
      highlight
    );
  if (highlight && !highlightHasBackoffAction) return false;
  if (
    highlight &&
    /\b(aimd|additive increase)\b/.test(highlight) &&
    !highlightHasBackoffAction
  ) {
    return false;
  }
  if (
    highlight &&
    /\b(limits the total number of unacknowledged packets|congestion avoidance)\b/.test(
      highlight
    ) &&
    !highlightHasBackoffAction
  ) {
    return false;
  }

  return true;
}

function validateBaseEditorDsbAvoidance(body: string): boolean {
  if (/\bprime[\s-]?edit/i.test(body) && !/\bbase[\s-]?edit/i.test(body)) {
    return false;
  }
  if (
    /\b(cas\s*9|cas9|foki|programmable\s+nuclease|restriction\s+endonuclease|homology[\s-]directed|non[\s-]homologous\s+end\s+joining|nhej|hdr)\b/i.test(
      body
    )
  ) {
    return false;
  }

  if (
    /\b(introduc|creat|caus|make|cutt?ing|cleav(?:e|ing)).{0,80}\b(double[\s-]?strand(?:ed)?\s+breaks?|dsbs?)\b/i.test(
      body
    ) &&
    !/\b(without|avoid|no need|not (?:create|induce|cut)|instead|rather)\b/i.test(
      body.slice(0, body.toLowerCase().indexOf("double"))
    )
  ) {
    return false;
  }

  const hasEditorMechanism =
    /\b(base[\s-]?edit(?:or|ing|ors)?|base[\s-]to[\s-]base|cytosine\s+base\s+editor|adenine\s+base\s+editor|deaminase|pegRNA)\b/.test(
      body
    );
  const hasDsb =
    /\b(double[\s-]?strand(?:ed)?\s+breaks?|double[\s-]?strand breaks?|dsbs?)\b/.test(
      body
    );
  const explainsAvoidance =
    /\b(without|avoid[s]?|prevents?|no need for|does not (?:create|induce|require|cut)|instead of|rather than|not (?:create|induce|cut)|bypass(?:es|ing)?|convert(?:s|ing)?|chemical)/i.test(
      body
    );

  if (!hasEditorMechanism || !hasDsb) return false;
  if (!explainsAvoidance) return false;
  if (sentenceCount(body) < 2) return false;

  const highlight = extractHighlight(body).toLowerCase();
  if (
    /\b(medicines|agricultural|pathogens|pests|exact copies|replisome)\b/.test(
      highlight
    )
  ) {
    return false;
  }
  if (
    highlight &&
    !/\b(without|avoid|convert|deaminase|chemical|single[\s-]?strand|one strand)\b/.test(
      highlight
    )
  ) {
    return false;
  }

  return true;
}

function validateGeneralSubjectAnswer(subject: string, body: string): boolean {
  const keywords = extractSubjectKeywords(subject);
  if (keywords.length === 0) return true;

  const matched = keywords.filter((kw) => {
    const variants = [kw, kw.replace(/-/g, " "), kw.replace(/-/g, "")];
    return variants.some((v) => v.length > 3 && body.includes(v));
  });

  const required = Math.max(2, Math.ceil(keywords.length * 0.55));
  if (matched.length < required) return false;
  if (!CAUSAL_OR_MECHANISM.test(body)) return false;
  if (sentenceCount(body) < 2) return false;
  return true;
}

/** Strict check: does the body actually answer the subject's why/how question? */
export function bodyAnswersSubject(subject: string, body: string): boolean {
  if (!body || body.length < 120) return false;
  if (!isCoherentTeachingBody(body, subject)) return false;

  const subjectLower = subject.toLowerCase().replace(/\?$/g, "").trim();
  const bodyPlain = plainBody(body);
  if (!CAUSAL_OR_MECHANISM.test(bodyPlain)) return false;

  if (
    (subjectLower.includes("slow-start") || subjectLower.includes("slow start")) &&
    (subjectLower.includes("packet loss") || subjectLower.includes("loss"))
  ) {
    if (!validateTcpSlowStartBackoff(bodyPlain)) return false;
    return teachesSpecificTakeaway(subject, body);
  }

  if (
    subjectLower.includes("base editor") &&
    (subjectLower.includes("double-strand") ||
      subjectLower.includes("double strand") ||
      subjectLower.includes("dsb"))
  ) {
    if (!validateBaseEditorDsbAvoidance(bodyPlain)) return false;
    return teachesSpecificTakeaway(subject, body);
  }

  if (!validateGeneralSubjectAnswer(subjectLower, bodyPlain)) return false;

  return teachesSpecificTakeaway(subject, body);
}

export { teachesSpecificTakeaway } from "@/lib/teaching-intent";

/** @deprecated Use bodyAnswersSubject — kept for import compatibility during migration */
export function isSubjectBodyAligned(body: string, subject: string): boolean {
  return bodyAnswersSubject(subject, body);
}