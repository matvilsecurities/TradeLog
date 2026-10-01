const trim = (value) => (typeof value === "string" ? value.trim() : "");

export const runtimeConfig = Object.freeze({
  supabaseUrl: trim(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: trim(import.meta.env.VITE_SUPABASE_ANON_KEY),
});

export const isSupabaseConfigured = Boolean(
  runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey
);

export function getRuntimeDiagnostics() {
  return {
    supabaseConfigured: isSupabaseConfigured,
    environment: import.meta.env.MODE,
  };
}
