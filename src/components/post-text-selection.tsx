"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyIcon, SparkIcon } from "@/components/icons";

const TOOLBAR_WIDTH = 72;
const TOOLBAR_OFFSET = 8;

type ToolbarState = {
  top: number;
  left: number;
  text: string;
};

function getSelectionInContainer(
  container: HTMLElement
): { text: string; rect: DOMRect } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const ancestor = range.commonAncestorContainer;
  if (!container.contains(ancestor)) return null;

  const text = selection.toString();
  if (!text.trim()) return null;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return { text, rect };
}

export function PostTextSelection({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const liveId = useId();
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const [copied, setCopied] = useState(false);

  const clearToolbar = useCallback(() => {
    setToolbar(null);
    setCopied(false);
  }, []);

  const updateToolbar = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      clearToolbar();
      return;
    }

    const result = getSelectionInContainer(container);
    if (!result) {
      clearToolbar();
      return;
    }

    setCopied(false);
    setToolbar({
      top: result.rect.top - TOOLBAR_OFFSET,
      left: result.rect.right - TOOLBAR_WIDTH,
      text: result.text,
    });
  }, [clearToolbar]);

  useEffect(() => {
    const onMouseUp = () => {
      requestAnimationFrame(updateToolbar);
    };

    const onSelectionChange = () => {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed) {
        clearToolbar();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearToolbar();
    };

    const onScroll = () => {
      if (!toolbar) return;
      updateToolbar();
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [clearToolbar, toolbar, updateToolbar]);

  useEffect(() => {
    if (!toolbar) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (toolbarRef.current?.contains(target)) return;
      if (containerRef.current?.contains(target)) return;
      clearToolbar();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [clearToolbar, toolbar]);

  async function handleCopy() {
    if (!toolbar?.text) return;

    try {
      await navigator.clipboard.writeText(toolbar.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const toolbarPortal =
    toolbar && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={toolbarRef}
            className="post-selection-toolbar toolbar-icon-group"
            style={{
              top: Math.max(8, toolbar.top - 36),
              left: Math.max(8, toolbar.left),
            }}
            role="toolbar"
            aria-label="Text selection actions"
          >
            <button
              type="button"
              className="toolbar-icon-btn"
              aria-label="Ask AI about selection (coming soon)"
              disabled
            >
              <span className="toolbar-icon-glyph" aria-hidden>
                <SparkIcon className="h-3.5 w-3.5" />
              </span>
            </button>
            <button
              type="button"
              className="toolbar-icon-btn"
              aria-label={copied ? "Copied" : "Copy selection"}
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
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className="post-text-selection">
      {children}
      {toolbarPortal}
    </div>
  );
}