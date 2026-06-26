import {
  isBoilerplatePost,
  isDuplicateContent,
  isTooSimilar,
} from "@/lib/dedup";
import { buildVariedFallbackPost } from "@/lib/fallback-post";
import {
  validateGeneratedPost,
  type QualityVerdict,
} from "@/lib/post-quality";
import { pickRandomPersona, type Persona } from "@/lib/personas";
import { discoverConcreteSubject } from "@/lib/subject-discovery";
import { isMetaTopicPost } from "@/lib/topic-subjects";
import {
  discoverWikipediaSubject,
  isPlaceholderSubject,
  resolveSubjectWikipediaCandidates,
} from "@/lib/wiki-teaching";
import { FAST_MODEL } from "@/lib/xai-client";
import {
  enrichBodyWithWikiTerms,
  finalizePostLinks,
  normalizeWikiTerms,
} from "@/lib/post-content";
import type { FeedStyle, PostLink, PostWikiTerm } from "@/lib/types";

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_TIMEOUT_MS = 14_000;
const MAX_GENERATION_ATTEMPTS = 3;

const POST_SCHEMA = {
  type: "object",
  properties: {
    topic: {
      type: "string",
      description:
        "The user's interest-area label (e.g. Physics) — NOT the post subject itself.",
    },
    subject: {
      type: "string",
      description:
        "The specific concept, mechanism, discovery, or story INSIDE the interest area.",
    },
    title: {
      type: "string",
      description:
        "Blunt, informative headline under 90 characters. State what the reader will learn about the SPECIFIC SUBJECT — no vague teasing or clickbait without substance.",
    },
    body: {
      type: "string",
      description:
        "2-4 short paragraphs with ONE clear teaching goal. Bluntly informative: name the mechanism, define terms, state the concrete takeaway. Explain the complex topic simply so the reader learns something specific. Use **bold** for key terms, *italic* for emphasis, ==highlights== for the single most important insight per paragraph. Wrap technical terms in [[double brackets]]. No filler, throat-clearing, or template phrasing.",
    },
    links: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          url: { type: "string" },
        },
        required: ["label", "url"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 3,
    },
    wiki_terms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
        },
        required: ["term"],
        additionalProperties: false,
      },
      maxItems: 4,
    },
  },
  required: ["topic", "subject", "title", "body", "links", "wiki_terms"],
  additionalProperties: false,
} as const;

export type GeneratePostInput = {
  prompt?: string;
  topics: string[];
  style: FeedStyle;
  recentTitles?: string[];
  recentFingerprints?: string[];
  avoidSubjects?: string[];
  focusTopic?: string;
  concreteSubject?: string;
  subjectIndex?: number;
  qualityFeedback?: string;
  usedSubjects?: string[];
};

export type GeneratedPost = {
  topic: string;
  title: string;
  body: string;
  links: PostLink[];
  wiki_terms: PostWikiTerm[];
  persona: Persona;
  subject: string;
};

function pickFocusTopic(topics: string[], explicit?: string): string {
  if (explicit) return explicit;
  if (topics.length === 0) return "general knowledge";
  return topics[Math.floor(Math.random() * topics.length)];
}

function buildMessages(
  input: GeneratePostInput,
  persona: Persona,
  subject: string,
  attempt: number
) {
  const focus = pickFocusTopic(input.topics, input.focusTopic);
  const interests =
    input.topics.length > 0 ? input.topics.join(", ") : "broad curiosity";
  const avoid = input.recentTitles?.length
    ? input.recentTitles.slice(0, 8).map((t) => `- ${t}`).join("\n")
    : "None yet.";
  const avoidSubjects = input.avoidSubjects?.length
    ? input.avoidSubjects.slice(0, 10).map((s) => `- ${s}`).join("\n")
    : "None yet.";
  const dupHint = input.recentFingerprints?.length
    ? "Do NOT reuse the same insight, facts, or wording as any recent post."
    : "";

  const scopeRule = `SCOPE RULE: "${focus}" is an interest AREA filter only. Write about this SPECIFIC subject: "${subject}". Do NOT write about "${focus}" as a field or overview.`;

  const task =
    input.prompt?.trim() ||
    `Write one teaching post about: ${subject} (within "${focus}"). The reader must learn one specific new thing by the end.`;

  const technicalHint = ["researcher", "engineer", "explorer", "skeptic"].includes(
    persona.id
  )
    ? "Technical: 2-4 [[wiki-linked]] terms, precise mechanisms."
    : "Include [[wiki-linked]] terms where helpful.";

  const qualityHint = input.qualityFeedback
    ? `FIX THESE ISSUES FROM LAST DRAFT: ${input.qualityFeedback}`
    : "";

  const retryHint =
    attempt > 0
      ? "RETRY: completely different angle, title, and body."
      : "";

  return [
    {
      role: "system" as const,
      content: `${persona.name} (${persona.role}) on LearnLoop as ${persona.handle}. ${persona.voice}
Write in this persona's voice only — tone may vary, clarity does not.
TEACHING GOAL: Every post must teach ONE specific new thing. Be bluntly informative: say exactly what happens, why, and what to remember. Explain complex ideas in simple, direct language.
${scopeRule}
Title: blunt and informative about the SPECIFIC SUBJECT — state the lesson, not vague intrigue.
Body: fresh prose every time. No template openers ("most people don't know", "here's the thing", "sounds simple until", etc.).
Format body with **bold**, *italic*, and ==highlight== markdown.
${technicalHint} Include 1-3 real source links in the links array (Wikipedia for core concept). ${dupHint} ${qualityHint} ${retryHint}`.trim(),
    },
    {
      role: "user" as const,
      content: `Interest areas: ${interests}
Interest tag: ${focus}
Specific subject (required): ${subject}

Avoid these titles:
${avoid}

Avoid these subjects (pick a different angle):
${avoidSubjects}

${task}`,
    },
  ];
}

async function requestPost(
  apiKey: string,
  messages: ReturnType<typeof buildMessages>,
  temperature: number
): Promise<Response> {
  return fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(XAI_TIMEOUT_MS),
    body: JSON.stringify({
      model: FAST_MODEL,
      messages,
      temperature,
      max_tokens: 520,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "insight_post",
          schema: POST_SCHEMA,
          strict: true,
        },
      },
    }),
  });
}

function parseGeneratedContent(
  content: string,
  input: GeneratePostInput,
  subject: string
): Omit<GeneratedPost, "persona"> | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch?.[0] ?? content;

  let parsed: Partial<GeneratedPost & { subject?: string }>;
  try {
    parsed = JSON.parse(jsonText) as Partial<GeneratedPost & { subject?: string }>;
  } catch {
    return null;
  }

  if (!parsed.title?.trim() || !parsed.body?.trim()) return null;

  const title = parsed.title.trim();
  const body = parsed.body.trim();
  const topic =
    parsed.topic?.trim() || pickFocusTopic(input.topics, input.focusTopic);
  const resolvedSubject = parsed.subject?.trim() || subject;

  if (body.length < 80) return null;
  if (isTooSimilar(title, input.recentTitles ?? [])) return null;
  if (isDuplicateContent(title, body, input.recentFingerprints ?? [])) {
    return null;
  }
  if (isBoilerplatePost(title, body)) return null;

  const wiki_terms = normalizeWikiTerms(
    parsed.wiki_terms as Array<{ term?: string }> | undefined
  );
  const links = finalizePostLinks(
    parsed.links as Array<{ label?: string; url?: string }> | undefined,
    resolvedSubject || wiki_terms[0]?.term || topic,
    wiki_terms
  );

  if (isMetaTopicPost(title, body, topic, wiki_terms)) return null;

  return {
    topic,
    title,
    body: enrichBodyWithWikiTerms(body, wiki_terms),
    links,
    wiki_terms,
    subject: resolvedSubject,
  };
}

async function callXai(
  apiKey: string,
  input: GeneratePostInput,
  persona: Persona,
  subject: string,
  attempt: number
): Promise<GeneratedPost | null> {
  const temperature = 0.72 + attempt * 0.06;
  const messages = buildMessages(input, persona, subject, attempt);

  try {
    const response = await requestPost(apiKey, messages, temperature);
    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content as string | undefined;
    if (!content) return null;

    const result = parseGeneratedContent(content, input, subject);
    if (!result) return null;

    return { ...result, persona };
  } catch {
    return null;
  }
}

async function resolveSubject(
  input: GeneratePostInput,
  focus: string,
  attempt: number
): Promise<string> {
  const explicit = input.concreteSubject?.trim();
  if (explicit && !isPlaceholderSubject(explicit, focus)) return explicit;

  for (let i = 0; i < 2; i++) {
    const discovered = await discoverConcreteSubject({
      topic: focus,
      subjectIndex: (input.subjectIndex ?? Date.now()) + attempt + i * 11,
      recentTitles: input.recentTitles,
      usedSubjects: input.usedSubjects,
      avoidSubjects: input.avoidSubjects,
    });
    if (discovered && !isPlaceholderSubject(discovered, focus)) return discovered;
  }

  const wikiSubject = await discoverWikipediaSubject(
    focus,
    (input.subjectIndex ?? Date.now()) + attempt,
    [...(input.avoidSubjects ?? []), ...(input.usedSubjects ?? [])]
  );
  if (wikiSubject && !isPlaceholderSubject(wikiSubject, focus)) return wikiSubject;

  return explicit || focus;
}

type AcceptResult = {
  accepted: GeneratedPost | null;
  quality?: QualityVerdict;
};

async function acceptGeneratedPost(
  draft: GeneratedPost | null,
  recentTitles: string[],
  recentFingerprints: string[]
): Promise<AcceptResult> {
  if (!draft) return { accepted: null };
  if (isBoilerplatePost(draft.title, draft.body)) return { accepted: null };
  if (isDuplicateContent(draft.title, draft.body, recentFingerprints)) {
    return { accepted: null };
  }
  if (isTooSimilar(draft.title, recentTitles)) return { accepted: null };
  if (isPlaceholderSubject(draft.subject, draft.topic)) return { accepted: null };

  const quality = await validateGeneratedPost({
    topic: draft.topic,
    subject: draft.subject,
    title: draft.title,
    body: draft.body,
    wikiTerms: draft.wiki_terms,
  });
  if (!quality.pass) return { accepted: null, quality };

  return { accepted: draft };
}

const MAX_FALLBACK_ITERATIONS = 4;

export async function generatePost(
  input: GeneratePostInput,
  attempt = 0
): Promise<GeneratedPost | null> {
  const apiKey = process.env.XAI_API_KEY;
  const recentTitles = input.recentTitles ?? [];
  const recentFingerprints = input.recentFingerprints ?? [];
  const variant = (input.subjectIndex ?? 0) + attempt;
  const focus = pickFocusTopic(input.topics, input.focusTopic);
  const subject = await resolveSubject(input, focus, attempt);
  const wikiPrefetch = resolveSubjectWikipediaCandidates(subject).catch(() => []);

  const baseInput: GeneratePostInput = {
    ...input,
    focusTopic: focus,
    concreteSubject: subject,
  };

  if (apiKey) {
    let qualityFeedback = input.qualityFeedback;
    const usedSubjects = [...(input.usedSubjects ?? []), subject];

    for (let aiTry = 0; aiTry < MAX_GENERATION_ATTEMPTS; aiTry++) {
      const persona = pickRandomPersona();
      const tryInput = { ...baseInput, qualityFeedback, usedSubjects };

      const draft = await callXai(
        apiKey,
        tryInput,
        persona,
        subject,
        attempt + aiTry
      );

      const { accepted, quality } = await acceptGeneratedPost(
        draft,
        recentTitles,
        recentFingerprints
      );
      if (accepted) return accepted;

      if (quality?.issues.length) {
        qualityFeedback = quality.issues.join("; ");
      }
    }
  }

  await wikiPrefetch;

  const triedSubjects = new Set<string>();

  const tryGenerateForSubject = async (
    trySubject: string,
    fbIndex: number
  ): Promise<GeneratedPost | null> => {
    if (!trySubject || isPlaceholderSubject(trySubject, focus)) return null;

    const subjectKey = trySubject.toLowerCase().trim();
    if (triedSubjects.has(subjectKey)) return null;
    triedSubjects.add(subjectKey);

    if (fbIndex > 0) {
      await resolveSubjectWikipediaCandidates(trySubject).catch(() => []);
    }

    if (apiKey) {
      const aiTries = fbIndex === 0 ? 2 : 1;
      for (let aiTry = 0; aiTry < aiTries; aiTry++) {
        const persona = pickRandomPersona();
        const draft = await callXai(
          apiKey,
          { ...baseInput, concreteSubject: trySubject },
          persona,
          trySubject,
          attempt + fbIndex + aiTry
        );
        const { accepted } = await acceptGeneratedPost(
          draft,
          recentTitles,
          recentFingerprints
        );
        if (accepted) return accepted;
      }
    }

    const fallback = await buildVariedFallbackPost(
      {
        topics: input.topics,
        focusTopic: focus,
        concreteSubject: trySubject,
        subjectIndex: input.subjectIndex,
        recentTitles,
        avoidSubjects: input.avoidSubjects,
      },
      pickRandomPersona(),
      variant + fbIndex
    );

    const { accepted } = await acceptGeneratedPost(
      fallback,
      recentTitles,
      recentFingerprints
    );
    return accepted;
  };

  const avoidForDiscovery = () => [
    ...(input.avoidSubjects ?? []),
    ...(input.usedSubjects ?? []),
    ...triedSubjects,
  ];

  for (let fb = 0; fb < MAX_FALLBACK_ITERATIONS; fb++) {
    const trySubject =
      fb === 0
        ? subject
        : await discoverConcreteSubject({
            topic: focus,
            subjectIndex: (input.subjectIndex ?? 0) + variant + fb * 17,
            recentTitles,
            avoidSubjects: avoidForDiscovery(),
          });

    const accepted = await tryGenerateForSubject(trySubject ?? "", fb);
    if (accepted) return accepted;
  }

  for (let w = 0; w < 3; w++) {
    const wikiSubject = await discoverWikipediaSubject(
      focus,
      variant + 200 + w * 31,
      avoidForDiscovery()
    );
    if (!wikiSubject) continue;

    const accepted = await tryGenerateForSubject(
      wikiSubject,
      MAX_FALLBACK_ITERATIONS + w
    );
    if (accepted) return accepted;
  }

  return null;
}