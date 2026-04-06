import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();

export function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
      /^https?:\/\//i.test(SUPABASE_URL) &&
      SUPABASE_ANON_KEY
  );
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const SUPABASE_BUCKET_ATTACHMENTS =
  String(process.env.EXPO_PUBLIC_SUPABASE_BUCKET_ATTACHMENTS || "vh-attachments").trim();

export const SUPABASE_BUCKET_AVATARS =
  String(process.env.EXPO_PUBLIC_SUPABASE_BUCKET_AVATARS || "vh-avatars").trim();

export const SUPABASE_BUCKET_EXPORTS =
  String(process.env.EXPO_PUBLIC_SUPABASE_BUCKET_EXPORTS || "vh-exports").trim();