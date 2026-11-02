import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["parent", "teacher", "driver", "student"]),
  studentId: z.string().uuid().optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Supabase server configuration is incomplete." }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const input = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid invitation details.", details: input.error.flatten() }, { status: 400 });

  const actor = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authUser, error: authError } = await actor.auth.getUser(token);
  if (authError || !authUser.user) return NextResponse.json({ error: "Session is invalid or expired." }, { status: 401 });

  const { data: membership, error: membershipError } = await actor
    .from("user_roles")
    .select("school_id, role")
    .eq("user_id", authUser.user.id)
    .eq("role", "administrator")
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "Only school administrators can invite users." }, { status: 403 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (input.data.role === "student") {
    if (!input.data.studentId) return NextResponse.json({ error: "studentId is required for student invitations." }, { status: 400 });
    const { data: student, error: studentError } = await admin.from("students").select("id, user_id").eq("id", input.data.studentId).eq("school_id", membership.school_id).maybeSingle();
    if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ error: "Student record was not found in your school." }, { status: 404 });
    if (student.user_id) return NextResponse.json({ error: "That student already has an account." }, { status: 409 });
  }
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.data.email, {
    data: { full_name: input.data.fullName },
  });
  if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message ?? "Invitation failed." }, { status: 400 });

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    school_id: membership.school_id,
    full_name: input.data.fullName,
    phone: input.data.phone || null,
    is_active: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: invited.user.id,
    school_id: membership.school_id,
    role: input.data.role,
  });
  if (roleError) {
    await admin.from("profiles").delete().eq("id", invited.user.id);
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }
  if (input.data.role === "student" && input.data.studentId) {
    const { error: linkError } = await admin.from("students").update({ user_id: invited.user.id }).eq("id", input.data.studentId).eq("school_id", membership.school_id).is("user_id", null);
    if (linkError) {
      await admin.from("user_roles").delete().eq("user_id", invited.user.id);
      await admin.from("profiles").delete().eq("id", invited.user.id);
      await admin.auth.admin.deleteUser(invited.user.id);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }
  }

  await admin.from("audit_logs").insert({
    school_id: membership.school_id,
    actor_id: authUser.user.id,
    action: "invite_user",
    record_type: "profile",
    record_id: invited.user.id,
    details: { role: input.data.role, email: input.data.email },
  });

  return NextResponse.json({ invited: true, userId: invited.user.id }, { status: 201 });
}
