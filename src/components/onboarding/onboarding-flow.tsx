"use client";

import { useState } from "react";

const TOPICS = ["AI", "Science", "History", "Tech", "Philosophy", "Biology", "Physics", "Art"];

export function OnboardingFlow() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="onboarding-root flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="onboarding-card w-full max-w-lg">
        <div className="mb-8 flex gap-1.5">
          <div className="onboarding-step-indicator onboarding-step-indicator--filled h-0.5 flex-1 rounded-full" />
          <div className="onboarding-step-indicator h-0.5 flex-1 rounded-full" />
        </div>
        <div className="onboarding-step">
          <div className="onboarding-orb mx-auto mb-8" />
          <h1 className="text-center text-2xl font-semibold tracking-tight text-[var(--color-coffee-text)]">
            InsightScroll
          </h1>
          <p className="mt-2 text-center text-sm text-[var(--color-coffee-text-soft)]">
            Choose interests to personalize your feed.
          </p>
          <div className="onboarding-chip-grid mt-6">
            {TOPICS.map((t, i) => (
              <button
                key={i}
                onClick={() =>
                  setSelected((s) =>
                    s.includes(t) ? s.filter((x) => x !== t) : [...s, t]
                  )
                }
                className={`onboarding-chip ${selected.includes(t) ? "onboarding-chip-active" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="onboarding-progress-track mx-auto mt-8 h-1 max-w-xs overflow-hidden rounded-full">
            <div
              className="onboarding-progress-bar h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(selected.length * 12, 100)}%` }}
            />
          </div>
          <button className="onboarding-btn-primary mt-8 w-full">Build my feed</button>
        </div>
      </div>
    </div>
  );
}