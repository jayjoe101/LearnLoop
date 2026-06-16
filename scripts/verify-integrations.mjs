import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    vars[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return vars;
}

const env = {
  ...loadEnvFile(resolve(".env")),
  ...loadEnvFile(resolve(".env.local")),
  ...process.env,
};

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const key =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  env.SUPABASE_ANON_KEY ??
  env.SUPABASE_PUBLISHABLE_KEY;

const checks = {
  supabase_url: Boolean(url),
  supabase_key: Boolean(key),
  xai_key: Boolean(env.XAI_API_KEY),
};

console.log("InsightScroll integration check");
console.log(JSON.stringify(checks, null, 2));

if (!checks.supabase_url || !checks.supabase_key) {
  console.error(
    "\nMissing Supabase env. Run: npx vercel link && npm run env:pull"
  );
  process.exit(1);
}

console.log("\nSupabase env looks good. Start the app with: npm run dev");