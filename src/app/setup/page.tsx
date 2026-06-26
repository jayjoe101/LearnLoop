export default function SetupPage() {
  return (
    <main className="onboarding-root mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold text-[var(--color-coffee-text)]">InsightScroll Setup</h1>
      <p className="mt-4 text-[var(--color-coffee-mocha)]">
        Supabase environment variables are missing. Follow these steps to get
        running locally or on Vercel.
      </p>

      <ol className="mt-8 list-decimal space-y-4 pl-6 text-[var(--color-coffee-text-soft)]">
        <li>
          Install the{" "}
          <a
            href="https://vercel.com/marketplace/supabase"
            className="text-[var(--color-coffee-caramel)] underline"
            target="_blank"
            rel="noreferrer"
          >
            Supabase integration
          </a>{" "}
          on your Vercel project, or create a project at supabase.com.
        </li>
        <li>
          Run the SQL migration in{" "}
          <code className="text-[var(--color-coffee-sage)]">supabase/migrations/001_initial_schema.sql</code>{" "}
          via the Supabase SQL Editor.
        </li>
        <li>
          Enable <strong>Anonymous sign-ins</strong> in Supabase Auth settings
          (Authentication → Providers → Anonymous).
        </li>
        <li>
          Copy <code className="text-[var(--color-coffee-sage)]">.env.example</code> to{" "}
          <code className="text-[var(--color-coffee-sage)]">.env.local</code> and fill in your
          Supabase URL and anon key.
        </li>
        <li>
          Optional: add <code className="text-[var(--color-coffee-sage)]">XAI_API_KEY</code> for
          live Grok post generation.
        </li>
      </ol>
    </main>
  );
}