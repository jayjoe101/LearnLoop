"use client";

import { FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import { addTopic, removeTopic } from "@/lib/actions";
import { PlusIcon } from "@/components/icons";
import type { Topic } from "@/lib/types";

type Props = {
  topics: Topic[];
};

export function InterestsMenu({ topics }: Props) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleAddTopic(event: FormEvent) {
    event.preventDefault();
    const name = topicInput.trim();
    if (!name) return;

    startTransition(async () => {
      await addTopic(name);
      setTopicInput("");
    });
  }

  return (
    <div ref={rootRef} className="interests-menu">
      <button
        type="button"
        className={`tab-tactile interests-menu__trigger${open ? " interests-menu__trigger--open" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Interests
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Your interests"
          className="interests-menu__panel"
        >
          <p className="interests-menu__label">Your interests</p>
          <div className="interests-menu__tags">
            {topics.length === 0 ? (
              <p className="interests-menu__empty">No interests yet</p>
            ) : (
              topics.map((topic, index) => (
                <button
                  key={topic.id}
                  type="button"
                  role="menuitem"
                  disabled={isPending}
                  aria-label={`Remove ${topic.name} from interests`}
                  className="chip-tactile btn-tactile interests-menu__chip"
                  style={{ animationDelay: `${index * 28}ms` }}
                  onClick={() =>
                    startTransition(async () => {
                      await removeTopic(topic.id);
                    })
                  }
                >
                  {topic.name}
                </button>
              ))
            )}
          </div>

          <form className="interests-menu__form" onSubmit={handleAddTopic}>
            <input
              type="text"
              value={topicInput}
              onChange={(event) => setTopicInput(event.target.value)}
              placeholder="Add interest…"
              className="interests-menu__input ll-text-input"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={!topicInput.trim() || isPending}
              className="btn-tactile icon-btn interests-menu__add"
              aria-label="Add interest"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}