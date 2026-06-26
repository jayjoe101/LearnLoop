import { isTooSimilar } from "@/lib/dedup";
import { finalizePostLinks } from "@/lib/post-content";
import type { Persona } from "@/lib/personas";
import { discoverConcreteSubject } from "@/lib/subject-discovery";
import type { PostLink, PostWikiTerm } from "@/lib/types";
import { composeTeachingAnswer } from "@/lib/teaching-compose";
import {
  bodyAnswersSubject,
  extractSubjectKeywords,
  isCoherentTeachingBody,
} from "@/lib/teaching-validate";
import {
  isPlaceholderSubject,
  mergeCandidateExtracts,
  resolveSubjectWikipediaCandidates,
} from "@/lib/wiki-fetch";

export type FallbackPostInput = {
  topics: string[];
  focusTopic?: string;
  concreteSubject?: string;
  subjectIndex?: number;
  recentTitles?: string[];
  avoidSubjects?: string[];
};

export type FallbackPost = {
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

function capitalizeSubject(subject: string): string {
  if (!subject) return subject;
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function mixSeed(subject: string, variant: number): number {
  let hash = variant;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildTitleFromSubject(subject: string): string {
  const clean = subject.replace(/\?$/g, "").trim();
  const titled = capitalizeSubject(clean);
  return titled.length <= 90 ? titled : `${titled.slice(0, 87)}…`;
}

export async function buildVariedFallbackPost(
  input: FallbackPostInput,
  persona: Persona,
  variant: number
): Promise<FallbackPost | null> {
  const focus = pickFocusTopic(input.topics, input.focusTopic);
  const subject =
    input.concreteSubject ??
    (await discoverConcreteSubject({
      topic: focus,
      subjectIndex: (input.subjectIndex ?? 0) + variant,
      recentTitles: input.recentTitles,
      avoidSubjects: input.avoidSubjects,
    }));

  if (!subject || isPlaceholderSubject(subject, focus)) return null;

  const allCandidates = await resolveSubjectWikipediaCandidates(subject);
  if (allCandidates.length === 0) return null;

  let candidates = allCandidates;
  const keywords = extractSubjectKeywords(subject);
  if (keywords.length >= 3) {
    const aligned = allCandidates.filter((candidate) => {
      const text = `${candidate.title} ${candidate.extract}`.toLowerCase();
      const hits = keywords.filter((kw) => {
        const variants = [kw, kw.replace(/-/g, " "), kw.replace(/-/g, "")];
        return variants.some((v) => v.length > 3 && text.includes(v));
      }).length;
      return hits >= Math.min(3, Math.ceil(keywords.length * 0.45));
    });
    if (aligned.length > 0) candidates = aligned;
  }

  const recentTitles = input.recentTitles ?? [];
  const seed = mixSeed(subject, ((variant % 89) + 89) % 89);

  let title = buildTitleFromSubject(subject);
  let tries = 0;
  while (isTooSimilar(title, recentTitles) && tries < 4) {
    title = buildTitleFromSubject(
      tries % 2 === 0 ? subject : `${subject} explained`
    );
    tries++;
  }

  for (let c = 0; c < candidates.length; c++) {
    const summary = candidates[c];
    const extractAttempts: Array<{ extract: string; wikiTitle: string }> = [
      { extract: summary.extract, wikiTitle: summary.title },
    ];
    const mergedFromC = mergeCandidateExtracts(subject, allCandidates, c);
    const mergedFromAll = mergeCandidateExtracts(subject, allCandidates, 0);
    const primaryWiki = candidates[0]?.title ?? summary.title;
    if (mergedFromC.length > 100) {
      extractAttempts.push({ extract: mergedFromC, wikiTitle: primaryWiki });
    }
    if (mergedFromAll.length > 100 && mergedFromAll !== mergedFromC) {
      extractAttempts.push({ extract: mergedFromAll, wikiTitle: primaryWiki });
    }

    let composed = null;
    for (let e = 0; e < extractAttempts.length; e++) {
      const { extract, wikiTitle } = extractAttempts[e];

      composed = await composeTeachingAnswer(
        subject,
        wikiTitle,
        extract,
        seed + tries + c + e * 3,
        persona
      );
      if (composed) break;
    }

    if (!composed) continue;
    if (!isCoherentTeachingBody(composed.body, subject)) continue;
    if (!bodyAnswersSubject(subject, composed.body)) continue;

    const wikiTerm = composed.wikiTerm;
    const wikiMatch =
      candidates.find((c) => c.title === wikiTerm) ?? summary;
    const wiki_terms = [{ term: wikiTerm }];

    return {
      topic: focus,
      title,
      body: composed.body,
      links: finalizePostLinks(
        [{ label: `${wikiTerm} on Wikipedia`, url: wikiMatch.url }],
        wikiTerm,
        wiki_terms
      ),
      wiki_terms,
      persona,
      subject,
    };
  }

  return null;
}