import { getAuthorInitials } from "@/lib/personas";

type Props = {
  name: string;
  role: string;
  handle: string;
  accent: string;
  topic: string;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PostAuthor({
  name,
  role,
  handle,
  accent,
  topic,
  createdAt,
}: Props) {
  const initials = getAuthorInitials(name);

  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ backgroundColor: accent }}
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-zinc-100">{name}</span>
          <span className="text-xs text-zinc-500">{role}</span>
        </div>
        <p className="text-xs text-zinc-600">
          {handle}
          <span className="mx-1.5 text-zinc-700">·</span>
          {topic}
          <span className="mx-1.5 text-zinc-700">·</span>
          <time dateTime={createdAt}>{timeAgo(createdAt)}</time>
        </p>
      </div>
    </div>
  );
}