export const SELECTION_LINE_TOLERANCE_PX = 4;
export const SELECTION_MERGE_GAP_PX = 12;
export const SELECTION_MAX_LINE_HEIGHT_PX = 36;

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

export type HighlightLayers = {
  feedRects: HighlightRect[];
  fixedRects: HighlightRect[];
};

export type DocumentSelection = {
  text: string;
  feedRects: HighlightRect[];
  fixedRects: HighlightRect[];
};

export type PostToolbarSelection = DocumentSelection & {
  toolbarTop: number;
  toolbarLeft: number;
  panelTop: number;
  panelLeft: number;
};

export function getSelectionPortalRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(".feed-scroll") ?? document.body;
}

function isRectInsideFeedScrollViewport(
  rect: RelativeRect,
  feedScroll: HTMLElement
): boolean {
  const rootRect = feedScroll.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2;
  const centerX = rect.left + rect.width / 2;

  return (
    centerY >= rootRect.top &&
    centerY <= rootRect.bottom &&
    centerX >= rootRect.left &&
    centerX <= rootRect.right
  );
}

export function clientRectsToPortalRects(rects: HighlightRect[]): HighlightRect[] {
  const root = getSelectionPortalRoot();

  if (root === document.body) {
    return rects.map((rect) => ({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    }));
  }

  const rootRect = root.getBoundingClientRect();
  return rects.map((rect) => ({
    top: rect.top - rootRect.top + root.scrollTop,
    left: rect.left - rootRect.left + root.scrollLeft,
    width: rect.width,
    height: rect.height,
  }));
}

function splitTallRect(rect: RelativeRect): RelativeRect[] {
  if (rect.height <= SELECTION_MAX_LINE_HEIGHT_PX * 1.1) {
    return [rect];
  }

  const slices: RelativeRect[] = [];
  let top = rect.top;

  while (top < rect.bottom - 0.5) {
    const height = Math.min(SELECTION_MAX_LINE_HEIGHT_PX, rect.bottom - top);
    slices.push({
      top,
      left: rect.left,
      width: rect.width,
      height,
      right: rect.left + rect.width,
      bottom: top + height,
    });
    top += height;
  }

  return slices;
}

function normalizeSelectionRects(relative: RelativeRect[]): RelativeRect[] {
  const lineLike = relative.filter(
    (rect) => rect.height <= SELECTION_MAX_LINE_HEIGHT_PX * 1.25
  );
  const blockLike = relative.filter(
    (rect) => rect.height > SELECTION_MAX_LINE_HEIGHT_PX * 1.25
  );

  if (lineLike.length > 0) {
    return lineLike;
  }

  return blockLike.flatMap(splitTallRect);
}

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
        const top = Math.min(current.top, next.top);
        const height = Math.max(current.height, next.height);
        current = {
          top,
          left: current.left,
          width: right - current.left,
          height,
          right,
          bottom: top + height,
        };
      } else {
        merged.push({
          top: current.top,
          left: current.left,
          width: current.width,
          height: current.height,
        });
        current = { ...next };
      }
    }

    merged.push({
      top: current.top,
      left: current.left,
      width: current.width,
      height: current.height,
    });
  }

  return merged;
}

function isSubsumedHighlightRect(small: RelativeRect, large: RelativeRect): boolean {
  if (small === large) return false;

  const smallArea = small.width * small.height;
  const largeArea = large.width * large.height;
  if (smallArea >= largeArea * 0.6) return false;

  const verticalOverlap =
    Math.min(small.bottom, large.bottom) - Math.max(small.top, large.top);
  const horizontalOverlap =
    Math.min(small.right, large.right) - Math.max(small.left, large.left);

  const sharesLine =
    Math.abs(small.top - large.top) <= SELECTION_LINE_TOLERANCE_PX + 10;

  return (
    sharesLine &&
    verticalOverlap > small.height * 0.35 &&
    horizontalOverlap > small.width * 0.45 &&
    smallArea < largeArea
  );
}

function removeSubsumedHighlightRects(rects: RelativeRect[]): RelativeRect[] {
  return rects.filter(
    (candidate) =>
      !rects.some((other) => isSubsumedHighlightRect(candidate, other))
  );
}

function buildClientHighlightRects(range: Range): RelativeRect[] {
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

  const normalized = normalizeSelectionRects(relative);
  const merged = mergeSelectionRects(normalized);

  return removeSubsumedHighlightRects(
    merged.map((rect) => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    }))
  );
}

export function buildHighlightLayers(range: Range): HighlightLayers {
  const clientRects = buildClientHighlightRects(range);
  const feedScroll = document.querySelector<HTMLElement>(".feed-scroll");

  if (!feedScroll) {
    return {
      feedRects: clientRectsToPortalRects(clientRects),
      fixedRects: [],
    };
  }

  const feedClient: RelativeRect[] = [];
  const fixedClient: RelativeRect[] = [];

  for (const rect of clientRects) {
    if (isRectInsideFeedScrollViewport(rect, feedScroll)) {
      feedClient.push(rect);
    } else {
      fixedClient.push(rect);
    }
  }

  return {
    feedRects: clientRectsToPortalRects(feedClient),
    fixedRects: fixedClient.map((rect) => ({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })),
  };
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
  if (element.contains(range.startContainer) || element.contains(range.endContainer)) {
    return true;
  }

  const ancestor = range.commonAncestorContainer;
  if (element.contains(ancestor)) {
    return true;
  }

  try {
    const elementRange = document.createRange();
    elementRange.selectNodeContents(element);

    return (
      range.compareBoundaryPoints(Range.END_TO_START, elementRange) > 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, elementRange) < 0
    );
  } catch {
    return false;
  }
}

export function getAllowedToolbarElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-post-selectable], [data-post-body-content]"
    )
  );
}

function isNodeWithinAllowed(node: Node, allowed: HTMLElement[]): boolean {
  return allowed.some((element) => element.contains(node));
}

export function getPostCardForNode(node: Node): HTMLElement | null {
  const element =
    node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as Element | null);

  return element?.closest<HTMLElement>(".post-card") ?? null;
}

export function getPostIdFromRange(range: Range): string | null {
  const card = getPostCardForNode(range.startContainer);
  return card?.dataset.postId ?? null;
}

export function selectionIsEligibleForPostToolbar(range: Range): boolean {
  const allowed = getAllowedToolbarElements();
  if (allowed.length === 0) return false;

  const intersectsAllowed = allowed.some((element) =>
    rangeIntersectsElement(range, element)
  );
  if (!intersectsAllowed) return false;

  if (!isNodeWithinAllowed(range.startContainer, allowed)) return false;
  if (!isNodeWithinAllowed(range.endContainer, allowed)) return false;

  const startCard = getPostCardForNode(range.startContainer);
  const endCard = getPostCardForNode(range.endContainer);
  if (!startCard || !endCard || startCard !== endCard) return false;

  const sources = startCard.querySelector<HTMLElement>(".post-sources");
  if (sources && rangeIntersectsElement(range, sources)) {
    return false;
  }

  return true;
}

export function readDocumentSelection(): DocumentSelection | null {
  const range = getActiveDocumentRange();
  if (!range) return null;

  const text = window.getSelection()?.toString() ?? "";
  if (!text.trim()) return null;

  const layers = buildHighlightLayers(range);
  if (layers.feedRects.length === 0 && layers.fixedRects.length === 0) {
    return null;
  }

  return { text, ...layers };
}

export function readPostToolbarSelection(
  toolbarOffset = 8,
  toolbarWidth = 72
): PostToolbarSelection | null {
  const range = getActiveDocumentRange();
  if (!range) return null;

  if (!selectionIsEligibleForPostToolbar(range)) return null;

  const text = window.getSelection()?.toString() ?? "";
  if (!text.trim()) return null;

  const layers = buildHighlightLayers(range);
  if (layers.feedRects.length === 0) return null;

  const bounds = getBoundsFromRects(layers.feedRects);
  return {
    text,
    ...layers,
    toolbarTop: bounds.top - toolbarOffset,
    toolbarLeft: bounds.right - toolbarWidth,
    panelTop: bounds.bottom + 10,
    panelLeft: bounds.left,
  };
}

export function setSelectionHighlightActive(active: boolean) {
  document.documentElement.classList.toggle("selection-highlight-active", active);
}