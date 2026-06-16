"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeOnboarding } from "@/lib/actions";
import {
  FEED_STYLE_OPTIONS,
  ONBOARDING_TOPICS,
  type FeedStyle,
} from "@/lib/types";

type Step = "welcome" | "interests" | "algorithm" | "building";

const MIN_TOPICS = 3;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [feedStyle, setFeedStyle] = useState<FeedStyle>(
    "Balanced & insightful"
  );
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
      setStep("algorithm");
    } else if (step === "algorithm") {
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
      const result = await completeOnboarding(selectedTopics, feedStyle);
      clearInterval(interval);

      if (result.error) {
        setError(result.error);
        setStep("algorithm");
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
          {[0, 1, 2].map((i) => {
            const filled =
              step === "building" ||
              (step === "welcome" && i === 0) ||
              (step === "interests" && i <= 1) ||
              (step === "algorithm" && i <= 2);
            return (
              <div
                key={i}
                className={`h-0.5 flex-1 rounded-full transition-all duration-500 ${
                  filled ? "bg-zinc-100" : "bg-zinc-800"
                }`}
              />
            );
          })}
        </div>

        {step === "welcome" && (
          <div key="welcome" className="onboarding-step">
            <div className="onboarding-orb mx-auto mb-8" />
            <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-50">
              InsightScroll
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-zinc-500">
              A feed tuned to what you care about. Pick your interests, shape
              your algorithm, and start scrolling with purpose.
            </p>
            <p className="mt-6 text-center text-xs text-zinc-600">
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
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
              What interests you?
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
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

            <p className="mt-4 text-xs text-zinc-600">
              {selectedTopics.length} selected
              {selectedTopics.length < MIN_TOPICS &&
                ` · ${MIN_TOPICS - selectedTopics.length} more needed`}
            </p>

            <button
              type="button"
              onClick={goNext}
              disabled={selectedTopics.length < MIN_TOPICS}
              className="onboarding-btn-primary mt-8 w-full disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {step === "algorithm" && (
          <div key="algorithm" className="onboarding-step">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">
              Curate your algorithm
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              How should your insights feel?
            </p>

            <div className="mt-6 space-y-2">
              {FEED_STYLE_OPTIONS.map((option, i) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFeedStyle(option.value)}
                  className={`onboarding-style-card w-full text-left ${
                    feedStyle === option.value
                      ? "onboarding-style-card-active"
                      : ""
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="font-medium text-zinc-100">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-center text-xs text-red-400">{error}</p>
            )}

            <button
              type="button"
              onClick={goNext}
              disabled={isPending}
              className="onboarding-btn-primary mt-8 w-full"
            >
              Build my feed
            </button>
          </div>
        )}

        {step === "building" && (
          <div key="building" className="onboarding-step py-8 text-center">
            <div className="onboarding-orb mx-auto mb-8 onboarding-orb-pulse" />
            <h2 className="text-lg font-medium text-zinc-100">
              Building your feed
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Personalizing insights from your interests…
            </p>
            <div className="mx-auto mt-8 h-1 max-w-xs overflow-hidden rounded-full bg-zinc-800">
              <div
                className="onboarding-progress-bar h-full rounded-full bg-zinc-100 transition-all duration-300"
                style={{ width: `${buildProgress}%` }}
              />
            </div>
            <p className="mt-4 text-xs text-zinc-600">
              {buildProgress < 100 ? "Generating first posts" : "Ready"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}