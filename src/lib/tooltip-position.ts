export type TooltipPlacement = "above" | "below";

export type TooltipRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
};

export function computeTooltipPosition(
  rect: TooltipRect,
  placement: TooltipPlacement,
  gap = 8
): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: placement === "below" ? rect.bottom + gap : rect.top - gap,
  };
}

export function tooltipDescribedBy(visible: boolean, tooltipId: string): string | undefined {
  return visible ? tooltipId : undefined;
}