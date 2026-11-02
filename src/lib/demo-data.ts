export type DemoRole = "platform_admin" | "administrator" | "parent" | "teacher" | "driver" | "student";
export type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused";

export interface AttendanceRecord {
  id: string;
  name: string;
  initials: string;
  className: string;
  status: AttendanceStatus;
  checkIn: string;
  recordedBy: string;
}

export interface Topic {
  id: string;
  subject: string;
  title: string;
  status: "Not Started" | "In Progress" | "Completed";
  plannedDate: string;
  teacher: string;
}

export interface Announcement {
  id: string;
  title: string;
  audience: string;
  category: string;
  publishedAt: string;
  author: string;
  unread: boolean;
}

export interface HomeworkItem {
  id: string;
  subject: string;
  title: string;
  dueAt: string;
  teacher: string;
  status: string;
}

export interface ExamItem {
  id: string;
  subject: string;
  title: string;
  startsAt: string;
  maxMarks: number;
}

export interface MarkItem {
  id: string;
  examId: string;
  studentName: string;
  score: number;
  maxMarks: number;
  feedback: string | null;
}

export interface DemoState {
  attendance: AttendanceRecord[];
  attendanceTrend: { day: string; percentage: number }[];
  topics: Topic[];
  announcements: Announcement[];
  students: { id: string; name: string; initials: string; className: string; attendance: string; route: string }[];
  homework: HomeworkItem[];
  exams: ExamItem[];
  marks: MarkItem[];
  trip: { id?: string; routeId?: string; active: boolean; position: [number, number]; updatedAt: string | null; simulated?: boolean };
}

// Demo dates are relative to today so the sample school day never looks stale.
function daysFromNow(days: number, hours = 9, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function plannedOn(days: number) {
  return `Planned ${new Date(daysFromNow(days)).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

export const demoSeed: DemoState = {
  attendanceTrend: [
    { day: "Mon", percentage: 91 }, { day: "Tue", percentage: 95 }, { day: "Wed", percentage: 88 },
    { day: "Thu", percentage: 97 }, { day: "Fri", percentage: 94 }, { day: "Mon", percentage: 96 }, { day: "Tue", percentage: 93 },
  ],
  attendance: [
    { id: "st-01", name: "Meera Mehta", initials: "MM", className: "Class 5A", status: "Present", checkIn: "8:12 AM", recordedBy: "S. Rao" },
    { id: "st-02", name: "Aarav Sharma", initials: "AS", className: "Class 5A", status: "Present", checkIn: "8:08 AM", recordedBy: "S. Rao" },
    { id: "st-03", name: "Diya Reddy", initials: "DR", className: "Class 5A", status: "Late", checkIn: "8:31 AM", recordedBy: "S. Rao" },
    { id: "st-04", name: "Kabir Nair", initials: "KN", className: "Class 5A", status: "Absent", checkIn: "—", recordedBy: "S. Rao" },
    { id: "st-05", name: "Anaya Gupta", initials: "AG", className: "Class 5A", status: "Present", checkIn: "8:14 AM", recordedBy: "S. Rao" },
    { id: "st-06", name: "Ishaan Rao", initials: "IR", className: "Class 5A", status: "Present", checkIn: "8:10 AM", recordedBy: "S. Rao" },
  ],
  topics: [
    { id: "t-01", subject: "Science", title: "Plant systems and growth", status: "Completed", plannedDate: plannedOn(-10), teacher: "M. Iyer" },
    { id: "t-02", subject: "Science", title: "The water cycle", status: "In Progress", plannedDate: plannedOn(-3), teacher: "M. Iyer" },
    { id: "t-03", subject: "Science", title: "Our solar system", status: "Not Started", plannedDate: plannedOn(4), teacher: "M. Iyer" },
    { id: "t-04", subject: "Mathematics", title: "Fractions and decimals", status: "In Progress", plannedDate: plannedOn(-7), teacher: "S. Rao" },
    { id: "t-05", subject: "Mathematics", title: "Measurement and area", status: "Not Started", plannedDate: plannedOn(2), teacher: "S. Rao" },
    { id: "t-06", subject: "English", title: "Reading for meaning", status: "Completed", plannedDate: plannedOn(-12), teacher: "A. Thomas" },
    { id: "t-07", subject: "English", title: "Writing a short story", status: "In Progress", plannedDate: plannedOn(-2), teacher: "A. Thomas" },
  ],
  announcements: [
    { id: "notice-01", title: "Annual day rehearsal schedule", audience: "Whole school", category: "School update", publishedAt: daysFromNow(0, 7, 42), author: "School Office", unread: true },
    { id: "notice-02", title: "Route 02 running 5 minutes behind", audience: "Route 02 families", category: "Transport alert", publishedAt: daysFromNow(0, 7, 15), author: "Transport Desk", unread: true },
    { id: "notice-03", title: "Parent-teacher meeting bookings open", audience: "Class 5 families", category: "School update", publishedAt: daysFromNow(-2, 13, 0), author: "Class 5 Team", unread: false },
  ],
  students: [
    { id: "s-01", name: "Meera Mehta", initials: "MM", className: "Class 5A", attendance: "96%", route: "Route 02" },
    { id: "s-02", name: "Aarav Sharma", initials: "AS", className: "Class 5A", attendance: "94%", route: "Route 01" },
    { id: "s-03", name: "Diya Reddy", initials: "DR", className: "Class 5A", attendance: "98%", route: "Route 02" },
    { id: "s-04", name: "Kabir Nair", initials: "KN", className: "Class 5A", attendance: "91%", route: "Pickup" },
    { id: "s-05", name: "Anaya Gupta", initials: "AG", className: "Class 5A", attendance: "97%", route: "Route 02" },
    { id: "s-06", name: "Ishaan Rao", initials: "IR", className: "Class 5A", attendance: "93%", route: "Route 01" },
  ],
  homework: [
    { id: "hw-01", subject: "Mathematics", title: "Fractions · Exercise 4", dueAt: daysFromNow(1, 15), teacher: "S. Rao", status: "Due soon" },
    { id: "hw-02", subject: "Science", title: "Plant life observation journal", dueAt: daysFromNow(4, 15), teacher: "M. Iyer", status: "In progress" },
    { id: "hw-03", subject: "English", title: "Reading response: The Blue Umbrella", dueAt: daysFromNow(8, 15), teacher: "A. Thomas", status: "Assigned" },
  ],
  exams: [
    { id: "exam-01", subject: "Mathematics", title: "Unit assessment · Fractions", startsAt: daysFromNow(6, 9), maxMarks: 50 },
    { id: "exam-02", subject: "Science", title: "Chapter quiz · Plant systems", startsAt: daysFromNow(11, 10, 30), maxMarks: 40 },
  ],
  marks: [
    { id: "mark-01", examId: "exam-01", studentName: "Meera Mehta", score: 42, maxMarks: 50, feedback: "Strong reasoning" },
    { id: "mark-02", examId: "exam-02", studentName: "Meera Mehta", score: 34, maxMarks: 40, feedback: "Excellent observation notes" },
  ],
  trip: { active: true, position: [17.4239, 78.4738], updatedAt: daysFromNow(0, 8, 32), simulated: true },
};