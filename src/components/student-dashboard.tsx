"use client";

import { useEffect, useState } from "react";
import { Bell, BookOpen, CalendarDays, Check, ClipboardCheck, FileText, GraduationCap, LoaderCircle, LogOut, Megaphone, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

type StudentDashboardProps = { userId: string; userName: string; userEmail: string; schoolId: string; onSignOut: () => Promise<void> };
type PortalData = {
  student: { id: string; name: string; sectionId: string; sectionName: string; className: string };
  attendance: { date: string; status: string }[];
  homework: { id: string; title: string; subject: string; dueAt: string; description: string }[];
  exams: { id: string; title: string; subject: string; startsAt: string; maxMarks: number }[];
  marks: { id: string; title: string; subject: string; score: number; maxMarks: number; feedback: string | null }[];
  topics: { id: string; title: string; subject: string; status: string }[];
  timetable: { id: string; subject: string; teacher: string; day: number; startsAt: string; endsAt: string; room: string | null; isBreak: boolean }[];
  announcements: { id: string; title: string; body: string; publishedAt: string }[];
  notifications: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[];
};

export default function StudentDashboard({ userId, userName, userEmail, schoolId, onSignOut }: StudentDashboardProps) {
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = supabase;
    if (!client) { queueMicrotask(() => { setError("Supabase is not configured."); setLoading(false); }); return; }
    const configuredClient = client;
    async function load() {
      const studentResult = await configuredClient.from("students").select("id, full_name, section_id").eq("user_id", userId).eq("school_id", schoolId).maybeSingle();
      if (studentResult.error) throw new Error(studentResult.error.message);
      if (!studentResult.data) throw new Error("Your student account is not linked to a student record.");
      const student = studentResult.data;
      const [sectionResult, attendanceResult, homeworkResult, examsResult, marksResult, chaptersResult, topicsResult, subjectsResult, timetableResult, announcementResult, notificationResult] = await Promise.all([
        configuredClient.from("sections").select("name, class_id").eq("id", student.section_id).eq("school_id", schoolId).maybeSingle(),
        configuredClient.from("attendance_records").select("attendance_date, status").eq("student_id", student.id).eq("school_id", schoolId).order("attendance_date", { ascending: false }).limit(30),
        configuredClient.from("homework").select("id, title, description, due_at, subject_id").eq("section_id", student.section_id).eq("school_id", schoolId).order("due_at").limit(10),
        configuredClient.from("exams").select("id, title, starts_at, max_marks, subject_id").eq("section_id", student.section_id).eq("school_id", schoolId).order("starts_at").limit(10),
        configuredClient.from("marks").select("id, exam_id, score, feedback").eq("student_id", student.id).eq("school_id", schoolId).order("id", { ascending: false }).limit(20),
        configuredClient.from("syllabus_chapters").select("id, subject_id").eq("section_id", student.section_id).eq("school_id", schoolId),
        configuredClient.from("syllabus_topics").select("id, title, status, chapter_id").eq("school_id", schoolId).order("updated_at", { ascending: false }).limit(50),
        configuredClient.from("subjects").select("id, name").eq("school_id", schoolId),
        configuredClient.from("timetable_periods").select("id, subject_id, day_of_week, starts_at, ends_at, room, is_break, teacher_id").eq("section_id", student.section_id).eq("school_id", schoolId).order("day_of_week").order("period_number"),
        configuredClient.from("announcements").select("id, title, body, published_at").eq("school_id", schoolId).or(`audience.eq.school,audience.eq.emergency,section_id.eq.${student.section_id}`).order("published_at", { ascending: false }).limit(10),
        configuredClient.from("notifications").select("id, title, body, created_at, read_at").eq("user_id", userId).eq("school_id", schoolId).order("created_at", { ascending: false }).limit(10),
      ]);
      const allResults = [sectionResult, attendanceResult, homeworkResult, examsResult, marksResult, chaptersResult, topicsResult, subjectsResult, timetableResult, announcementResult, notificationResult];
      const firstError = allResults.find((result) => result.error)?.error;
      if (firstError) throw new Error(firstError.message);
      const section = sectionResult.data;
      const classResult = section ? await configuredClient.from("classes").select("name").eq("id", section.class_id).eq("school_id", schoolId).maybeSingle() : { data: null, error: null };
      if (classResult.error) throw new Error(classResult.error.message);
      const subjects = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
      const chapters = new Map((chaptersResult.data ?? []).map((chapter) => [chapter.id, chapter.subject_id]));
      const exams = (examsResult.data ?? []).filter((exam) => exam.starts_at).map((exam) => ({ id: exam.id, title: exam.title, subject: subjects.get(exam.subject_id) ?? "Subject", startsAt: exam.starts_at, maxMarks: Number(exam.max_marks) }));
      const examById = new Map(exams.map((exam) => [exam.id, exam]));
      setData({
        student: { id: student.id, name: student.full_name, sectionId: student.section_id, sectionName: section?.name ?? "Section", className: classResult.data?.name ?? "Class" },
        attendance: (attendanceResult.data ?? []).map((row) => ({ date: row.attendance_date, status: row.status })),
        homework: (homeworkResult.data ?? []).map((item) => ({ id: item.id, title: item.title, description: item.description, subject: subjects.get(item.subject_id) ?? "Subject", dueAt: item.due_at })),
        exams,
        marks: (marksResult.data ?? []).flatMap((mark) => { const exam = examById.get(mark.exam_id); return exam ? [{ id: mark.id, title: exam.title, subject: exam.subject, score: Number(mark.score), maxMarks: exam.maxMarks, feedback: mark.feedback }] : []; }),
        topics: (topicsResult.data ?? []).map((topic) => ({ id: topic.id, title: topic.title, status: topic.status, subject: subjects.get(chapters.get(topic.chapter_id) ?? "") ?? "Subject" })),
        timetable: (timetableResult.data ?? []).map((period) => ({ id: period.id, subject: subjects.get(period.subject_id) ?? (period.is_break ? "Break" : "Subject"), teacher: "Assigned teacher", day: period.day_of_week, startsAt: period.starts_at, endsAt: period.ends_at, room: period.room, isBreak: period.is_break })),
        announcements: (announcementResult.data ?? []).map((notice) => ({ id: notice.id, title: notice.title, body: notice.body, publishedAt: notice.published_at })),
        notifications: (notificationResult.data ?? []).map((notice) => ({ id: notice.id, title: notice.title, body: notice.body, createdAt: notice.created_at, readAt: notice.read_at })),
      });
    }
    void load().catch((loadError: Error) => setError(loadError.message)).finally(() => setLoading(false));
  }, [schoolId, userId]);

  if (loading) return <main className="auth-shell"><div className="auth-loading"><LoaderCircle className="spin" size={22} />Loading your student workspace...</div></main>;
  if (error || !data) return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark"><GraduationCap size={21} /></span><div><b>school<span>connect</span></b><small>by ProjectPilot</small></div></div><h1>Student portal unavailable</h1><p className="auth-copy">{error || "No student data is available yet."}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></section></main>;

  const present = data.attendance.filter((row) => row.status === "Present" || row.status === "Late").length;
  const attendancePercent = data.attendance.length ? Math.round((present / data.attendance.length) * 100) : 0;
  const completed = data.topics.filter((topic) => topic.status === "Completed").length;
  const syllabusPercent = data.topics.length ? Math.round((completed / data.topics.length) * 100) : 0;
  const unread = data.notifications.filter((notice) => !notice.readAt).length;

  async function markRead(id: string) {
    setData((current) => current ? { ...current, notifications: current.notifications.map((notice) => notice.id === id ? { ...notice, readAt: new Date().toISOString() } : notice) } : current);
    if (supabase) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).eq("school_id", schoolId);
  }

  return <div className="student-portal">
    <header className="student-topbar"><div className="brand"><span className="brand-mark"><GraduationCap size={21} /></span><span><b>school<span>connect</span></b><small>Student workspace</small></span></div><div className="student-actions"><span>{userName} · {userEmail}</span><button className="secondary-button" onClick={() => void onSignOut()}><LogOut size={14} /> Sign out</button></div></header>
    <main className="student-content">
      <div className="page-heading"><div><p className="eyebrow">STUDENT PORTAL</p><h1>Good morning, {data.student.name.split(" ")[0]}</h1><p>{data.student.className} · Section {data.student.sectionName}</p></div><div className="student-profile"><UserRound size={16} /> {data.student.name}</div></div>
      <div className="stats-grid"><article className="stat"><div className="stat-top"><span>Attendance</span><span className="stat-icon mint"><ClipboardCheck size={17} /></span></div><b className="stat-value">{attendancePercent}%</b><span className="stat-detail">Based on recorded attendance</span></article><article className="stat"><div className="stat-top"><span>Syllabus</span><span className="stat-icon blue"><BookOpen size={17} /></span></div><b className="stat-value">{syllabusPercent}%</b><span className="stat-detail">{completed} completed topics</span></article><article className="stat"><div className="stat-top"><span>Due soon</span><span className="stat-icon amber"><FileText size={17} /></span></div><b className="stat-value">{data.homework.length}</b><span className="stat-detail">Assignments from your class</span></article><article className="stat"><div className="stat-top"><span>Notifications</span><span className="stat-icon rose"><Bell size={17} /></span></div><b className="stat-value">{unread}</b><span className="stat-detail">Unread updates</span></article></div>
      <div className="student-grid"><section className="panel"><PanelTitle icon={<CalendarDays size={16} />} title="This week's timetable" subtitle="Your assigned section schedule" />{data.timetable.length ? data.timetable.slice(0, 8).map((period) => <div className="student-row" key={period.id}><b>{period.subject}<small>{period.teacher} · {period.room ?? "Room not set"}</small></b><span>Day {period.day}<small>{period.startsAt.slice(0, 5)}–{period.endsAt.slice(0, 5)}</small></span></div>) : <Empty text="No timetable has been published yet." />}</section><section className="panel"><PanelTitle icon={<FileText size={16} />} title="Homework due soon" subtitle="Assignments from your teachers" />{data.homework.length ? data.homework.slice(0, 5).map((item) => <div className="student-row" key={item.id}><b>{item.title}<small>{item.subject} · {item.description}</small></b><span>{new Date(item.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>) : <Empty text="No homework is currently assigned." />}</section><section className="panel"><PanelTitle icon={<GraduationCap size={16} />} title="Results" subtitle="Only published marks are shown" />{data.marks.length ? data.marks.map((mark) => <div className="student-row" key={mark.id}><b>{mark.subject}<small>{mark.title} · {mark.feedback ?? "No feedback"}</small></b><strong>{mark.score}/{mark.maxMarks}</strong></div>) : <Empty text="No published results yet." />}</section><section className="panel"><PanelTitle icon={<BookOpen size={16} />} title="Syllabus progress" subtitle={`${syllabusPercent}% across your subjects`} />{data.topics.length ? [...new Set(data.topics.map((topic) => topic.subject))].map((subject) => { const rows = data.topics.filter((topic) => topic.subject === subject); const value = Math.round(rows.filter((topic) => topic.status === "Completed").length / rows.length * 100); return <div className="student-progress" key={subject}><span>{subject}<b>{value}%</b></span><i><em style={{ width: `${value}%` }} /></i></div>; }) : <Empty text="No syllabus topics have been published." />}</section><section className="panel"><PanelTitle icon={<Megaphone size={16} />} title="Announcements" subtitle="School and class updates" />{data.announcements.length ? data.announcements.slice(0, 4).map((notice) => <div className="student-row" key={notice.id}><b>{notice.title}<small>{notice.body}</small></b><span>{new Date(notice.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>) : <Empty text="No announcements yet." />}</section><section className="panel"><PanelTitle icon={<Bell size={16} />} title="Notifications" subtitle={`${unread} unread`} />{data.notifications.length ? data.notifications.slice(0, 5).map((notice) => <div className="student-row" key={notice.id}><b>{notice.title}<small>{notice.body}</small></b>{!notice.readAt && <button className="row-action" onClick={() => void markRead(notice.id)}><Check size={13} /> Read</button>}</div>) : <Empty text="You're all caught up." />}</section></div>
    </main>
  </div>;
}

function PanelTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><span className="stat-icon blue">{icon}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="student-empty">{text}</p>;
}
