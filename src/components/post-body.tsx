"use client";

import React from "react";
import {
  enrichBodyBlocks,
  parseBodyBlocks,
  parseInlineSegments,
  parseRichTextSegments,
  type BodyBlock,
} from "@/lib/post-content";
import { highlightCodeToHtml, renderMathToHtml } from "@/lib/post-render";
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

function LinkSegments({
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

function InlineContent({
  text,
  wikiSource,
}: {
  text: string;
  wikiSource: "wikipedia" | "grokipedia";
}) {
  const segments = parseRichTextSegments(text);

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.type === "math-inline") {
          const html = renderMathToHtml(segment.latex, false);
          return (
            <span
              key={i}
              className="post-math-inline"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        if (segment.type === "code-inline") {
          return (
            <code key={i} className="post-inline-code">
              {segment.value}
            </code>
          );
        }

        const content = (
          <LinkSegments text={segment.value} wikiSource={wikiSource} />
        );

        switch (segment.type) {
          case "bold":
            return (
              <strong key={i} className="post-text-bold">
                {content}
              </strong>
            );
          case "italic":
            return (
              <em key={i} className="post-text-italic">
                {content}
              </em>
            );
          case "highlight":
            return (
              <mark key={i} className="post-text-highlight">
                {content}
              </mark>
            );
          default:
            return <span key={i}>{content}</span>;
        }
      })}
    </>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const html = highlightCodeToHtml(code, language);

  return (
    <pre className="post-code-block">
      <code
        className={`post-code-block__code language-${language || "text"}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );
}

function DisplayMath({ latex }: { latex: string }) {
  const html = renderMathToHtml(latex, true);

  return (
    <div
      className="post-math-display"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Serializable description of rendered blocks — used by verification scripts. */
export function describeRenderedBlocks(
  blocks: BodyBlock[],
  wikiSource: "wikipedia" | "grokipedia" = "wikipedia"
): string[] {
  return blocks.map((block) => {
    if (block.type === "paragraph") {
      const rich = parseRichTextSegments(block.text);
      const kinds = rich.map((s) => s.type).join(",");
      const inline = parseInlineSegments(block.text, wikiSource)
        .map((s) => s.type)
        .join(",");
      return `paragraph:rich=[${kinds}] inline=[${inline}]`;
    }
    if (block.type === "code") {
      return `code:lang=${block.language} len=${block.code.length}`;
    }
    return `display-math:latex=${block.latex}`;
  });
}

function renderBlock(
  block: BodyBlock,
  index: number,
  wikiSource: "wikipedia" | "grokipedia",
  paragraphIndex: number
) {
  if (block.type === "code") {
    return <CodeBlock key={index} language={block.language} code={block.code} />;
  }

  if (block.type === "display-math") {
    return <DisplayMath key={index} latex={block.latex} />;
  }

  const isLead = paragraphIndex === 0;

  return (
    <p
      key={index}
      className={isLead ? "post-prose-lead" : "post-prose-paragraph"}
    >
      <InlineContent text={block.text} wikiSource={wikiSource} />
    </p>
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
  const blocks = enrichBodyBlocks(parseBodyBlocks(body), terms);
  const sourceLinks = links ?? [];

  let paragraphIndex = 0;

  return (
    <div className="post-prose">
      {blocks.map((block, index) => {
        const node = renderBlock(
          block,
          index,
          wikiSource,
          block.type === "paragraph" ? paragraphIndex : -1
        );
        if (block.type === "paragraph") paragraphIndex += 1;
        return node;
      })}

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