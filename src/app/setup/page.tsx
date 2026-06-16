export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold">InsightScroll Setup</h1>
      <p className="mt-4 text-zinc-400">
        Supabase environment variables are missing. Follow these steps to get
        running locally or on Vercel.
      </p>

      <ol className="mt-8 list-decimal space-y-4 pl-6 text-zinc-300">
        <li>
          Install the{" "}
          <a
            href="https://vercel.com/marketplace/supabase"
            className="text-violet-400 underline"
            target="_blank"
            rel="noreferrer"
          >
            Supabase integration
          </a>{" "}
          on your Vercel project, or create a project at supabase.com.
        </li>
        <li>
          Run the SQL migration in{" "}
          <code className="text-emerald-300">supabase/migrations/001_initial_schema.sql</code>{" "}
          via the Supabase SQL Editor.
        </li>
        <li>
          Enable <strong>Anonymous sign-ins</strong> in Supabase Auth settings
          (Authentication → Providers → Anonymous).
        </li>
        <li>
          Pull synced env vars locally:{" "}
          <code className="text-emerald-300">npx vercel link</code> then{" "}
          <code className="text-emerald-300">npm run env:pull</code>. Vercel
          injects <code className="text-emerald-300">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          (not just anon key).
        </li>
        <li>
          Optional: add <code className="text-emerald-300">XAI_API_KEY</code> for
          live Grok post generation.
        </li>
      </ol>
    </main>
  );
}