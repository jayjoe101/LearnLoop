import type { FeedStyle } from "@/lib/types";
import { GENERATION_TEMPLATES } from "@/lib/types";

type GeneratePostInput = {
  prompt?: string;
  topics: string[];
  style: FeedStyle;
};

type GeneratedPost = {
  topic: string;
  title: string;
  body: string;
  image_url: string | null;
};

function pickTemplate(topics: string[]): GeneratedPost {
  const topicSet = new Set(topics.map((t) => t.toLowerCase()));
  const matched = GENERATION_TEMPLATES.filter((t) =>
    [...topicSet].some(
      (userTopic) =>
        userTopic.includes(t.topic.toLowerCase()) ||
        t.topic.toLowerCase().includes(userTopic.split(" ")[0] ?? "")
    )
  );

  const pool = matched.length > 0 ? matched : GENERATION_TEMPLATES;
  const template = pool[Math.floor(Math.random() * pool.length)];
  const imageId = 30 + Math.floor(Math.random() * 50);

  return {
    ...template,
    image_url: `https://picsum.photos/id/${imageId}/600/340`,
  };
}

export async function generatePost(
  input: GeneratePostInput
): Promise<GeneratedPost> {
  const apiKey = process.env.XAI_API_KEY;

  if (!apiKey) {
    return pickTemplate(input.topics);
  }

  const topicHint =
    input.topics.length > 0
      ? `User interests: ${input.topics.join(", ")}.`
      : "General knowledge topics.";

  const userPrompt =
    input.prompt?.trim() ||
    "Create an original, scroll-stopping insight post for a personalized wisdom feed.";

  const systemPrompt = `You are GrokCurator for InsightScroll, a doomscroll-style learning feed.
Write in style: "${input.style}".
${topicHint}
Return ONLY valid JSON with keys: topic (short label), title (punchy headline), body (2-4 sentences, insightful, no markdown).`;

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      return pickTemplate(input.topics);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content as string | undefined;
    if (!content) return pickTemplate(input.topics);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return pickTemplate(input.topics);

    const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedPost>;
    if (!parsed.title || !parsed.body) return pickTemplate(input.topics);

    const imageId = 30 + Math.floor(Math.random() * 50);
    return {
      topic: parsed.topic ?? input.topics[0] ?? "Insight",
      title: parsed.title,
      body: parsed.body,
      image_url: `https://picsum.photos/id/${imageId}/600/340`,
    };
  } catch {
    return pickTemplate(input.topics);
  }
}