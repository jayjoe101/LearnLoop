"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon, SparkIcon } from "@/components/icons";
import {
  getSelectionPortalRoot,
  readDocumentSelection,
  readPostToolbarSelection,
  setSelectionHighlightActive,
  type DocumentSelection,
  type PostToolbarSelection,
} from "@/lib/selection-highlight";

const TOOLBAR_WIDTH = 72;
const TOOLBAR_OFFSET = 8;

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
    Boolean(target.closest(".feed-header-controls, .post-selection-toolbar"))
  );
}

function preventSelectionCollapse(event: React.MouseEvent) {
  event.preventDefault();
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
  const [isSelecting, setIsSelecting] = useState(false);
  const [copied, setCopied] = useState(false);

  highlightRef.current = highlight;
  showToolbarRef.current = showToolbar;

  const clearChrome = useCallback(() => {
    setHighlight(null);
    setPostToolbar(null);
    setShowToolbar(false);
    setCopied(false);
    setIsSelecting(false);
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
      setShowToolbar(Boolean(toolbarSelection));
      shouldFinalizeToolbarRef.current = false;
      if (!toolbarSelection) {
        setCopied(false);
      }
      return;
    }

    setShowToolbar(false);
    setCopied(false);
  }, [clearChrome]);

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
      setShowToolbar(true);
    }
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        target instanceof Element &&
        target.closest(".post-selection-toolbar, .feed-header-controls")
      ) {
        return;
      }

      isPointerDownRef.current = true;
      shouldFinalizeToolbarRef.current = false;
      setIsSelecting(true);
      setShowToolbar(false);
      setCopied(false);
    };

    const onPointerUp = () => {
      isPointerDownRef.current = false;
      setIsSelecting(false);
      queueSync({ finalizeToolbar: true });
    };

    const onSelectionChange = () => {
      queueSync();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
      queueSync({ finalizeToolbar: showToolbarRef.current });
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
  }, [clearChrome, queueSync]);

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
    if (!showToolbar) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (isPostSelectableArea(target)) {
        return;
      }
      if (shouldIgnoreOutsidePointer(target)) return;
      setShowToolbar(false);
      setCopied(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showToolbar]);

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

  const portalRoot =
    typeof document !== "undefined" ? getSelectionPortalRoot() : null;

  const highlightPortal =
    portalRoot && highlight && highlight.rects.length > 0
      ? createPortal(
          <div
            className={
              isSelecting
                ? "selection-highlight-layer selection-highlight-layer--selecting"
                : "selection-highlight-layer"
            }
            aria-hidden
          >
            {highlight.rects.map((rect) => (
              <div
                key={`${Math.round(rect.top)}-${Math.round(rect.left)}-${Math.round(rect.width)}-${Math.round(rect.height)}`}
                className="selection-highlight"
                style={{
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                }}
              />
            ))}
          </div>,
          portalRoot
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
              aria-label="Ask AI about selection (coming soon)"
              disabled
              onMouseDown={preventSelectionCollapse}
            >
              <span className="toolbar-icon-glyph" aria-hidden>
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

  return (
    <>
      {highlightPortal}
      {toolbarPortal}
    </>
  );
}