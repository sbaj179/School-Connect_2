import { createServiceClient } from "./supabase-server";

export async function resolveSchoolId(schoolCode: string) {
  const supabase = createServiceClient();
  const normalized = schoolCode.trim().toUpperCase();
  const { data, error } = await supabase
    .from("schools")
    .select("id")
    .eq("school_code", normalized)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export function generateStudentEmail(externalId: string, schoolCode: string) {
  const normalizedCode = schoolCode.trim().toUpperCase();
  const normalizedId = externalId.trim().toLowerCase().replace(/\s+/g, "");
  return `s${normalizedId}.${normalizedCode.toLowerCase()}@students.local`;
}
