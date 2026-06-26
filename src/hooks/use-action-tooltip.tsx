"use client";

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  computeTooltipPosition,
  tooltipDescribedBy,
  type TooltipPlacement,
} from "@/lib/tooltip-position";

type Options = {
  label: string;
  placement?: TooltipPlacement;
};

export function useActionTooltip({ label, placement = "below" }: Options) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords(
      computeTooltipPosition(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
        },
        placement
      )
    );
  }, [placement]);

  const show = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const hide = useCallback(() => setVisible(false), []);

  const handlers = {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };

  const describedBy = tooltipDescribedBy(visible, tooltipId);

  const tooltipPortal =
    visible && typeof document !== "undefined"
      ? createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className={`action-tooltip__label action-tooltip__label--portal action-tooltip__label--${placement} action-tooltip__label--visible`}
            style={{ left: coords.x, top: coords.y }}
          >
            {label}
          </span>,
          document.body
        )
      : null;

  return { anchorRef, handlers, describedBy, tooltipPortal, tooltipId };
}