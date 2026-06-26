export {
  type WikiSummary,
  discoverWikipediaSubject,
  fetchWikipediaSummary,
  isPlaceholderSubject,
  resolveSubjectWikipediaCandidates,
  resolveSubjectWikipediaSummary,
  searchWikipediaTitles,
} from "@/lib/wiki-fetch";

export { composeTeachingAnswer, type ComposedTeaching } from "@/lib/teaching-compose";

export {
  bodyAnswersSubject,
  extractSubjectKeywords,
  isCoherentTeachingBody,
  isSubjectBodyAligned,
  teachesSpecificTakeaway,
} from "@/lib/teaching-validate";