"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, ArrowUpRight, Bell, BookOpen, Building2, Bus, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, Menu, MessageSquareText, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { demoSeed, type Announcement, type DemoRole, type DemoState, type ExamItem, type HomeworkItem, type MarkItem, type Topic } from "@/lib/demo-data";
import { completionPercent, nextTopicStatus, toCsv, toggleAttendance } from "@/lib/workflows";
import { loadSchoolDashboard } from "@/lib/live-data";
import { supabase } from "@/lib/supabase";

const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

type View = "Overview" | "Attendance" | "Syllabus" | "Bus tracking" | "Homework" | "Announcements" | "Directory";
const roles: DemoRole[] = ["administrator", "parent", "teacher", "driver"];
const roleName: Record<DemoRole, string> = { platform_admin: "Platform admin", administrator: "Administrator", parent: "Parent", teacher: "Teacher", driver: "Driver", student: "Student" };
const icons = { Overview: LayoutDashboard, Attendance: ClipboardCheck, Syllabus: BookOpen, "Bus tracking": Bus, Homework: FileText, Announcements: MessageSquareText, Directory: Users };
const navForRole: Record<DemoRole, View[]> = { platform_admin: ["Overview", "Directory", "Announcements"], administrator: ["Overview", "Attendance", "Syllabus", "Bus tracking", "Homework", "Announcements", "Directory"], parent: ["Overview", "Attendance", "Syllabus", "Bus tracking", "Homework", "Announcements"], teacher: ["Overview", "Attendance", "Syllabus", "Homework", "Announcements"], driver: ["Overview", "Bus tracking"], student: ["Overview", "Syllabus", "Homework", "Announcements"] };

// v2: demo dates became relative to today, so older saved demo state is ignored.
const demoStorageKey = "school-connect-demo-v2";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function academicYear() {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}

type SchoolConnectProps = {
  authenticatedRole?: DemoRole;
  userId?: string;
  userName?: string;
  userEmail?: string;
  schoolId?: string;
  onSignOut?: () => Promise<void>;
};

export default function SchoolConnect({ authenticatedRole, userId, userName, userEmail, schoolId, onSignOut }: SchoolConnectProps) {
  const [role, setRole] = useState<DemoRole>(authenticatedRole ?? "administrator");
  const [view, setView] = useState<View>("Overview");
  const [data, setData] = useState<DemoState>(demoSeed);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  useEffect(() => {
    let savedState: DemoState | undefined;
    try { const saved = localStorage.getItem(demoStorageKey); if (saved) savedState = { ...demoSeed, ...JSON.parse(saved) as Partial<DemoState> }; }
    catch { try { localStorage.removeItem(demoStorageKey); } catch { /* storage unavailable */ } }
    queueMicrotask(() => { if (savedState) setData(savedState); setReady(true); });
  }, []);
  useEffect(() => { if (ready && !authenticatedRole) { try { localStorage.setItem(demoStorageKey, JSON.stringify(data)); } catch { /* storage unavailable */ } } }, [data, ready, authenticatedRole]);
  useEffect(() => {
    if (!authenticatedRole || !schoolId || !supabase) return;
    void loadSchoolDashboard(schoolId, demoSeed).then((liveData) => {
      setData(liveData);
      setSyncMessage("Live school data");
    }).catch((error: Error) => setSyncMessage(`Live data unavailable: ${error.message}`));
  }, [authenticatedRole, schoolId]);
  useEffect(() => {
    const client = supabase;
    if (!authenticatedRole || !schoolId || !client) return;
    const channel = client.channel(`school-connect-transport-${schoolId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bus_locations", filter: `school_id=eq.${schoolId}` }, (payload) => {
        const row = payload.new as { trip_id: string; latitude: number; longitude: number; recorded_at: string; simulated: boolean };
        if (data.trip.id && row.trip_id === data.trip.id) setData((current) => ({ ...current, trip: { ...current.trip, position: [row.latitude, row.longitude], updatedAt: row.recorded_at, simulated: row.simulated } }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bus_trips", filter: `school_id=eq.${schoolId}` }, (payload) => {
        const row = payload.new as { id: string; status: string; ended_at: string | null };
        if (data.trip.id && row.id === data.trip.id) setData((current) => ({ ...current, trip: { ...current.trip, active: row.status === "active", updatedAt: row.ended_at ?? current.trip.updatedAt } }));
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [authenticatedRole, schoolId, data.trip.id]);
  const percent = completionPercent(data.topics);
  const present = data.attendance.filter((row) => row.status === "Present" || row.status === "Late").length;
  const nav = navForRole[role];
  const isAuthenticated = Boolean(authenticatedRole);

  async function toggleAttendanceRecord(id: string) {
    const nextStatus = data.attendance.find((row) => row.id === id);
    if (!nextStatus) return;
    const nextRows = toggleAttendance(data.attendance, id);
    setData((current) => ({ ...current, attendance: nextRows }));
    if (authenticatedRole && schoolId && supabase && (authenticatedRole === "teacher" || authenticatedRole === "administrator")) {
      const updated = nextRows.find((row) => row.id === id);
      if (!updated) return;
      const { error } = await supabase.from("attendance_records").update({ status: updated.status, recorded_by: userId }).eq("id", id).eq("school_id", schoolId);
      if (error) setSyncMessage(`Attendance was not saved: ${error.message}`);
    }
  }
  function progressTopic(id: string) {
    const currentTopic = data.topics.find((topic) => topic.id === id);
    if (!currentTopic) return;
    const status = nextTopicStatus(currentTopic.status);
    setData((current) => ({ ...current, topics: current.topics.map((topic) => topic.id === id ? { ...topic, status } : topic) }));
    if (authenticatedRole && schoolId && supabase && (authenticatedRole === "teacher" || authenticatedRole === "administrator")) {
      void supabase.from("syllabus_topics").update({ status, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", id).eq("school_id", schoolId).then(({ error }) => {
        if (error) setSyncMessage(`Syllabus was not saved: ${error.message}`);
      });
    }
  }
  function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const title = draft.trim(); if (!title) return;
    const notice: Announcement = { id: crypto.randomUUID(), title, audience: role === "teacher" ? "Class 5 · A" : "Whole school", category: "School update", publishedAt: new Date().toISOString(), author: roleName[role], unread: true };
    setData((current) => ({ ...current, announcements: [notice, ...current.announcements] })); setDraft("");
    if (authenticatedRole && schoolId && userId && supabase) {
      void supabase.from("announcements").insert({ school_id: schoolId, author_id: userId, title, body: title, audience: role === "teacher" ? "class" : "school" }).then(({ error }) => {
        if (error) setSyncMessage(`Announcement was not saved: ${error.message}`);
      });
    }
  }
  async function updateTrip(nextTrip: DemoState["trip"]) {
    const previous = data.trip;
    setData((current) => ({ ...current, trip: nextTrip }));
    if (!authenticatedRole || !schoolId || !userId || !supabase || authenticatedRole !== "driver") return;
    if (nextTrip.active && !previous.active) {
      if (!nextTrip.routeId) { setSyncMessage("No assigned route is available for this driver."); return; }
      const { data: created, error } = await supabase.from("bus_trips").insert({ school_id: schoolId, route_id: nextTrip.routeId, started_by: userId, status: "active", simulated: nextTrip.simulated ?? true }).select("id").single();
      if (error) { setSyncMessage(`Trip was not saved: ${error.message}`); return; }
      nextTrip = { ...nextTrip, id: created.id };
      setData((current) => ({ ...current, trip: nextTrip }));
    } else if (!nextTrip.active && previous.id) {
      const { error } = await supabase.from("bus_trips").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", previous.id).eq("school_id", schoolId);
      if (error) setSyncMessage(`Trip was not saved: ${error.message}`);
    }
    if (nextTrip.active && nextTrip.id) {
      const { error } = await supabase.from("bus_locations").insert({ school_id: schoolId, trip_id: nextTrip.id, latitude: nextTrip.position[0], longitude: nextTrip.position[1], simulated: nextTrip.simulated ?? true });
      if (error) setSyncMessage(`Location was not saved: ${error.message}`);
    }
  }
  function exportCsv() {
    const rows = [["Student", "Class", "Attendance", "Bus route"], ...data.students.map((student) => [student.name, student.className, student.attendance, student.route])];
    const csv = toCsv(rows);
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "school-connect-students.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  function selectRole(next: DemoRole) { setRole(next); setView("Overview"); setMobileNav(false); }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark"><GraduationCap size={21} /></span><span><b>school<span>connect</span></b><small>Riverside Public School</small></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button></div>
      <button className="school-switch"><span>R</span><strong>Riverside Public<small>Hyderabad · {academicYear()}</small></strong><ChevronDown size={14} /></button>
      <p className="nav-caption">WORKSPACE</p>
      <nav>{nav.map((item) => { const Icon = icons[item]; return <button key={item} className={`nav-item ${view === item ? "selected" : ""}`} onClick={() => { setView(item); setMobileNav(false); }}><Icon size={17} /><span>{item === "Syllabus" ? "Syllabus tracker" : item === "Directory" ? "School directory" : item}</span>{item === "Announcements" && data.announcements.some((notice) => notice.unread) && <i className="unread-dot" />}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="help"><ShieldCheck size={17} /><span><b>Student data is private</b><small>Riverside school community</small></span></div><div className="profile"><span className="avatar">{role === "parent" ? "AM" : role === "teacher" ? "SR" : role === "driver" ? "RK" : "AP"}</span><span><b>{isAuthenticated ? userName : role === "parent" ? "Ananya Mehta" : role === "teacher" ? "S. Rao" : role === "driver" ? "Ravi Kumar" : "A. Patel"}</b><small>{roleName[role]}{isAuthenticated ? "" : " · Demo"}</small></span></div></div>
    </aside>
    {mobileNav && <button className="scrim" aria-hidden="true" tabIndex={-1} onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="crumb"><button className="mobile-open icon-button" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button>School <ChevronRight size={13} /> <b>{view}</b></div><div className="top-actions"><label className="search"><Search size={15} /><input aria-label="Search students and records" placeholder="Search anything..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="icon-button notification" aria-label="Open announcements" onClick={() => setView("Announcements")}><Bell size={18} /></button><span className="top-separator" />{isAuthenticated ? <div className="session-user"><span>{userName}</span><small>{userEmail}</small>{onSignOut && <button onClick={() => void onSignOut()}>Sign out</button>}</div> : <label className="role-picker"><span>View as</span><select value={role} aria-label="Demo role" onChange={(event) => selectRole(event.target.value as DemoRole)}>{roles.map((option) => <option key={option} value={option}>{roleName[option]}</option>)}</select></label>}</div></header>
      <section className="page-content">
        <div className="demo-banner"><span className="demo-tag"><i /> {isAuthenticated ? "LIVE MODE" : "DEMO MODE"}</span><span>{isAuthenticated ? syncMessage || "Tenant-scoped Supabase data" : "Saved in this browser · Supabase auth and cloud sync need setup"}</span>{!isAuthenticated && <button onClick={() => { try { localStorage.removeItem(demoStorageKey); } catch { /* storage unavailable */ } setData(demoSeed); }}>Reset data</button>}{!isAuthenticated && onSignOut && supabase && <button onClick={() => void onSignOut()}>Exit demo</button>}</div>
        <div className="page-heading"><div><p className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p><h1>{view === "Overview" ? `${greeting()}, ${role === "parent" ? "Ananya" : role === "teacher" ? "S. Rao" : role === "driver" ? "Ravi" : "Aarav"}` : view}</h1><p>{view === "Overview" ? role === "parent" ? "Here’s the latest from Meera’s school day." : role === "driver" ? "Your route and student pickup list are ready." : role === "teacher" ? "Your classes are ready. Here’s what needs attention." : "Here’s what’s happening across your school today." : pageDescription(view, role)}</p></div>{role === "administrator" && view === "Overview" && <button className="primary-button" onClick={() => setView("Directory")}><Plus size={15} /> Add a student</button>}{role === "teacher" && view === "Overview" && <button className="primary-button" onClick={() => setView("Attendance")}><ClipboardCheck size={15} /> Take attendance</button>}</div>
        {view === "Overview" && role === "platform_admin" ? <PlatformOverview schoolId={schoolId} /> : view === "Overview" && <Overview role={role} data={data} percent={percent} present={present} onNavigate={setView} />}
        {view === "Attendance" && <Attendance data={data} role={role} search={search} onToggle={toggleAttendanceRecord} />}
        {view === "Syllabus" && <Syllabus topics={data.topics} onProgress={progressTopic} />}
        {view === "Bus tracking" && <Transport role={role} trip={data.trip} onChange={updateTrip} />}
        {view === "Homework" && <Homework role={role} items={data.homework} exams={data.exams} marks={data.marks} userId={userId} schoolId={schoolId} />}
        {view === "Announcements" && <Notices role={role} notices={data.announcements} draft={draft} onDraft={setDraft} onPublish={publish} onRead={(id) => setData((current) => ({ ...current, announcements: current.announcements.map((notice) => notice.id === id ? { ...notice, unread: false } : notice) }))} />}
        {view === "Directory" && <Directory students={data.students.filter((student) => `${student.name} ${student.className}`.toLowerCase().includes(search.toLowerCase()))} onExport={exportCsv} onCreate={(student) => setData((current) => ({ ...current, students: [student, ...current.students] }))} />}
        <footer className="footer"><span><ShieldCheck size={13} /> Private to your school community</span><span>School Connect · Development preview</span></footer>
      </section>
    </main>
  </div>;
}

function pageDescription(view: View, role: DemoRole) {
  if (view === "Attendance") return role === "parent" ? "Attendance history for Meera Mehta · Class 5A." : "Review and update today’s class attendance.";
  if (view === "Syllabus") return "Planned lessons and classroom progress, updated by teachers.";
  if (view === "Bus tracking") return "Route 02 · Green Park and Lake View · approximate ETAs.";
  if (view === "Homework") return "Assignments, due dates and upcoming assessments.";
  if (view === "Announcements") return "Updates and messages from your school community.";
  return "Student records for Riverside Public School.";
}

function PlatformOverview({ schoolId }: { schoolId?: string }) {
  const [summary, setSummary] = useState({ schools: 0, activeSubscriptions: 0, plans: 0, students: 0 });
  const [message, setMessage] = useState("Loading platform metrics...");
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    void Promise.all([
      client.from("schools").select("id", { count: "exact", head: true }),
      client.from("school_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      client.from("subscription_plans").select("id", { count: "exact", head: true }).eq("is_active", true),
      client.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]).then(([schools, subscriptions, plans, students]) => {
      const error = [schools, subscriptions, plans, students].find((result) => result.error)?.error;
      if (error) { setMessage(`Platform metrics unavailable: ${error.message}`); return; }
      setSummary({ schools: schools.count ?? 0, activeSubscriptions: subscriptions.count ?? 0, plans: plans.count ?? 0, students: students.count ?? 0 });
      setMessage(schoolId ? "Live platform metrics" : "No school context");
    });
  }, [schoolId]);
  const cards = [["Schools", summary.schools, Building2], ["Active subscriptions", summary.activeSubscriptions, ShieldCheck], ["Active plans", summary.plans, FileText], ["Students", summary.students, Users] ] as const;
  return <><div className="stats-grid">{cards.map(([label, value, Icon], index) => <article className="stat" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${["mint", "blue", "amber", "rose"][index]}`}><Icon size={17} /></span></div><b className="stat-value">{String(value)}</b><span className="stat-detail">Platform-wide database count</span></article>)}</div><div className="dashboard-grid"><section className="panel"><PanelHeading title="Platform operations" subtitle={message} /><div className="timeline"><div className="timeline-row"><span><ShieldCheck size={14} /></span><b>Tenant isolation<small>School workspaces are scoped by RLS and role</small></b><time>RLS</time></div><div className="timeline-row"><span><FileText size={14} /></span><b>Plan catalogue<small>Pricing is configuration, not payment processing</small></b><time>{summary.plans} plans</time></div></div></section><section className="panel"><PanelHeading title="Configured pricing" subtitle="Monthly INR pricing from subscription_plans" /><div className="pricing-list"><div><b>Starter</b><span>₹1,999 / month · 250 students</span></div><div><b>Growth</b><span>₹4,999 / month · 750 students</span></div><div><b>Plus</b><span>₹8,999 / month · 1,500 students</span></div></div></section></div></>;
}

function Overview({ role, data, percent, present, onNavigate }: { role: DemoRole; data: DemoState; percent: number; present: number; onNavigate: (view: View) => void }) {
  const parent = role === "parent", driver = role === "driver";
  const completed = data.topics.filter((topic) => topic.status === "Completed").length;
  const parentAttendance = data.attendance.find((row) => row.id === "st-01")?.status ?? "Not recorded";
  const stats = role === "administrator" ? [["Total students", String(data.students.length), "Seeded demo records", Users], ["Attendance today", `${Math.round(present / data.attendance.length * 100)}%`, "From today’s sample roll", ClipboardCheck], ["Active buses", data.trip.active ? "1 / 2" : "0 / 2", "Route 02 · simulated", Bus], ["Syllabus progress", `${percent}%`, "Calculated from topics", BookOpen]] : parent ? [["Today’s attendance", parentAttendance, "Meera · Class 5A", ClipboardCheck], ["Bus arrival", "8 min", "Route 02 · Bus 12", Bus], ["Syllabus progress", `${percent}%`, "Class 5A · Term 2", BookOpen], ["Due this week", "3 tasks", "Maths · tomorrow", FileText]] : driver ? [["Assigned bus", "Bus 12", "TS 09 AB 4582", Bus], ["Route status", data.trip.active ? "In progress" : "Not started", "Route 02 · 8 stops", Activity], ["Next stop", "Green Park", "Approx. 8 min", CalendarDays], ["Students", "18", "3 pickups remaining", Users]] : [["My classes", "4 classes", "5A · 5B · 6A · 6B", GraduationCap], ["Attendance today", "2 / 4", "Classes marked", ClipboardCheck], ["Syllabus progress", `${percent}%`, "Science · Class 5A", BookOpen], ["To review", "6 items", "Assignments & marks", FileText]];
  return <><div className="stats-grid">{stats.map(([label, value, detail, Icon], index) => <article className="stat" key={label as string}><div className="stat-top"><span>{label as string}</span><span className={`stat-icon ${["mint", "blue", "amber", "rose"][index]}`}><Icon size={17} /></span></div><b className="stat-value">{value as string}</b><span className="stat-detail">{detail as string}</span></article>)}</div>
    <div className="dashboard-grid">{!driver && <section className="panel attendance-panel"><PanelHeading title={parent ? "Meera’s attendance" : "Attendance overview"} subtitle={parent ? "Present on 18 of 20 school days" : "Daily attendance across the last 7 school days"} action="View report" onAction={() => onNavigate("Attendance")} /><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.attendanceTrend} margin={{ top: 10, right: 7, left: -18, bottom: 0 }}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16866a" stopOpacity={.16} /><stop offset="100%" stopColor="#16866a" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0ed" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8a958e", fontSize: 10 }} dy={8} /><YAxis domain={[75, 100]} axisLine={false} tickLine={false} tick={{ fill: "#8a958e", fontSize: 10 }} tickFormatter={(value: number) => `${value}%`} /><Tooltip contentStyle={{ border: "1px solid #e6ebe7", borderRadius: 7, fontSize: 11 }} /><Area type="monotone" dataKey="percentage" stroke="#16866a" strokeWidth={2.5} fill="url(#fill)" dot={{ r: 3, fill: "#16866a", stroke: "#fff", strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div><div className="chart-foot"><span><i /> School average · demo records</span><span>Last 7 school days <ChevronDown size={12} /></span></div></section>}
      <section className="panel transport-card"><PanelHeading title={parent ? "Meera’s school bus" : driver ? "Today’s route" : "Live transport"} subtitle={`Bus 12 · Route 02 · ${data.trip.active ? "On schedule" : "Trip ended"}`} tag={data.trip.active ? "LIVE" : "SCHEDULED"} /><div className="mini-map"><RouteMap compact position={data.trip.position} /><div className="map-label"><span><Bus size={13} /></span><b>Bus 12<small>{data.trip.active ? "Updated just now" : "Sharing stopped"}</small></b></div></div><div className="transport-meta"><span><small>Next stop</small><b>Green Park · 8 min</b></span><span><small>Driver</small><b>Ravi Kumar</b></span></div><button className="panel-link" onClick={() => onNavigate("Bus tracking")}>Open live tracking <ArrowUpRight size={14} /></button></section>
      <section className="panel updates-card"><PanelHeading title={parent ? "Today at school" : driver ? "Route checklist" : "Recent updates"} subtitle={parent ? "A quick look at Meera’s day" : "Latest school activity"} /><div className="timeline">{(driver ? [["Trip started", "Route 02 · North gate", "8:12 AM", Bus], ["5 students boarded", "Green Park stop", "8:19 AM", Check], ["Next: Lake View Colony", "13 students expected", "Next", CalendarDays]] : parent ? [["Science · Plant systems", "Completed with an activity", "9:05 AM", BookOpen], ["Arrived at school", "Checked in at the north gate", "8:12 AM", Check], ["Maths assignment due", "Fractions · Exercise 4", "Tomorrow", FileText]] : [["Syllabus updated", "Science · Plant systems completed", "10:24 AM", BookOpen], ["New announcement", "Annual day rehearsal schedule", "9:42 AM", MessageSquareText], ["Attendance recorded", "Class 5A · 31 of 32 present", "8:15 AM", Check]]).map(([title, detail, time, Icon]) => <div className="timeline-row" key={title as string}><span><Icon size={14} /></span><b>{title as string}<small>{detail as string}</small></b><time>{time as string}</time></div>)}</div><button className="panel-link" onClick={() => onNavigate(parent ? "Syllabus" : driver ? "Bus tracking" : "Announcements")}>{parent ? "View teaching updates" : "See all activity"}<ArrowUpRight size={14} /></button></section>
      {!driver && <section className="panel syllabus-card"><PanelHeading title={parent ? "Meera’s learning" : "Syllabus progress"} subtitle="Class 5A · Term 2" action="View syllabus" onAction={() => onNavigate("Syllabus")} /><div className="progress-summary"><div className="progress-ring" style={{ "--progress": `${percent}%` } as React.CSSProperties}><b>{percent}%<small>complete</small></b></div><div className="subjects">{["Science", "Mathematics", "English"].map((subject, index) => { const value = Math.max(0, percent - index * 12); return <div key={subject}><span>{subject}<b>{value}%</b></span><i><em style={{ width: `${value}%` }} /></i></div>; })}</div></div><div className="syllabus-foot"><span><i className="done-dot" />{completed} completed</span><span><i className="ongoing-dot" />{data.topics.filter((topic) => topic.status === "In Progress").length} in progress</span></div></section>}
      <section className="panel announcements-card"><PanelHeading title="School announcements" subtitle="Updates from the school office" action="All updates" onAction={() => onNavigate("Announcements")} />{data.announcements.slice(0, 2).map((notice) => <button className="announcement-row" key={notice.id} onClick={() => onNavigate("Announcements")}><span><MessageSquareText size={14} /></span><b>{notice.title}<small>{notice.audience} · {new Date(notice.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></b>{notice.unread && <i />}</button>)}</section>
    </div></>;
}

function PanelHeading({ title, subtitle, action, onAction, tag }: { title: string; subtitle: string; action?: string; onAction?: () => void; tag?: string }) { return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action ? <button className="text-action" onClick={onAction}>{action} <ChevronRight size={13} /></button> : tag && <span className={`status-tag ${tag === "LIVE" || tag === "TRIP ACTIVE" ? "live" : ""}`}><i />{tag}</span>}</div>; }

function Attendance({ data, role, search, onToggle }: { data: DemoState; role: DemoRole; search: string; onToggle: (id: string) => void }) {
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const linkedRecords = role === "parent" ? data.attendance.filter((row) => row.id === "st-01" || row.id === "st-02") : data.attendance;
  const rows = linkedRecords.filter((row) => `${row.name} ${row.className}`.toLowerCase().includes(search.toLowerCase()) && (classFilter === "All classes" || row.className === classFilter) && (statusFilter === "All statuses" || row.status === statusFilter));
  const classes = Array.from(new Set(linkedRecords.map((row) => row.className)));
  return <section className="panel table-panel"><div className="table-tools"><div><span className="filter-date">Today</span><select aria-label="Filter attendance by class" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All classes</option>{classes.map((className) => <option key={className}>{className}</option>)}</select><select aria-label="Filter attendance by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{["Present", "Absent", "Late", "Excused"].map((status) => <option key={status}>{status}</option>)}</select></div><span>{rows.length} students</span></div><div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>CLASS</th><th>STATUS</th><th>CHECK-IN</th><th>RECORDED BY</th>{role !== "parent" && <th />}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="student"><i>{row.initials}</i><b>{row.name}</b></span></td><td>{row.className}</td><td><span className={`attendance-status ${row.status.toLowerCase()}`}><i />{row.status}</span></td><td>{row.checkIn}</td><td>{row.recordedBy}</td>{role !== "parent" && <td><button className="row-action" onClick={() => onToggle(row.id)}>{row.status === "Present" ? "Mark absent" : "Mark present"}</button></td>}</tr>)}</tbody></table></div><div className="table-bottom">Showing {rows.length} of {linkedRecords.length} demo records <span>Page 1 of 1</span></div></section>;
}

function Syllabus({ topics, onProgress }: { topics: Topic[]; onProgress: (id: string) => void }) {
  return <div className="subject-grid">{Array.from(new Set(topics.map((topic) => topic.subject))).map((subject) => { const rows = topics.filter((topic) => topic.subject === subject); const percent = Math.round(rows.filter((topic) => topic.status === "Completed").length / rows.length * 100); return <section className="panel subject-card" key={subject}><div className="subject-head"><span><BookOpen size={16} /></span><b>{subject}<small>Class 5A · Term 2 · {rows.length} topics</small></b><strong>{percent}%</strong></div><div className="bar"><i style={{ width: `${percent}%` }} /></div>{rows.map((topic) => <div className="topic-row" key={topic.id}><i className={`topic-dot ${topic.status.toLowerCase().replaceAll(" ", "-")}`} /><b>{topic.title}<small>{topic.plannedDate} · {topic.teacher}</small></b><span className={`topic-status ${topic.status.toLowerCase().replaceAll(" ", "-")}`}>{topic.status}</span><button onClick={() => onProgress(topic.id)} aria-label={`Update ${topic.title}`}><Check size={14} /></button></div>)}</section>; })}</div>;
}

function Transport({ role, trip, onChange }: { role: DemoRole; trip: DemoState["trip"]; onChange: (trip: DemoState["trip"]) => void }) {
  const [message, setMessage] = useState(""); const [step, setStep] = useState(0);
  const positions: [number, number][] = [[17.4239, 78.4738], [17.4262, 78.4781], [17.4298, 78.4819], [17.4322, 78.486], [17.4351, 78.4892], [17.4388, 78.4933]];
  const tripRef = useRef(trip);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    tripRef.current = trip;
    onChangeRef.current = onChange;
  }, [trip, onChange]);
  useEffect(() => {
    if (role !== "driver" || !trip.active || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition((point) => {
      onChangeRef.current({ ...tripRef.current, position: [point.coords.latitude, point.coords.longitude], updatedAt: new Date().toISOString(), simulated: false });
      setMessage("Live browser GPS location shared for this active trip.");
    }, () => setMessage("GPS permission was not granted; simulated route remains active."), { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [role, trip.active]);
  function shareLocation() { if (!navigator.geolocation) { setMessage("This browser does not support location sharing."); return; } navigator.geolocation.getCurrentPosition((point) => { onChange({ ...trip, active: true, position: [point.coords.latitude, point.coords.longitude], updatedAt: new Date().toISOString() }); setMessage("Location shared for this active trip."); }, () => setMessage("Permission not granted. Demo route remains simulated."), { enableHighAccuracy: true, timeout: 10000 }); }
  return <div className="transport-grid"><section className="panel map-panel"><PanelHeading title="Route 02 · North loop" subtitle="Bus 12 · Driver Ravi Kumar · 18 assigned students" tag={trip.active ? "TRIP ACTIVE" : "TRIP ENDED"} /><div className="large-map"><RouteMap position={trip.position} /><span className="map-mode"><i /> SIMULATED GPS · HYDERABAD</span></div><div className="map-stats"><span><small>Last update</small><b>{trip.active ? "Just now" : "Trip ended · sharing stopped"}</b></span><span><small>ETA · Green Park</small><b>{trip.active ? "8 min · estimate" : "Unavailable"}</b></span><span><small>Route progress</small><b>{trip.active ? `${step + 1} of 8 stops` : "Awaiting departure"}</b></span></div>{message && <p className="inline-message">{message}</p>}</section><aside className="transport-aside"><section className="panel control-panel"><PanelHeading title="Trip controls" subtitle={role === "driver" ? "Driver tools" : "Demo controls"} /><div className="trip-status"><i className={trip.active ? "active" : ""} /><b>{trip.active ? "Trip in progress" : "No active trip"}<small>{trip.active ? "Location updates enabled" : "Start trip to share location"}</small></b></div><button className={trip.active ? "danger-button" : "primary-button"} onClick={() => onChange({ ...trip, active: !trip.active, updatedAt: new Date().toISOString() })}><Bus size={15} />{trip.active ? "End trip" : "Start simulated trip"}</button>{trip.active && <button className="secondary-button" onClick={() => { const next = (step + 1) % positions.length; setStep(next); onChange({ ...trip, position: positions[next], updatedAt: new Date().toISOString() }); }}>Advance simulated bus</button>}{role === "driver" && <button className="secondary-button" disabled={!trip.active} onClick={shareLocation}><Activity size={14} /> Share my GPS location</button>}<p className="fine-print">Demo coordinates are simulated. Browser location only runs while this screen is open; background tracking is not guaranteed.</p></section><section className="panel stops-panel"><PanelHeading title="Route stops" subtitle="Approximate estimated times" />{["Riverside Public School", "Green Park", "Lake View Colony", "Srinagar Colony", "Banjara Hills"].map((stop, index) => <div className="stop-row" key={stop}><i className={index < step && trip.active ? "passed" : ""} /><b>{stop}<small>{index === 0 ? "School · Departure" : `${index + 1} students`}</small></b><time>8:{String(8 + index * 7).padStart(2, "0")} AM</time></div>)}</section><section className="panel safety-note"><ShieldCheck size={17} /><b>Student safety matters<small>Boarding is confirmed by staff, never inferred from bus location.</small></b></section></aside></div>;
}

function Homework({ role, items, exams, marks, userId, schoolId }: { role: DemoRole; items: HomeworkItem[]; exams: ExamItem[]; marks: MarkItem[]; userId?: string; schoolId?: string }) {
  const [done, setDone] = useState<string[]>([]);
  async function submitHomework(id: string) {
    setDone((current) => [...new Set([...current, id])]);
    if (supabase && userId && schoolId) {
      const { error } = await supabase.from("homework_submissions").upsert({ school_id: schoolId, homework_id: id, submitted_by: userId, status: "submitted" }, { onConflict: "homework_id,submitted_by" });
      if (error) setDone((current) => current.filter((item) => item !== id));
    }
  }
  return <div className="homework-grid"><section className="panel homework-panel"><PanelHeading title={role === "parent" ? "Linked assignments" : "Assigned homework"} subtitle={`${items.length} assignments · sorted by due date`} />{items.map((item) => <div className="assignment-row" key={item.id}><span><FileText size={16} /></span><b><small>{item.subject}</small>{item.title}<em>Assigned by {item.teacher}</em></b><strong>{new Date(item.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong><label>{done.includes(item.id) ? "Submitted" : item.status}</label>{role === "parent" && <button className="row-action" onClick={() => void submitHomework(item.id)}>{done.includes(item.id) ? "Done" : "Mark done"}</button>}</div>)}</section><section className="panel exams-panel"><PanelHeading title="Upcoming assessments" subtitle="Persisted school assessments" />{exams.map((exam) => <Exam key={exam.id} startsAt={exam.startsAt} subject={exam.subject} title={exam.title} />)}{marks.length > 0 && <div className="results-list"><PanelHeading title="Latest results" subtitle="Persisted marks" />{marks.map((mark) => <div className="result-row" key={mark.id}><b>{mark.studentName}<small>{mark.feedback ?? "No feedback"}</small></b><strong>{mark.score}/{mark.maxMarks}</strong></div>)}</div>}</section></div>;
}
function Exam({ startsAt, subject, title }: { startsAt: string; subject: string; title: string }) { const date = new Date(startsAt); return <div className="exam"><span><small>{date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</small><b>{date.toLocaleDateString("en-IN", { day: "2-digit" })}</b></span><strong><small>{subject}</small>{title}<em>{date.toLocaleDateString("en-IN", { weekday: "long" })} · {date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</em></strong><ChevronRight size={15} /></div>; }

function Notices({ role, notices, draft, onDraft, onPublish, onRead }: { role: DemoRole; notices: Announcement[]; draft: string; onDraft: (value: string) => void; onPublish: (event: React.FormEvent<HTMLFormElement>) => void; onRead: (id: string) => void }) {
  return <div className="notices-grid"><section className="panel notice-panel"><PanelHeading title="Recent updates" subtitle={`${notices.length} announcements · Riverside Public School`} />{notices.map((notice) => <article className={`notice-row ${notice.unread ? "notice-new" : ""}`} key={notice.id}><span><MessageSquareText size={17} /></span><b><small>{notice.category} · {new Date(notice.publishedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small>{notice.title}<em>{notice.audience} · Posted by {notice.author}</em></b>{notice.unread && <button className="row-action" onClick={() => onRead(notice.id)}>Mark read</button>}</article>)}</section>{role !== "parent" && <form className="panel compose" onSubmit={onPublish}><PanelHeading title="Share an update" subtitle="Post a notice to your community." /><label htmlFor="notice">Announcement</label><textarea id="notice" value={draft} onChange={(event) => onDraft(event.target.value)} maxLength={140} required placeholder="Write a clear, helpful update..." /><div><small>{140 - draft.length} characters left</small><button className="primary-button"><Plus size={14} /> Publish</button></div></form>}</div>;
}

function Directory({ students, onExport, onCreate }: { students: DemoState["students"]; onExport: () => void; onCreate: (student: DemoState["students"][number]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("Class 5A");
  const [route, setRoute] = useState("Unassigned");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const cleanName = name.trim(); if (!cleanName) return;
    onCreate({ id: crypto.randomUUID(), name: cleanName, initials: cleanName.split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join(""), className, attendance: "100%", route });
    setName(""); setShowForm(false);
  }
  return <><section className="panel table-panel"><div className="table-tools"><span>{students.length} demo records</span><div><button className="secondary-button" onClick={onExport}>Export CSV</button><button className="primary-button" onClick={() => setShowForm((visible) => !visible)}><Plus size={14} />{showForm ? "Cancel" : "Add student"}</button></div></div>{showForm && <form className="student-form" onSubmit={submit}><label>Student name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label><label>Class<select value={className} onChange={(event) => setClassName(event.target.value)}><option>Class 5A</option><option>Class 5B</option><option>Class 6A</option></select></label><label>Bus route<select value={route} onChange={(event) => setRoute(event.target.value)}><option>Unassigned</option><option>Route 01</option><option>Route 02</option><option>Pickup</option></select></label><button className="primary-button" type="submit"><Check size={14} /> Create demo record</button></form>}<div className="table-scroll"><table><thead><tr><th>STUDENT</th><th>CLASS</th><th>ATTENDANCE</th><th>BUS ROUTE</th><th>STATUS</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><span className="student"><i>{student.initials}</i><b>{student.name}</b></span></td><td>{student.className}</td><td>{student.attendance}</td><td>{student.route}</td><td><span className="attendance-status present"><i />Active</span></td></tr>)}</tbody></table></div></section></>;
}