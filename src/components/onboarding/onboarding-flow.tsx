"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeOnboarding } from "@/lib/actions";
import { ONBOARDING_TOPICS } from "@/lib/types";

type Step = "welcome" | "interests" | "building";

const MIN_TOPICS = 3;
const DEFAULT_FEED_STYLE = "Balanced & insightful" as const;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [buildProgress, setBuildProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : prev.length < 8
          ? [...prev, topic]
          : prev
    );
  }

  function addCustomTopic() {
    const trimmed = customTopic.trim();
    if (!trimmed || selectedTopics.includes(trimmed)) return;
    if (selectedTopics.length >= 8) return;
    setSelectedTopics((prev) => [...prev, trimmed]);
    setCustomTopic("");
  }

  function goNext() {
    if (step === "welcome") setStep("interests");
    else if (step === "interests" && selectedTopics.length >= MIN_TOPICS) {
      setStep("building");
      startBuilding();
    }
  }

  function startBuilding() {
    setBuildProgress(12);
    const interval = setInterval(() => {
      setBuildProgress((p) => Math.min(p + 7, 88));
    }, 280);

    startTransition(async () => {
      const result = await completeOnboarding(
        selectedTopics,
        DEFAULT_FEED_STYLE
      );
      clearInterval(interval);

      if (result.error) {
        setError(result.error);
        setStep("interests");
        return;
      }

      setBuildProgress(100);
      setTimeout(() => router.refresh(), 600);
    });
  }

  return (
    <div className="onboarding-root flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="onboarding-card w-full max-w-lg">
        <div className="mb-8 flex gap-1.5">
          {[0, 1].map((i) => {
            const filled =
              step === "building" ||
              (step === "welcome" && i === 0) ||
              (step === "interests" && i <= 1);
            return (
              <div
                key={i}
                className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                  filled ? "bg-[var(--color-coffee-caramel)]" : "bg-[var(--color-coffee-elevated)]"
                }`}
              />
            );
          })}
        </div>

        {step === "welcome" && (
          <div key="welcome" className="onboarding-step">
            <div className="onboarding-orb mx-auto mb-8" />
            <h1 className="text-center text-2xl font-semibold tracking-tight text-[var(--color-coffee-cream)]">
              LearnLoop
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-[var(--color-coffee-mocha)]">
              A feed tuned to what you care about. Pick your interests and start
              scrolling with purpose.
            </p>
            <p className="mt-6 text-center text-xs text-[var(--color-coffee-taupe)]">
              Your profile saves automatically in this browser.
            </p>
            <button
              type="button"
              onClick={goNext}
              className="onboarding-btn-primary mt-10 w-full"
            >
              Get started
            </button>
          </div>
        )}

        {step === "interests" && (
          <div key="interests" className="onboarding-step">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-coffee-cream)]">
              What interests you?
            </h2>
            <p className="mt-2 text-sm text-[var(--color-coffee-mocha)]">
              Choose at least {MIN_TOPICS}. This becomes your interest profile.
            </p>

            <div className="onboarding-chip-grid mt-6">
              {ONBOARDING_TOPICS.map((topic, i) => {
                const active = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`onboarding-chip ${active ? "onboarding-chip-active" : ""}`}
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTopic()}
                placeholder="Add your own"
                className="onboarding-input flex-1"
              />
              <button
                type="button"
                onClick={addCustomTopic}
                disabled={!customTopic.trim()}
                className="onboarding-btn-secondary shrink-0 px-4"
              >
                Add
              </button>
            </div>

            <p className="mt-4 text-xs text-[var(--color-coffee-taupe)]">
              {selectedTopics.length} selected
              {selectedTopics.length < MIN_TOPICS &&
                ` · ${MIN_TOPICS - selectedTopics.length} more needed`}
            </p>

            {error && (
              <p className="mt-4 text-center text-xs text-red-400">{error}</p>
            )}

            <button
              type="button"
              onClick={goNext}
              disabled={selectedTopics.length < MIN_TOPICS || isPending}
              className="onboarding-btn-primary mt-8 w-full disabled:opacity-40"
            >
              Build my feed
            </button>
          </div>
        )}

        {step === "building" && (
          <div key="building" className="onboarding-step py-8 text-center">
            <div className="onboarding-orb mx-auto mb-8 onboarding-orb-pulse" />
            <h2 className="text-lg font-medium text-[var(--color-coffee-cream)]">
              Building your feed
            </h2>
            <p className="mt-2 text-sm text-[var(--color-coffee-mocha)]">
              Personalizing insights from your interests…
            </p>
            <div className="mx-auto mt-8 h-1 max-w-xs overflow-hidden rounded-full bg-[var(--color-coffee-elevated)]">
              <div
                className="onboarding-progress-bar h-full rounded-full bg-[var(--color-coffee-caramel)] transition-all duration-300"
                style={{ width: `${buildProgress}%` }}
              />
            </div>
            <p className="mt-4 text-xs text-[var(--color-coffee-taupe)]">
              {buildProgress < 100 ? "Generating first posts" : "Ready"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}