"use client";

import AuthGate from "@/components/auth-gate";
import StudentDashboard from "@/components/student-dashboard";

export default function StudentDashboardPage() {
  return <AuthGate>{(user, signOut) => user.role === "student" ? <StudentDashboard userId={user.id} userName={user.name} userEmail={user.email} schoolId={user.schoolId} onSignOut={signOut} /> : <main className="auth-shell"><section className="auth-card"><h1>Student access required</h1><p className="auth-copy">This page is available only to linked student accounts.</p></section></main>}</AuthGate>;
}
