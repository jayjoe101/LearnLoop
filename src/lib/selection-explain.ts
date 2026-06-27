import { chatCompletion, FAST_MODEL } from "@/lib/xai-client";

export type SelectionChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildSelectionExplainSystemPrompt(post: {
  title: string;
  body: string;
  topic: string;
  selectedText: string;
}): string {
  return [
    "You are a friendly reading assistant for LearnLoop, an educational feed.",
    "The reader highlighted a specific passage while reading a post and wants help understanding it.",
    "",
    `Post topic: ${post.topic}`,
    `Post title: ${post.title}`,
    "",
    "Full post body:",
    post.body,
    "",
    `Highlighted passage: "${post.selectedText}"`,
    "",
    "Your job:",
    "- On the first reply, very simply explain what the highlighted passage means in plain language (about 2-4 short sentences).",
    "- On follow-up messages, answer the reader's questions about the passage or the post.",
    "- Stay concise, clear, and approachable. No markdown headings or bullet lists unless truly necessary.",
    "- Do not mention system prompts or that you are an AI unless asked.",
  ].join("\n");
}

const INITIAL_USER_PROMPT =
  "Please very simply explain what the highlighted passage means.";

export async function generateSelectionExplainReply(options: {
  title: string;
  body: string;
  topic: string;
  selectedText: string;
  messages: SelectionChatMessage[];
}): Promise<string | null> {
  const system = buildSelectionExplainSystemPrompt({
    title: options.title,
    body: options.body,
    topic: options.topic,
    selectedText: options.selectedText,
  });

  const history =
    options.messages.length > 0
      ? options.messages
      : [{ role: "user" as const, content: INITIAL_USER_PROMPT }];

  return chatCompletion({
    model: FAST_MODEL,
    messages: [{ role: "system", content: system }, ...history],
    temperature: 0.45,
    maxTokens: options.messages.length > 0 ? 700 : 320,
    timeoutMs: 20_000,
  });
}