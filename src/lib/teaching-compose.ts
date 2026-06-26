import type { Persona } from "@/lib/personas";
import {
  classifyFactRole,
  parseTeachingGoal,
  scoreSentenceForTeachingGoal,
  type FactRole,
} from "@/lib/teaching-intent";
import {
  bodyAnswersSubject,
  isCoherentTeachingBody,
  isVerbatimWikiStitch,
} from "@/lib/teaching-validate";
import { chatCompletion, FAST_MODEL } from "@/lib/xai-client";

export type ComposedTeaching = {
  body: string;
  wikiTerm: string;
};

const CAUSAL_MARKERS =
  /\b(because|since|after|when|if|therefore|thus|so|as a result|due to|trigger|triggers|cause|causes|leads to|results in|means|indicates|signals|treats?|interpret)\b/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
}

function distillClause(sentence: string): string {
  let text = sentence
    .replace(/^Transmission Control Protocol \(TCP\)\s+/i, "TCP ")
    .replace(/^In TCP Westwood,?\s*/i, "")
    .replace(/^TCP Westwood \(TCPW\) is\s+/i, "TCP ")
    .replace(/\([^)]{30,}\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/^(And|Or|But|Causes)\s+/i, "");
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return text.endsWith(".") ? text : `${text}.`;
}

function pickSourceFacts(
  subject: string,
  sentences: string[],
  seed: number
): string[] {
  const goal = parseTeachingGoal(subject);
  const scored = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreSentenceForTeachingGoal(sentence, goal),
      role: classifyFactRole(sentence, goal),
    }))
    .filter((item) => item.score > 0.45 && item.role)
    .sort((a, b) => b.score - a.score);

  if (scored.length < 2) return [];

  const byRole: Partial<Record<FactRole, string>> = {};
  const usedSentences = new Set<string>();
  for (const role of ["context", "mechanism", "answer"] as FactRole[]) {
    const item = scored.find(
      (entry) =>
        entry.role === role &&
        !usedSentences.has(entry.sentence) &&
        !Object.values(byRole).includes(distillClause(entry.sentence))
    );
    if (!item) continue;
    usedSentences.add(item.sentence);
    byRole[role] = distillClause(item.sentence);
  }

  const ordered: string[] = [];
  for (const role of ["context", "mechanism", "answer"] as FactRole[]) {
    if (byRole[role]) ordered.push(byRole[role]!);
  }

  if (!byRole.context) {
    const keywordOverlap = (sentence: string) =>
      goal.keywords.filter((kw) =>
        sentence.toLowerCase().includes(kw.replace(/-/g, " "))
      ).length;
    const ctx = [...scored]
      .sort((a, b) => keywordOverlap(b.sentence) - keywordOverlap(a.sentence))
      .find((entry) =>
        /\b(is|are|was|were|means|includes|uses|defined as)\b/i.test(entry.sentence)
      );
    if (ctx) {
      const fact = distillClause(ctx.sentence);
      byRole.context = fact;
      if (!ordered.includes(fact)) ordered.unshift(fact);
    }
  }

  if (!byRole.answer && (goal.mode === "why" || goal.mode === "how")) {
    const wantsWindowBackoff = goal.keywords.some(
      (kw) => kw.includes("slow") || kw === "start" || kw.includes("start")
    );
    const usedFacts = new Set(Object.values(byRole));
    const pickWindowAnswer = () =>
      scored.find(
        (entry) =>
          !usedFacts.has(distillClause(entry.sentence)) &&
          /\b(cwnd|congestion\s+window|slow[\s-]?start)\b/i.test(entry.sentence) &&
          /\b(reduce[s]?|decrease[s]?|exponential|multiplicative|back|restart[s]?|reset[s]?|recovery|congestion)\b/i.test(
            entry.sentence
          )
      );
    const fallbackAnswer =
      (wantsWindowBackoff ? pickWindowAnswer() : null) ??
      scored.find(
        (entry) =>
          goal.mode === "why" &&
          /\b(packet\s+loss|lost\s+packets?|congestion)\b/i.test(entry.sentence) &&
          /\b(reduce[s]?|decrease[s]?|exponential|multiplicative|back|restart[s]?|reset[s]?|recovery)\b/i.test(
            entry.sentence
          )
      ) ??
      scored.find(
        (entry) =>
          entry.role === "mechanism" &&
          entry.score >= 2.5 &&
          goal.keywords.filter((kw) =>
            entry.sentence.toLowerCase().includes(kw.replace(/-/g, " "))
          ).length >= 2
      ) ??
      scored.find((entry) => entry.role === "mechanism" && entry.score >= 2.2);
    if (fallbackAnswer) {
      byRole.answer = distillClause(fallbackAnswer.sentence);
      if (!ordered.includes(byRole.answer)) ordered.push(byRole.answer);
    } else {
      return [];
    }
  }

  if (ordered.length < 2) {
    const offset = seed % Math.max(1, scored.length);
    for (let i = 0; i < scored.length && ordered.length < 3; i++) {
      const fact = distillClause(scored[(i + offset) % scored.length].sentence);
      if (!ordered.includes(fact)) ordered.push(fact);
    }
  }

  if (ordered.length < 2) return [];
  return ordered.slice(0, 3);
}

function bridgeWhyMechanism(fact: string, mode: string): string {
  if (mode !== "why" || !CAUSAL_MARKERS.test(fact)) return fact;
  if (/^Because\b/i.test(fact) || /\bbecause\b/i.test(fact)) return fact;
  const core = fact.replace(/\.$/, "");
  return `Because ${core}.`;
}

function stitchTeachingBody(
  subject: string,
  wikiTerm: string,
  facts: string[],
  persona: Persona | undefined,
  seed: number
): string | null {
  if (facts.length < 2) return null;

  const goal = parseTeachingGoal(subject);
  const context = facts[0];
  const mechanism = facts.length >= 3 ? facts[1] : facts[0];
  const answer = facts[facts.length - 1];
  const highlight = answer.replace(/\.$/, "").replace(/^Because\s+/i, "");
  if (highlight.length < 20) return null;

  const variant = seed % 3;
  const paragraphs: string[] = [];

  if (variant === 0) {
    paragraphs.push(`**[[${wikiTerm}]]** connects to ${subject.toLowerCase()}: ${context}`);
    if (facts.length >= 3) {
      const middle = bridgeWhyMechanism(mechanism, goal.mode);
      if (middle !== context) paragraphs.push(middle);
    }
    paragraphs.push(`The takeaway: ==${highlight}==.`);
  } else if (variant === 1) {
    paragraphs.push(context);
    if (facts.length >= 3) paragraphs.push(bridgeWhyMechanism(mechanism, goal.mode));
    paragraphs.push(`For **[[${wikiTerm}]]**, ==${highlight}==.`);
  } else {
    paragraphs.push(`When studying ${subject.toLowerCase()}, start with **[[${wikiTerm}]]**: ${context}`);
    paragraphs.push(`==${highlight}==.`);
  }

  const body = paragraphs.join("\n\n");
  if (!isCoherentTeachingBody(body, subject)) return null;
  if (!bodyAnswersSubject(subject, body)) return null;
  return body;
}

async function synthesizeWithModel(
  subject: string,
  wikiTerm: string,
  sourceFacts: string[],
  persona: Persona | undefined
): Promise<string | null> {
  const voiceHint = persona
    ? `Write in the voice of ${persona.name} (${persona.role}): ${persona.voice}`
    : "Write in clear, bluntly informative prose.";

  const content = await chatCompletion({
    model: FAST_MODEL,
    temperature: 0.35,
    maxTokens: 480,
    timeoutMs: 14_000,
    messages: [
      {
        role: "system",
        content: `You write bluntly informative teaching posts for LearnLoop.
Rewrite the source facts into 2-3 short paragraphs that directly answer the SPECIFIC subject.
Each post has ONE teaching goal: the reader must learn something concrete and new.
Do not copy Wikipedia sentences verbatim. State what happens, why/how, and one concrete takeaway.
The ==highlighted== sentence must directly answer the subject question — not a general definition or unrelated application.
Use plain, direct language — explain the complex topic simply without filler or vague phrasing.
Use **bold**, ==highlight== on the key insight, and [[${wikiTerm}]] somewhere natural. For math use $...$ or $$...$$; for code use fenced \`\`\`language blocks or single-backtick inline code — never leave raw triple-backtick markers.
Write fresh prose — no template openers like "Here's the deal" or "Quick lesson".
${voiceHint}`,
      },
      {
        role: "user",
        content: `Subject: ${subject}

Source facts (paraphrase only):
${sourceFacts.map((f, i) => `${i + 1}. ${f}`).join("\n")}`,
      },
    ],
  });

  return content?.trim() ?? null;
}

/**
 * Compose a blunt teaching answer from Wikipedia extract text.
 * Stitches role-selected facts into paragraphs — returns null when the extract
 * cannot support a coherent subject-specific explanation.
 */
export async function composeTeachingAnswer(
  subject: string,
  wikiTerm: string,
  extract: string,
  seed: number,
  persona?: Persona
): Promise<ComposedTeaching | null> {
  const sentences = splitSentences(extract);
  const facts = pickSourceFacts(subject, sentences, seed);
  if (facts.length < 2) return null;

  let body: string | null = null;
  let stitched = false;

  if (process.env.XAI_API_KEY) {
    const modelBody = await synthesizeWithModel(subject, wikiTerm, facts, persona);
    if (
      modelBody &&
      modelBody.length >= 120 &&
      !isVerbatimWikiStitch(modelBody, sentences) &&
      isCoherentTeachingBody(modelBody, subject) &&
      bodyAnswersSubject(subject, modelBody)
    ) {
      body = modelBody;
    }
  }

  if (!body) {
    body = stitchTeachingBody(subject, wikiTerm, facts, persona, seed);
    stitched = Boolean(body);
  }

  if (!body || body.length < 120) return null;
  if (!stitched && isVerbatimWikiStitch(body, sentences)) return null;

  return { body, wikiTerm };
}

/** Test helper: expose compose pipeline stages without publishing posts. */
export function inspectComposePipeline(
  subject: string,
  wikiTerm: string,
  extract: string,
  seed: number,
  persona?: Persona
): {
  facts: string[];
  body: string | null;
  verbatim: boolean;
  coherent: boolean;
  answers: boolean;
} {
  const sentences = splitSentences(extract);
  const facts = pickSourceFacts(subject, sentences, seed);
  const body =
    facts.length >= 2
      ? stitchTeachingBody(subject, wikiTerm, facts, persona, seed)
      : null;
  return {
    facts,
    body,
    verbatim: body ? isVerbatimWikiStitch(body, sentences) : false,
    coherent: body ? isCoherentTeachingBody(body, subject) : false,
    answers: body ? bodyAnswersSubject(subject, body) : false,
  };
}