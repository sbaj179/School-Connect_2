import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

export function createServiceClient() {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL", { required: true });
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", { required: true });

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
