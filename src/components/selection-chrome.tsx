"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon, SparkIcon } from "@/components/icons";
import { SelectionExplainPanel } from "@/components/selection-explain-panel";
import {
  getActiveDocumentRange,
  getPostIdFromRange,
  getSelectionPortalRoot,
  readDocumentSelection,
  readPostToolbarSelection,
  setSelectionHighlightActive,
  type DocumentSelection,
  type PostToolbarSelection,
} from "@/lib/selection-highlight";

const TOOLBAR_WIDTH = 72;
const TOOLBAR_OFFSET = 8;

type ExplainSession = {
  postId: string;
  selectedText: string;
  panelTop: number;
  panelLeft: number;
};

function isPostSelectableArea(target: Node) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        ".post-text-selection, [data-post-selectable], [data-post-body-content], .selection-explain-panel"
      )
    )
  );
}

function shouldIgnoreOutsidePointer(target: Node) {
  return (
    target instanceof Element &&
    Boolean(target.closest(".feed-header-controls, .post-selection-toolbar"))
  );
}

function preventSelectionCollapse(event: React.MouseEvent) {
  event.preventDefault();
}

function renderHighlightRects(rects: DocumentSelection["feedRects"], className: string) {
  return rects.map((rect, index) => (
    <div
      key={index}
      className={className}
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    />
  ));
}

export function SelectionChrome() {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const liveId = useId();
  const rafRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const shouldFinalizeToolbarRef = useRef(false);
  const highlightRef = useRef<DocumentSelection | null>(null);
  const showToolbarRef = useRef(false);

  const [highlight, setHighlight] = useState<DocumentSelection | null>(null);
  const [postToolbar, setPostToolbar] = useState<PostToolbarSelection | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [explainSession, setExplainSession] = useState<ExplainSession | null>(null);

  highlightRef.current = highlight;
  showToolbarRef.current = showToolbar;

  const clearChrome = useCallback(() => {
    setHighlight(null);
    setPostToolbar(null);
    setShowToolbar(false);
    setCopied(false);
    setExplainSession(null);
    setSelectionHighlightActive(false);
    shouldFinalizeToolbarRef.current = false;
  }, []);

  const runSync = useCallback(() => {
    const next = readDocumentSelection();
    if (!next) {
      clearChrome();
      return;
    }

    setHighlight(next);
    setSelectionHighlightActive(true);

    const wantsToolbar =
      shouldFinalizeToolbarRef.current || !isPointerDownRef.current;

    if (wantsToolbar) {
      const toolbarSelection = readPostToolbarSelection(
        TOOLBAR_OFFSET,
        TOOLBAR_WIDTH
      );
      setPostToolbar(toolbarSelection);
      setShowToolbar(Boolean(toolbarSelection) && !explainSession);
      shouldFinalizeToolbarRef.current = false;
      if (!toolbarSelection) {
        setCopied(false);
        setExplainSession(null);
      }
      return;
    }

    setShowToolbar(false);
    setCopied(false);
  }, [clearChrome, explainSession]);

  const queueSync = useCallback(
    (options: { finalizeToolbar?: boolean } = {}) => {
      if (options.finalizeToolbar) {
        shouldFinalizeToolbarRef.current = true;
      }

      cancelAnimationFrame(rafRef.current);

      const run = () => {
        runSync();
      };

      if (shouldFinalizeToolbarRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(run);
        });
        return;
      }

      rafRef.current = requestAnimationFrame(run);
    },
    [runSync]
  );

  const restoreAfterThemeChange = useCallback(() => {
    const docSelection = readDocumentSelection();
    if (!docSelection) return;

    setHighlight(docSelection);
    setSelectionHighlightActive(true);

    const toolbarSelection = readPostToolbarSelection(TOOLBAR_OFFSET, TOOLBAR_WIDTH);
    if (toolbarSelection) {
      setPostToolbar(toolbarSelection);
      if (!explainSession) {
        setShowToolbar(true);
      }
    }
  }, [explainSession]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        target instanceof Element &&
        target.closest(
          ".post-selection-toolbar, .feed-header-controls, .selection-explain-panel"
        )
      ) {
        return;
      }

      isPointerDownRef.current = true;
      shouldFinalizeToolbarRef.current = false;
      setShowToolbar(false);
      setCopied(false);
      setExplainSession(null);
    };

    const onPointerUp = () => {
      isPointerDownRef.current = false;
      queueSync({ finalizeToolbar: true });
    };

    const onSelectionChange = () => {
      queueSync();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (explainSession) {
          setExplainSession(null);
          setShowToolbar(Boolean(postToolbar));
          return;
        }
        clearChrome();
        window.getSelection()?.removeAllRanges();
        return;
      }

      if (
        !isPointerDownRef.current &&
        (event.key.startsWith("Arrow") ||
          event.key === "Shift" ||
          event.key === "Home" ||
          event.key === "End")
      ) {
        queueSync({ finalizeToolbar: true });
      }
    };

    const onResize = () => {
      if (!highlightRef.current) return;
      queueSync({ finalizeToolbar: showToolbarRef.current || Boolean(explainSession) });
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      setSelectionHighlightActive(false);
    };
  }, [clearChrome, explainSession, postToolbar, queueSync]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      requestAnimationFrame(restoreAfterThemeChange);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [restoreAfterThemeChange]);

  useEffect(() => {
    if (!showToolbar && !explainSession) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".selection-explain-panel")) return;
      if (isPostSelectableArea(target)) return;
      if (shouldIgnoreOutsidePointer(target)) return;
      setShowToolbar(false);
      setCopied(false);
      setExplainSession(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [explainSession, showToolbar]);

  async function handleCopy() {
    if (!postToolbar?.text) return;

    try {
      await navigator.clipboard.writeText(postToolbar.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function handleExplain() {
    if (!postToolbar) return;

    const range = getActiveDocumentRange();
    const postId = range ? getPostIdFromRange(range) : null;
    if (!postId) return;

    setShowToolbar(false);
    setExplainSession({
      postId,
      selectedText: postToolbar.text,
      panelTop: postToolbar.panelTop,
      panelLeft: postToolbar.panelLeft,
    });
  }

  const portalRoot =
    typeof document !== "undefined" ? getSelectionPortalRoot() : null;

  const feedHighlightPortal =
    portalRoot && highlight && highlight.feedRects.length > 0
      ? createPortal(
          <div className="selection-highlight-layer" aria-hidden>
            {renderHighlightRects(highlight.feedRects, "selection-highlight")}
          </div>,
          portalRoot
        )
      : null;

  const fixedHighlightPortal =
    highlight && highlight.fixedRects.length > 0 && typeof document !== "undefined"
      ? createPortal(
          <div className="selection-highlight-layer selection-highlight-layer--fixed" aria-hidden>
            {renderHighlightRects(highlight.fixedRects, "selection-highlight selection-highlight--fixed")}
          </div>,
          document.body
        )
      : null;

  const toolbarPortal =
    portalRoot && showToolbar && postToolbar
      ? createPortal(
          <div
            ref={toolbarRef}
            className="post-selection-toolbar toolbar-icon-group"
            style={{
              top: postToolbar.toolbarTop - 36,
              left: postToolbar.toolbarLeft,
            }}
            role="toolbar"
            aria-label="Text selection actions"
          >
            <button
              type="button"
              className="toolbar-icon-btn"
              aria-label="Explain selection with AI"
              onMouseDown={preventSelectionCollapse}
              onClick={handleExplain}
            >
              <span className="toolbar-icon-glyph toolbar-insight-icon" aria-hidden>
                <SparkIcon className="h-3.5 w-3.5" />
              </span>
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              aria-label={copied ? "Copied" : "Copy selection"}
              onMouseDown={preventSelectionCollapse}
              onClick={handleCopy}
            >
              <span className="toolbar-icon-glyph" aria-hidden>
                <CopyIcon className="h-3.5 w-3.5" />
              </span>
            </button>
            <span id={liveId} className="sr-only" aria-live="polite">
              {copied ? "Copied to clipboard" : ""}
            </span>
          </div>,
          portalRoot
        )
      : null;

  const explainPortal =
    portalRoot && explainSession
      ? createPortal(
          <SelectionExplainPanel
            postId={explainSession.postId}
            selectedText={explainSession.selectedText}
            top={explainSession.panelTop}
            left={explainSession.panelLeft}
            onClose={() => {
              setExplainSession(null);
              setShowToolbar(Boolean(postToolbar));
            }}
          />,
          portalRoot
        )
      : null;

  return (
    <>
      {feedHighlightPortal}
      {fixedHighlightPortal}
      {toolbarPortal}
      {explainPortal}
    </>
  );
}