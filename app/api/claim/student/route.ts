import { NextResponse } from "next/server";
import { createServiceClient } from "../../../../lib/supabase-server";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { generateStudentEmail, resolveSchoolId } from "../../../../lib/claim";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rate = checkRateLimit(`claim-student:${ip}`);
  if (!rate.allowed) {
    return NextResponse.json({ message: "Too many attempts." }, { status: 429 });
  }

  const body = (await request.json()) as {
    school_code?: string;
    external_id?: string;
    password?: string;
  };

  if (!body.school_code || !body.external_id || !body.password) {
    return NextResponse.json({ message: "Missing fields." }, { status: 400 });
  }

  const schoolId = await resolveSchoolId(body.school_code);
  if (!schoolId) {
    return NextResponse.json({ message: "School code not found." }, { status: 404 });
  }

  const supabase = createServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, auth_user_id, email")
    .eq("school_id", schoolId)
    .eq("role", "student")
    .eq("external_id", body.external_id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ message: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ message: "Student ID not found." }, { status: 404 });
  }

  if (profile.auth_user_id) {
    return NextResponse.json(
      { message: "Already claimed — sign in." },
      { status: 409 }
    );
  }

  const generatedEmail =
    profile.email ?? generateStudentEmail(body.external_id, body.school_code);

  const { data: createdUser, error: createError } =
    await supabase.auth.admin.createUser({
      email: generatedEmail,
      password: body.password,
      email_confirm: true
    });

  if (createError || !createdUser.user) {
    return NextResponse.json(
      { message: createError?.message ?? "Unable to create user." },
      { status: 500 }
    );
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("users")
    .update({ auth_user_id: createdUser.user.id, email: generatedEmail })
    .eq("id", profile.id)
    .is("auth_user_id", null)
    .select("id");

  if (updateError || !updatedRows || updatedRows.length === 0) {
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    return NextResponse.json(
      { message: "Already claimed — sign in." },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    generated_email: profile.email ? undefined : generatedEmail
  });
}
