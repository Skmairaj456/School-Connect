import { createClient } from "@supabase/supabase-js";

if (process.env.NODE_ENV === "production") throw new Error("RLS verification is development-only.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.log("RLS verification skipped: configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(0);
}

const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const schoolA = "10000000-0000-4000-8000-000000000001";
const schoolB = "10000000-0000-4000-8000-000000000002";
const password = "SchoolDemo!2026";

async function signIn(email) {
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
}

await signIn("parent1@school-connect.demo");
const own = await client.from("students").select("id").eq("school_id", schoolA);
if (own.error) throw own.error;
if (own.data.length === 0) throw new Error("Expected linked student visibility was empty.");
const foreign = await client.from("students").select("id").eq("school_id", schoolB);
if (foreign.error) throw foreign.error;
if (foreign.data.length !== 0) throw new Error("Tenant isolation failed: parent can see another school's students.");
console.log("RLS verification passed: linked-school rows visible, foreign-school rows hidden.");
