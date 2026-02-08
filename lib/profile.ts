import { supabaseBrowser } from "./supabase-browser";

export type Profile = {
  id: string;
  school_id: string;
  auth_user_id: string | null;
  role: "student" | "parent" | "teacher" | "admin";
  name: string;
  email: string | null;
  external_id: string | null;
  class_name: string | null;
};

export async function getProfileForAuthUser(authUserId: string) {
  const { data, error } = await supabaseBrowser
    .from("users")
    .select(
      "id, school_id, auth_user_id, role, name, email, external_id, class_name"
    )
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}
