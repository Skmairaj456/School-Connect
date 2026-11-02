import type { Announcement, DemoState, ExamItem, HomeworkItem, MarkItem, Topic } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export async function loadSchoolDashboard(schoolId: string, seed: DemoState): Promise<DemoState> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const [studentsResult, attendanceResult, topicsResult, announcementsResult, homeworkResult, examsResult, marksResult, tripResult, subjectsResult, chaptersResult] = await Promise.all([
    supabase.from("students").select("id, full_name").eq("school_id", schoolId).eq("is_active", true).order("full_name"),
    supabase.from("attendance_records").select("id, student_id, status, check_in_at, recorded_by").eq("school_id", schoolId).eq("attendance_date", today()),
    supabase.from("syllabus_topics").select("id, title, status, updated_at, chapter_id").eq("school_id", schoolId).order("updated_at", { ascending: false }),
    supabase.from("announcements").select("id, title, audience, published_at, author_id").eq("school_id", schoolId).order("published_at", { ascending: false }).limit(30),
    supabase.from("homework").select("id, title, due_at, teacher_id, subject_id").eq("school_id", schoolId).order("due_at").limit(30),
    supabase.from("exams").select("id, title, starts_at, max_marks, subject_id").eq("school_id", schoolId).order("starts_at").limit(20),
    supabase.from("marks").select("id, exam_id, score, feedback, student_id").eq("school_id", schoolId).order("id").limit(50),
    supabase.from("bus_trips").select("id, route_id, status, started_at").eq("school_id", schoolId).eq("status", "active").order("started_at", { ascending: false }).limit(1),
    supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name"),
    supabase.from("syllabus_chapters").select("id, subject_id").eq("school_id", schoolId),
  ]);
  const firstError = [studentsResult, attendanceResult, topicsResult, announcementsResult, homeworkResult, examsResult, marksResult, tripResult, subjectsResult, chaptersResult].find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const students = (studentsResult.data ?? []).map((student) => ({
    id: student.id,
    name: student.full_name,
    initials: student.full_name.split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() ?? "").join(""),
    className: "School roster",
    attendance: "—",
    route: "Assigned by school",
  }));
  const studentById = new Map((studentsResult.data ?? []).map((student) => [student.id, student]));
  const subjectById = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
  const chapterSubjectById = new Map((chaptersResult.data ?? []).map((chapter) => [chapter.id, chapter.subject_id]));
  const attendance = (attendanceResult.data ?? []).map((row) => {
    const linkedStudent = studentById.get(row.student_id);
    return {
      id: row.id,
      name: linkedStudent?.full_name ?? "Student",
      initials: (linkedStudent?.full_name ?? "S").split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase() ?? "").join(""),
      className: "School roster",
      status: row.status,
      checkIn: row.check_in_at ? new Date(row.check_in_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—",
      recordedBy: "School staff",
    };
  }) as DemoState["attendance"];
  const topics = (topicsResult.data ?? []).map((topic) => {
    return { id: topic.id, subject: subjectById.get(chapterSubjectById.get(topic.chapter_id) ?? "") ?? "Subject", title: topic.title, status: topic.status, plannedDate: `Updated ${new Date(topic.updated_at).toLocaleDateString("en-IN")}`, teacher: "Assigned teacher" };
  }) as Topic[];
  const announcements = (announcementsResult.data ?? []).map((notice) => {
    return { id: notice.id, title: notice.title, audience: notice.audience, category: notice.audience === "emergency" ? "Transport alert" : "School update", publishedAt: notice.published_at, author: "School staff", unread: false };
  }) as Announcement[];
  const homework = (homeworkResult.data ?? []).map((item) => {
    return { id: item.id, subject: subjectById.get(item.subject_id) ?? "Subject", title: item.title, dueAt: item.due_at, teacher: "Assigned teacher", status: "Assigned" };
  }) as HomeworkItem[];
  const exams = (examsResult.data ?? []).map((item) => {
    return { id: item.id, subject: subjectById.get(item.subject_id) ?? "Subject", title: item.title, startsAt: item.starts_at, maxMarks: Number(item.max_marks) };
  }) as ExamItem[];
  const marks = (marksResult.data ?? []).map((item) => {
    const exam = exams.find((candidate) => candidate.id === item.exam_id);
    return { id: item.id, examId: item.exam_id, studentName: studentById.get(item.student_id)?.full_name ?? "Student", score: Number(item.score), maxMarks: exam?.maxMarks ?? 0, feedback: item.feedback };
  }) as MarkItem[];
  const activeTrip = tripResult.data?.[0];
  const locationResult = activeTrip ? await supabase.from("bus_locations").select("latitude, longitude, recorded_at, simulated").eq("school_id", schoolId).eq("trip_id", activeTrip.id).order("recorded_at", { ascending: false }).limit(1).maybeSingle() : { data: null, error: null };
  if (locationResult.error) throw new Error(locationResult.error.message);
  const latestLocation = locationResult.data;

  return {
    ...seed,
    students: students.length ? students : seed.students,
    attendance: attendance.length ? attendance : seed.attendance,
    topics: topics.length ? topics : seed.topics,
    announcements: announcements.length ? announcements : seed.announcements,
    homework: homework.length ? homework : seed.homework,
    exams: exams.length ? exams : seed.exams,
    marks: marks.length ? marks : seed.marks,
    trip: activeTrip ? {
      id: activeTrip.id,
      routeId: activeTrip.route_id,
      active: true,
      position: latestLocation ? [latestLocation.latitude, latestLocation.longitude] : seed.trip.position,
      updatedAt: latestLocation?.recorded_at ?? activeTrip.started_at,
      simulated: latestLocation?.simulated ?? false,
    } : { ...seed.trip, active: false },
  };
}
