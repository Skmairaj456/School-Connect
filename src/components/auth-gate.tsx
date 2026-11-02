"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, GraduationCap, KeyRound, LoaderCircle, LogIn, PlayCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DemoRole } from "@/lib/demo-data";

type AuthenticatedUser = {
  id: string;
  email: string;
  role: DemoRole;
  name: string;
  schoolId: string;
  demo?: boolean;
};

const demoModeKey = "school-connect-demo-mode";
const demoUser: AuthenticatedUser = { id: "demo", email: "demo@school-connect.local", role: "administrator", name: "Aarav Patel", schoolId: "demo", demo: true };

type AuthGateProps = {
  children: (user: AuthenticatedUser, signOut: () => Promise<void>) => React.ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const client = supabase;
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mounted, setMounted] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let savedDemoMode = false;
    try { savedDemoMode = sessionStorage.getItem(demoModeKey) === "1"; } catch { /* storage unavailable */ }
    queueMicrotask(() => { setDemoMode(savedDemoMode); setMounted(true); });
  }, []);

  function enterDemo() {
    try { sessionStorage.setItem(demoModeKey, "1"); } catch { /* storage unavailable */ }
    setDemoMode(true);
  }

  async function leaveDemo() {
    try { sessionStorage.removeItem(demoModeKey); } catch { /* storage unavailable */ }
    setDemoMode(false);
  }

  const loadProfile = useCallback(async (userId: string, userEmail: string) => {
    if (!client) return;
    const { data, error: profileError } = await client
      .from("profiles")
      .select("full_name, school_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }
    const { data: roleRows, error: roleError } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("school_id", data?.school_id ?? "");
    if (roleError) {
      setError(roleError.message);
      setLoading(false);
      return;
    }
    const role = roleRows?.[0]?.role;
    if (!data || !role || !["platform_admin", "administrator", "parent", "teacher", "driver", "student"].includes(role)) {
      setError("Your account is not linked to an active School Connect role.");
      setLoading(false);
      return;
    }
    setError("");
    setUser({ id: userId, email: userEmail, name: data.full_name, role: role as DemoRole, schoolId: data.school_id });
    setLoading(false);
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const configuredClient = client;
    let mounted = true;
    async function loadUser() {
      try {
        const sessionResult = await Promise.race([
          configuredClient.auth.getSession(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Supabase session request timed out. Check the project URL and public key.")), 10_000)),
        ]);
        const { data, error: sessionError } = sessionResult;
        if (sessionError) {
          if (mounted) {
            setError(sessionError.message);
            setLoading(false);
          }
          return;
        }
        if (data.session && mounted) {
          await Promise.race([
            loadProfile(data.session.user.id, data.session.user.email ?? ""),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Supabase profile request timed out. Check that the migrations and RLS policies are applied.")), 10_000)),
          ]);
        }
        if (mounted) setLoading(false);
      } catch (error) {
        if (mounted) {
          setError(error instanceof Error ? error.message : "Unable to load the Supabase session.");
          setLoading(false);
        }
      }
    }
    void loadUser();

    const { data: listener } = configuredClient.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setLoading(false);
        return;
      }
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }
      void loadProfile(session.user.id, session.user.email ?? "");
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [client, loadProfile]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setSubmitting(true);
    setError("");
    const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  }

  async function signOut() {
    if (!client) return;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setSubmitting(true);
    setError("");
    setResetSent(false);
    const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    if (resetError) setError(resetError.message);
    else setResetSent(true);
    setSubmitting(false);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setError("Use at least 8 characters and make both passwords match.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: updateError } = await client.auth.updateUser({ password: newPassword });
    if (updateError) setError(updateError.message);
    else {
      setRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    }
    setSubmitting(false);
  }

  // Render only after mount: demo data is date-relative and must not be baked into the prerendered HTML.
  if (!mounted) return <AuthLoading />;
  if (!supabase) return <>{children(demoUser, async () => undefined)}</>;
  if (demoMode) return <>{children(demoUser, leaveDemo)}</>;
  if (loading) return <AuthLoading onDemo={enterDemo} />;
  if (recoveryMode) return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><GraduationCap size={21} /></span><div><b>school<span>connect</span></b><small>by ProjectPilot</small></div></div><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Choose a new password</h1><form onSubmit={updatePassword} className="auth-form"><label>New password<input type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label>Confirm password<input type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>{error && <p className="auth-error"><AlertCircle size={15} />{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}{submitting ? "Updating..." : "Update password"}<ArrowRight size={14} /></button></form></section></main>;
  if (user) return <>{children(user, signOut)}</>;

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><span className="brand-mark"><GraduationCap size={21} /></span><div><b>school<span>connect</span></b><small>by ProjectPilot</small></div></div>
      <p className="eyebrow">RIVERSIDE PUBLIC SCHOOL</p>
      <h1>{resetMode ? "Reset your password" : "Welcome back"}</h1>
      <p className="auth-copy">{resetMode ? "We’ll send a secure password reset link to your school account." : "Sign in to access your school workspace. Your role and school access are enforced by Supabase policies."}</p>
      <form onSubmit={resetMode ? sendReset : signIn} className="auth-form">
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@school.org" /></label>
        {!resetMode && <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Your password" /></label>}
        {error && <p className="auth-error"><AlertCircle size={15} />{error}</p>}
        {resetSent && <p className="auth-success"><ShieldCheck size={15} />Check your inbox for a password reset link.</p>}
        <button className="primary-button auth-submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={15} /> : resetMode ? <KeyRound size={15} /> : <LogIn size={15} />}{submitting ? "Sending..." : resetMode ? "Send reset link" : "Sign in"}<ArrowRight size={14} /></button>
      </form>
      <button className="text-action auth-reset" onClick={() => { setResetMode((value) => !value); setError(""); setResetSent(false); }}>{resetMode ? "Back to sign in" : "Forgot your password?"}</button>
      <button type="button" className="secondary-button auth-demo" onClick={enterDemo}><PlayCircle size={15} />Explore the interactive demo</button>
      <div className="auth-note"><ShieldCheck size={16} /><span><b>Private by design</b><small>Only linked students, assigned classes and authorized routes are visible.</small></span></div>
      <p className="auth-footer">Need access? Ask your school administrator to invite your account.</p>
    </section>
  </main>;
}

function AuthLoading({ onDemo }: { onDemo?: () => void }) {
  return <main className="auth-shell"><div className="auth-loading"><LoaderCircle className="spin" size={22} />Loading your secure workspace...{onDemo && <button type="button" className="text-action" onClick={onDemo}>Taking too long? Explore the demo</button>}</div></main>;
}
