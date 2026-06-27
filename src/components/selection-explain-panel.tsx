"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SparkIcon } from "@/components/icons";
import { chatAboutSelection } from "@/lib/actions";
import type { SelectionChatMessage } from "@/lib/selection-explain";

type Props = {
  postId: string;
  selectedText: string;
  top: number;
  left: number;
  onClose: () => void;
};

export function SelectionExplainPanel({
  postId,
  selectedText,
  top,
  left,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<SelectionChatMessage[]>([]);
  const [thinking, setThinking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const result = await chatAboutSelection({
        postId,
        selectedText,
        messages: [],
      });

      if ("error" in result) {
        setError(result.error);
        setThinking(false);
        return;
      }

      setMessages([{ role: "assistant", content: result.content }]);
      setThinking(false);
    })();
  }, [postId, selectedText]);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, thinking, error]);

  async function handleFollowUp(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || thinking || sending) return;

    const nextMessages: SelectionChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];

    setDraft("");
    setMessages(nextMessages);
    setThinking(true);
    setSending(true);
    setError(null);

    const result = await chatAboutSelection({
      postId,
      selectedText,
      messages: nextMessages,
    });

    setSending(false);

    if ("error" in result) {
      setError(result.error);
      setThinking(false);
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "assistant", content: result.content },
    ]);
    setThinking(false);
  }

  return (
    <div
      className="selection-explain-panel"
      style={{ top, left }}
      role="dialog"
      aria-label="Explain selection"
    >
      <div className="selection-explain-panel__header">
        <span
          className={`selection-explain-panel__spark ${thinking ? "selection-explain-panel__spark--thinking" : ""}`}
          aria-hidden
        >
          <SparkIcon className="h-3.5 w-3.5" />
        </span>
        <p className="selection-explain-panel__title">
          {thinking ? "Thinking…" : "Explain selection"}
        </p>
        <button
          type="button"
          className="selection-explain-panel__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div ref={bodyRef} className="selection-explain-panel__body">
        <p className="selection-explain-panel__quote">“{selectedText}”</p>

        {error && <p className="selection-explain-panel__error">{error}</p>}

        {thinking && messages.length === 0 && !error && (
          <div className="selection-explain-thinking" aria-live="polite">
            <span />
            <span />
            <span />
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "assistant"
                ? "selection-explain-message selection-explain-message--assistant"
                : "selection-explain-message selection-explain-message--user"
            }
          >
            {message.content}
          </div>
        ))}

        {thinking && messages.length > 0 && (
          <div className="selection-explain-thinking selection-explain-thinking--inline" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <form className="selection-explain-panel__form" onSubmit={handleFollowUp}>
        <input
          type="text"
          className="selection-explain-panel__input"
          placeholder="Ask a follow-up…"
          value={draft}
          onMouseDown={(event) => event.preventDefault()}
          onChange={(event) => setDraft(event.target.value)}
          disabled={thinking || sending}
        />
        <button
          type="submit"
          className="selection-explain-panel__send"
          disabled={thinking || sending || !draft.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}