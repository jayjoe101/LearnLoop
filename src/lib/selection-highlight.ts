export const SELECTION_LINE_TOLERANCE_PX = 4;
export const SELECTION_MERGE_GAP_PX = 12;

export type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type RelativeRect = HighlightRect & {
  right: number;
  bottom: number;
};

export type DocumentSelection = {
  text: string;
  rects: HighlightRect[];
};

export type PostToolbarSelection = DocumentSelection & {
  toolbarTop: number;
  toolbarLeft: number;
};

export function mergeSelectionRects(rects: RelativeRect[]): HighlightRect[] {
  if (rects.length === 0) return [];

  const lines: RelativeRect[][] = [];

  for (const rect of rects) {
    const line = lines.find(
      (group) => Math.abs(group[0].top - rect.top) <= SELECTION_LINE_TOLERANCE_PX
    );
    if (line) line.push(rect);
    else lines.push([rect]);
  }

  const merged: HighlightRect[] = [];

  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);

    let current: RelativeRect = { ...line[0] };

    for (let i = 1; i < line.length; i += 1) {
      const next = line[i];
      const gap = next.left - current.right;

      if (gap <= SELECTION_MERGE_GAP_PX) {
        const right = Math.max(current.right, next.right);
        const bottom = Math.max(current.bottom, next.bottom);
        const top = Math.min(current.top, next.top);
        current = {
          top,
          left: current.left,
          width: right - current.left,
          height: bottom - top,
          right,
          bottom,
        };
      } else {
        merged.push({
          top: current.top,
          left: current.left,
          width: current.width,
          height: current.bottom - current.top,
        });
        current = { ...next };
      }
    }

    merged.push({
      top: current.top,
      left: current.left,
      width: current.width,
      height: current.bottom - current.top,
    });
  }

  return merged;
}

export function getRangeHighlightRects(range: Range): HighlightRect[] {
  const relative = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .map((rect) => ({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    }));

  return mergeSelectionRects(relative);
}

export function getBoundsFromRects(rects: HighlightRect[]) {
  const first = rects[0];
  let top = first.top;
  let left = first.left;
  let right = first.left + first.width;
  let bottom = first.top + first.height;

  for (let i = 1; i < rects.length; i += 1) {
    const rect = rects[i];
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.left + rect.width);
    bottom = Math.max(bottom, rect.top + rect.height);
  }

  return { top, left, right, bottom };
}

export function getActiveDocumentRange(): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  return selection.getRangeAt(0);
}

export function rangeIntersectsElement(range: Range, element: HTMLElement): boolean {
  const elementRange = document.createRange();
  elementRange.selectNodeContents(element);

  return (
    range.compareBoundaryPoints(Range.END_TO_START, elementRange) > 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, elementRange) < 0
  );
}

export function readDocumentSelection(): DocumentSelection | null {
  const range = getActiveDocumentRange();
  if (!range) return null;

  const text = window.getSelection()?.toString() ?? "";
  if (!text.trim()) return null;

  const rects = getRangeHighlightRects(range);
  if (rects.length === 0) return null;

  return { text, rects };
}

export function readPostToolbarSelection(
  toolbarOffset = 8,
  toolbarWidth = 72
): PostToolbarSelection | null {
  const range = getActiveDocumentRange();
  if (!range) return null;

  const text = window.getSelection()?.toString() ?? "";
  if (!text.trim()) return null;

  const proseElements = document.querySelectorAll<HTMLElement>(
    ".post-text-selection .post-prose"
  );

  for (const prose of proseElements) {
    if (!rangeIntersectsElement(range, prose)) continue;

    const rects = getRangeHighlightRects(range);
    if (rects.length === 0) return null;

    const bounds = getBoundsFromRects(rects);
    return {
      text,
      rects,
      toolbarTop: bounds.top - toolbarOffset,
      toolbarLeft: bounds.right - toolbarWidth,
    };
  }

  return null;
}

export function setSelectionHighlightActive(active: boolean) {
  document.documentElement.classList.toggle("selection-highlight-active", active);
}