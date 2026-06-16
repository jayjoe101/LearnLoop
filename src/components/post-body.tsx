import {
  enrichBodyWithWikiTerms,
  parseInlineSegments,
  splitParagraphs,
} from "@/lib/post-content";
import { pickWikiSource } from "@/lib/wiki-links";
import type { FeedStyle, PostLink, PostWikiTerm } from "@/lib/types";

type Props = {
  body: string;
  links?: PostLink[] | null;
  wikiTerms?: PostWikiTerm[] | null;
  feedStyle?: FeedStyle;
  personaId?: string | null;
};

function WikiTermLink({
  term,
  url,
  source,
}: {
  term: string;
  url: string;
  source: "wikipedia" | "grokipedia";
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="post-wiki-link"
      title={`Read about ${term} on ${source === "grokipedia" ? "Grokipedia" : "Wikipedia"}`}
    >
      {term}
      <span className="post-wiki-link-icon" aria-hidden>
        ↗
      </span>
    </a>
  );
}

function InlineContent({
  text,
  wikiSource,
}: {
  text: string;
  wikiSource: "wikipedia" | "grokipedia";
}) {
  const segments = parseInlineSegments(text, wikiSource);

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.type === "text") {
          return <span key={i}>{segment.value}</span>;
        }

        if (segment.type === "wiki") {
          return (
            <WikiTermLink
              key={i}
              term={segment.term}
              url={segment.url}
              source={wikiSource}
            />
          );
        }

        return (
          <a
            key={i}
            href={segment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="post-inline-link"
          >
            {segment.label}
          </a>
        );
      })}
    </>
  );
}

export function PostBody({
  body,
  links,
  wikiTerms,
  feedStyle = "Balanced & insightful",
  personaId,
}: Props) {
  const wikiSource = pickWikiSource(feedStyle, personaId);
  const terms = wikiTerms ?? [];
  const enrichedBody = enrichBodyWithWikiTerms(body, terms);
  const paragraphs = splitParagraphs(enrichedBody);
  const sourceLinks = links ?? [];

  return (
    <div className="post-prose">
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className={index === 0 ? "post-prose-lead" : "post-prose-paragraph"}
        >
          <InlineContent text={paragraph} wikiSource={wikiSource} />
        </p>
      ))}

      {sourceLinks.length > 0 && (
        <div className="post-sources">
          <p className="post-sources-label">Further reading</p>
          <ul className="post-sources-list">
            {sourceLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="post-source-link"
                >
                  <span className="post-source-link-label">{link.label}</span>
                  <span className="post-source-link-host">
                    {safeHostname(link.url)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}