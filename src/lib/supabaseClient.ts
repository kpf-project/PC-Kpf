import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const REQUIRED_SUPABASE_ENV_VARS: Array<keyof NodeJS.ProcessEnv> = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

let supabaseServiceClient: SupabaseClient<Database> | null = null;

function hasAllEnvVars(keys: Array<keyof NodeJS.ProcessEnv>) {
  return keys.every((key) => Boolean(process.env[key] && process.env[key]!.length > 0));
}

export function assertSupabaseConfig() {
  if (hasAllEnvVars(REQUIRED_SUPABASE_ENV_VARS)) {
    return;
  }
  throw new Error(
    "Missing Supabase credentials. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (supabaseServiceClient) return supabaseServiceClient;
  assertSupabaseConfig();
  supabaseServiceClient = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return supabaseServiceClient;
}

export function resetSupabaseClientsForTesting() {
  supabaseServiceClient = null;
}
