import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";

export async function GET() {
  const checks: Record<string, boolean | string> = {
    supabase_env: isSupabaseConfigured(),
    supabase_url_set: Boolean(getSupabaseUrl()),
    supabase_key_set: Boolean(getSupabaseAnonKey()),
    xai_key_set: Boolean(process.env.XAI_API_KEY),
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "degraded", checks, error: "Supabase env vars missing" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json(
        { status: "degraded", checks, auth: "error", message: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      checks,
      auth: data.user ? "session" : "anonymous_pending",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { status: "error", checks, message },
      { status: 500 }
    );
  }
}