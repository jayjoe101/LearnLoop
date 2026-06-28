"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { addTopic, removeTopic } from "@/lib/actions";
import { PlusIcon, TagsIcon } from "@/components/icons";
import { useActionTooltip } from "@/hooks/use-action-tooltip";
import type { Topic } from "@/lib/types";

const PANEL_WIDTH = 288;
const PANEL_GAP = 10;

function computePanelPosition(anchor: DOMRect) {
  const padding = 16;
  let left = anchor.left + anchor.width / 2 - PANEL_WIDTH / 2;
  left = Math.max(padding, Math.min(left, window.innerWidth - PANEL_WIDTH - padding));
  return { top: anchor.bottom + PANEL_GAP, left };
}

type Props = {
  topics: Topic[];
};

export function InterestsMenu({ topics }: Props) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [topicInput, setTopicInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [panelNode, setPanelNode] = useState<HTMLDivElement | null>(null);

  const tooltip = useActionTooltip({ label: "Interests", placement: "below" });
  const buttonRef = tooltip.anchorRef;

  const updatePosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    setPosition(computePanelPosition(el.getBoundingClientRect()));
  }, [buttonRef]);

  const closePanel = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300);
  }, [open, closing]);

  const toggleOpen = useCallback(() => {
    tooltip.hide();
    if (open) {
      closePanel();
      return;
    }
    updatePosition();
    setOpen(true);
    setClosing(false);
  }, [open, closePanel, updatePosition, tooltip]);

  useEffect(() => {
    if (!open) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelNode?.contains(target)) {
        return;
      }
      closePanel();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePanel();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition, closePanel, buttonRef, panelNode]);

  function handleAddTopic(event: FormEvent) {
    event.preventDefault();
    const name = topicInput.trim();
    if (!name) return;

    startTransition(async () => {
      await addTopic(name);
      setTopicInput("");
    });
  }

  const panelPortal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={setPanelNode}
            className={`interests-panel${closing ? " interests-panel--closing" : ""}`}
            style={{ top: position.top, left: position.left }}
            role="dialog"
            aria-label="Your interests"
          >
            <div className="interests-panel__body">
              <p className="interests-panel__heading">Your interests</p>
              <div className="interests-panel__chips">
                {topics.length === 0 ? (
                  <p className="interests-panel__empty">No interests yet</p>
                ) : (
                  topics.map((topic, index) => (
                    <button
                      key={topic.id}
                      type="button"
                      disabled={isPending}
                      aria-label={`Remove ${topic.name} from interests`}
                      style={{ animationDelay: `${index * 40}ms` }}
                      onClick={() =>
                        startTransition(async () => {
                          await removeTopic(topic.id);
                        })
                      }
                      className="interests-panel__chip chip-tactile btn-tactile"
                    >
                      {topic.name}
                    </button>
                  ))
                )}
              </div>
            </div>
            <form className="interests-panel__form" onSubmit={handleAddTopic}>
              <input
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                placeholder="Add interest"
                className="interests-panel__input ll-text-input"
              />
              <button
                type="submit"
                disabled={!topicInput.trim() || isPending}
                className="interests-panel__add-btn"
                aria-label="Add interest"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label="Interests"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-describedby={open ? undefined : tooltip.describedBy}
        aria-pressed={open}
        {...(open ? {} : tooltip.handlers)}
        className={`toolbar-icon-btn${open ? " toolbar-icon-btn-active" : ""}`}
      >
        <span className="toolbar-icon-glyph" aria-hidden>
          <TagsIcon className="h-4 w-4" />
        </span>
      </button>
      {!open && tooltip.tooltipPortal}
      {panelPortal}
    </>
  );
}