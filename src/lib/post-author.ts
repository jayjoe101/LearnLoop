import { getPersonaById, pickRandomPersona } from "@/lib/personas";
import type { Post } from "@/lib/types";

export function resolvePostAuthor(post: Post) {
  if (post.author_name && post.author_role) {
    const persona = post.persona_id
      ? getPersonaById(post.persona_id)
      : undefined;
    return {
      name: post.author_name,
      role: post.author_role,
      handle: post.author_handle ?? persona?.handle ?? "",
      accent: persona?.accent ?? "#71717a",
    };
  }

  const fallback = pickRandomPersona();
  return {
    name: fallback.name,
    role: fallback.role,
    handle: fallback.handle,
    accent: fallback.accent,
  };
}

export function personaToAuthorFields(persona: {
  id: string;
  name: string;
  role: string;
  handle: string;
}) {
  return {
    persona_id: persona.id,
    author_name: persona.name,
    author_role: persona.role,
    author_handle: persona.handle,
  };
}