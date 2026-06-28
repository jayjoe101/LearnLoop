"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon, SparkIcon } from "@/components/icons";
import { SelectionExplainPanel } from "@/components/selection-explain-panel";
import { useActionTooltip } from "@/hooks/use-action-tooltip";
import {
  getActiveDocumentRange,
  getPostIdFromRange,
  getSelectionPortalRoot,
  rangeIsWithinExplainPanel,
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
  pinnedHighlight: DocumentSelection;
};

function isPostSelectableArea(target: Node) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        ".post-text-selection, [data-post-selectable], [data-post-body-content]"
      )
    )
  );
}

function shouldIgnoreOutsidePointer(target: Node) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        ".feed-header-controls, .post-selection-toolbar, .action-tooltip__label"
      )
    )
  );
}

function isExplainPanelTarget(target: Node) {
  return (
    target instanceof Element &&
    Boolean(target.closest(".selection-explain-panel"))
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
  const suppressSelectionClearRef = useRef(false);
  const highlightRef = useRef<DocumentSelection | null>(null);
  const postToolbarRef = useRef<PostToolbarSelection | null>(null);
  const postIdRef = useRef<string | null>(null);
  const showToolbarRef = useRef(false);
  const explainSessionRef = useRef<ExplainSession | null>(null);
  const pinExplainSessionRef = useRef(false);
  const toolbarInteractionRef = useRef(false);
  const outsideExplainDismissRef = useRef(false);

  const [highlight, setHighlight] = useState<DocumentSelection | null>(null);
  const [postToolbar, setPostToolbar] = useState<PostToolbarSelection | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [copied, setCopied] = useState(false);
  const [explainSession, setExplainSession] = useState<ExplainSession | null>(null);
  const [panelHighlight, setPanelHighlight] = useState<DocumentSelection | null>(null);

  const explainTooltip = useActionTooltip({
    label: "Explain selection",
    placement: "above",
  });
  const copyTooltip = useActionTooltip({
    label: copied ? "Copied" : "Copy",
    placement: "above",
  });

  highlightRef.current = highlight;
  postToolbarRef.current = postToolbar;
  showToolbarRef.current = showToolbar;
  explainSessionRef.current = explainSession;

  const clearChrome = useCallback(() => {
    setHighlight(null);
    setPostToolbar(null);
    setShowToolbar(false);
    setCopied(false);
    setExplainSession(null);
    setPanelHighlight(null);
    explainSessionRef.current = null;
    postIdRef.current = null;
    pinExplainSessionRef.current = false;
    toolbarInteractionRef.current = false;
    outsideExplainDismissRef.current = false;
    setSelectionHighlightActive(false);
    shouldFinalizeToolbarRef.current = false;
    suppressSelectionClearRef.current = false;
  }, []);

  const dismissExplainSession = useCallback(() => {
    setExplainSession(null);
    setPanelHighlight(null);
    explainSessionRef.current = null;
    pinExplainSessionRef.current = false;
  }, []);

  const restorePostHighlightFromToolbar = useCallback(() => {
    const toolbar = postToolbarRef.current;
    if (!toolbar) return;

    setHighlight({
      text: toolbar.text,
      feedRects: toolbar.feedRects,
      fixedRects: toolbar.fixedRects,
      panelRects: [],
    });
    setSelectionHighlightActive(true);
  }, []);

  const closeExplainAndRestoreToolbar = useCallback(() => {
    outsideExplainDismissRef.current = true;
    dismissExplainSession();
    restorePostHighlightFromToolbar();
    setShowToolbar(Boolean(postToolbarRef.current));
  }, [dismissExplainSession, restorePostHighlightFromToolbar]);

  const runSync = useCallback(() => {
    const range = getActiveDocumentRange();
    const inExplainPanel = range ? rangeIsWithinExplainPanel(range) : false;
    const next = readDocumentSelection();

    if (explainSessionRef.current) {
      if (inExplainPanel) {
        setPanelHighlight(next);
        setSelectionHighlightActive(true);
        return;
      }

      if (!shouldFinalizeToolbarRef.current) {
        return;
      }

      shouldFinalizeToolbarRef.current = false;

      if (pinExplainSessionRef.current) {
        pinExplainSessionRef.current = false;
        return;
      }

      dismissExplainSession();
      setPanelHighlight(null);

      if (!next) {
        restorePostHighlightFromToolbar();
        setShowToolbar(Boolean(postToolbarRef.current));
        return;
      }
    }

    if (!next) {
      if (
        suppressSelectionClearRef.current ||
        toolbarInteractionRef.current ||
        pinExplainSessionRef.current ||
        outsideExplainDismissRef.current
      ) {
        return;
      }
      clearChrome();
      return;
    }

    if (!shouldFinalizeToolbarRef.current) {
      setHighlight(next);
      setSelectionHighlightActive(true);
      return;
    }

    shouldFinalizeToolbarRef.current = false;

    const toolbarSelection = readPostToolbarSelection(
      TOOLBAR_OFFSET,
      TOOLBAR_WIDTH
    );

    setHighlight(next);
    setSelectionHighlightActive(true);
    setPanelHighlight(null);
    setPostToolbar(toolbarSelection);

    if (toolbarSelection && range) {
      postIdRef.current = getPostIdFromRange(range);
    }

    if (toolbarSelection) {
      setShowToolbar(true);
      return;
    }

    setShowToolbar(false);
    setCopied(false);
  }, [clearChrome, dismissExplainSession, restorePostHighlightFromToolbar]);

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
      if (!explainSessionRef.current) {
        setShowToolbar(true);
      }
    }
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (shouldIgnoreOutsidePointer(target)) {
        if (
          target instanceof Element &&
          target.closest(".post-selection-toolbar")
        ) {
          toolbarInteractionRef.current = true;
        }
        return;
      }

      if (isExplainPanelTarget(target)) {
        isPointerDownRef.current = true;
        shouldFinalizeToolbarRef.current = false;
        suppressSelectionClearRef.current = true;
        return;
      }

      if (
        explainSessionRef.current &&
        !isExplainPanelTarget(target) &&
        !shouldIgnoreOutsidePointer(target)
      ) {
        closeExplainAndRestoreToolbar();
      }

      if (isPostSelectableArea(target)) {
        isPointerDownRef.current = true;
        shouldFinalizeToolbarRef.current = false;
        suppressSelectionClearRef.current = false;
        setShowToolbar(false);
        setCopied(false);
        return;
      }

      isPointerDownRef.current = true;
      shouldFinalizeToolbarRef.current = false;
      suppressSelectionClearRef.current = false;
      setShowToolbar(false);
      setCopied(false);
    };

    const onPointerUp = (event: PointerEvent) => {
      const target = event.target as Node;

      if (shouldIgnoreOutsidePointer(target)) {
        isPointerDownRef.current = false;
        return;
      }

      isPointerDownRef.current = false;

      if (outsideExplainDismissRef.current) {
        outsideExplainDismissRef.current = false;
        suppressSelectionClearRef.current = false;

        if (isPostSelectableArea(target)) {
          queueSync({ finalizeToolbar: true });
        }
        return;
      }

      if (isExplainPanelTarget(target)) {
        suppressSelectionClearRef.current = false;
        queueSync();
        return;
      }

      suppressSelectionClearRef.current = false;
      queueSync({ finalizeToolbar: true });
    };

    const onSelectionChange = () => {
      queueSync();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (explainSessionRef.current) {
          closeExplainAndRestoreToolbar();
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
      queueSync({
        finalizeToolbar:
          showToolbarRef.current || Boolean(explainSessionRef.current),
      });
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
  }, [clearChrome, closeExplainAndRestoreToolbar, queueSync]);

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

  function handleCloseExplain() {
    closeExplainAndRestoreToolbar();
  }

  async function handleCopy() {
    const toolbar = postToolbar ?? postToolbarRef.current;
    if (!toolbar?.text) return;

    copyTooltip.hide();
    toolbarInteractionRef.current = false;

    try {
      await navigator.clipboard.writeText(toolbar.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function handleExplain() {
    const toolbar = postToolbar ?? postToolbarRef.current;
    if (!toolbar) return;

    const postId = postIdRef.current;
    if (!postId) return;

    const pinnedHighlight: DocumentSelection = highlightRef.current ?? {
      text: toolbar.text,
      feedRects: toolbar.feedRects,
      fixedRects: toolbar.fixedRects,
      panelRects: [],
    };

    const session: ExplainSession = {
      postId,
      selectedText: toolbar.text,
      panelTop: toolbar.panelTop,
      panelLeft: toolbar.panelLeft,
      pinnedHighlight,
    };

    explainTooltip.hide();
    pinExplainSessionRef.current = true;
    toolbarInteractionRef.current = false;
    explainSessionRef.current = session;
    setPanelHighlight(null);
    setHighlight(pinnedHighlight);
    setSelectionHighlightActive(true);
    setShowToolbar(false);
    setExplainSession(session);
  }

  const postHighlight = explainSession?.pinnedHighlight ?? highlight;
  const activePanelHighlight = panelHighlight ?? null;

  const portalRoot =
    typeof document !== "undefined" ? getSelectionPortalRoot() : null;

  const feedHighlightPortal =
    portalRoot && postHighlight && postHighlight.feedRects.length > 0
      ? createPortal(
          <div className="selection-highlight-layer" aria-hidden>
            {renderHighlightRects(postHighlight.feedRects, "selection-highlight")}
          </div>,
          portalRoot
        )
      : null;

  const fixedHighlightPortal =
    postHighlight &&
    postHighlight.fixedRects.length > 0 &&
    typeof document !== "undefined"
      ? createPortal(
          <div className="selection-highlight-layer selection-highlight-layer--fixed" aria-hidden>
            {renderHighlightRects(
              postHighlight.fixedRects,
              "selection-highlight selection-highlight--fixed"
            )}
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
              ref={explainTooltip.anchorRef}
              type="button"
              className="toolbar-icon-btn"
              aria-label="Explain selection with AI"
              aria-describedby={explainTooltip.describedBy}
              onMouseDown={preventSelectionCollapse}
              onClick={handleExplain}
              {...explainTooltip.handlers}
            >
              <span className="toolbar-icon-glyph toolbar-insight-icon" aria-hidden>
                <SparkIcon className="h-3.5 w-3.5" />
              </span>
            </button>
            <button
              ref={copyTooltip.anchorRef}
              type="button"
              className="toolbar-icon-btn"
              aria-label={copied ? "Copied" : "Copy selection"}
              aria-describedby={copyTooltip.describedBy}
              onMouseDown={preventSelectionCollapse}
              onClick={handleCopy}
              {...copyTooltip.handlers}
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

  const selectionTooltipPortals =
    typeof document !== "undefined" ? (
      <>
        {explainTooltip.tooltipPortal}
        {copyTooltip.tooltipPortal}
      </>
    ) : null;

  const explainPortal =
    portalRoot && explainSession
      ? createPortal(
          <SelectionExplainPanel
            postId={explainSession.postId}
            selectedText={explainSession.selectedText}
            top={explainSession.panelTop}
            left={explainSession.panelLeft}
            panelHighlightRects={activePanelHighlight?.panelRects ?? []}
            onClose={handleCloseExplain}
          />,
          portalRoot
        )
      : null;

  return (
    <>
      {feedHighlightPortal}
      {fixedHighlightPortal}
      {toolbarPortal}
      {selectionTooltipPortals}
      {explainPortal}
    </>
  );
}