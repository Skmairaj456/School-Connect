"use client";

import SchoolConnect from "@/components/school-connect";
import AuthGate from "@/components/auth-gate";
import StudentDashboard from "@/components/student-dashboard";

export default function Home() {
  return <AuthGate>{(user, signOut) => user.demo ? <SchoolConnect onSignOut={signOut} /> : user.role === "student" ? <StudentDashboard userId={user.id} userName={user.name} userEmail={user.email} schoolId={user.schoolId} onSignOut={signOut} /> : <SchoolConnect authenticatedRole={user.role} userId={user.id} userName={user.name} userEmail={user.email} schoolId={user.schoolId} onSignOut={signOut} />}</AuthGate>;
}