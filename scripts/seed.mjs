import { createClient } from "@supabase/supabase-js";

if (process.env.NODE_ENV === "production") throw new Error("Demo seed is disabled in production.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const schoolId = "10000000-0000-4000-8000-000000000001";
const ids = (start, count) => Array.from({ length: count }, (_, index) => `20000000-0000-4000-8000-${String(start + index).padStart(12, "0")}`);
const [yearId, class5Id, class6Id, section5aId, section5bId, section6aId] = ids(1, 6);
const [mathId, scienceId, englishId] = ids(20, 3);
const [adminTeacherId, teacherId, secondTeacherId, driverId] = ids(30, 4);
const [bus12Id, bus18Id, route2Id, route1Id] = ids(40, 4);
const studentIds = ids(100, 12);
const stopIds = ids(120, 6);
const [chapterScienceId, chapterMathId, chapterEnglishId] = ids(130, 3);
const topicIds = ids(140, 7);
const [tripId, homeworkMathId, homeworkScienceId, homeworkEnglishId, examMathId, examScienceId, announcementId, eventId, feeId] = ids(160, 9);
const accounts = [
  { email: "platform@school-connect.demo", name: "ProjectPilot Platform", role: "platform_admin" },
  { email: "admin@school-connect.demo", name: "Aarav Patel", role: "administrator" },
  { email: "parent1@school-connect.demo", name: "Ananya Mehta", role: "parent" },
  { email: "parent2@school-connect.demo", name: "Neha Sharma", role: "parent" },
  { email: "student@school-connect.demo", name: "Meera Mehta", role: "student" },
  { email: "teacher@school-connect.demo", name: "S. Rao", role: "teacher" },
  { email: "teacher2@school-connect.demo", name: "M. Iyer", role: "teacher" },
  { email: "driver@school-connect.demo", name: "Ravi Kumar", role: "driver" },
];

async function write(table, rows, onConflict = "id") {
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
}

const { data: userPage, error: listError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
const usersByEmail = new Map(userPage.users.map((user) => [user.email, user]));
for (const account of accounts) {
  if (!usersByEmail.has(account.email)) {
    const { data, error } = await db.auth.admin.createUser({ email: account.email, password: "SchoolDemo!2026", email_confirm: true, user_metadata: { full_name: account.name } });
    if (error) throw new Error(`Create ${account.email}: ${error.message}`);
    usersByEmail.set(account.email, data.user);
  }
}
const profiles = accounts.map((account) => ({ id: usersByEmail.get(account.email).id, school_id: schoolId, full_name: account.name, is_active: true }));
const profileByEmail = new Map(accounts.map((account) => [account.email, usersByEmail.get(account.email).id]));
const teacherProfileIds = [profileByEmail.get("admin@school-connect.demo"), profileByEmail.get("teacher@school-connect.demo"), profileByEmail.get("teacher2@school-connect.demo")];
const driverProfileId = profileByEmail.get("driver@school-connect.demo");
const studentRows = studentIds.map((id, index) => ({ id, school_id: schoolId, section_id: index < 6 ? section5aId : index < 9 ? section5bId : section6aId, admission_number: `RPS-${String(index + 1).padStart(4, "0")}`, full_name: ["Meera Mehta", "Aarav Sharma", "Diya Reddy", "Kabir Nair", "Anaya Gupta", "Ishaan Rao", "Aanya Kapoor", "Vihaan Das", "Sara Khan", "Arjun Menon", "Tara Bose", "Dev Shah"][index], is_active: true }));

await write("schools", [{ id: schoolId, name: "Riverside Public School", timezone: "Asia/Kolkata" }]);
const starterPlanId = "30000000-0000-4000-8000-000000000001";
await write("subscription_plans", [
  { id: starterPlanId, name: "Starter", monthly_amount_inr: 1999, student_limit: 250, features: { transport: true, syllabus: true, reports: true } },
  { id: "30000000-0000-4000-8000-000000000002", name: "Growth", monthly_amount_inr: 4999, student_limit: 750, features: { transport: true, syllabus: true, reports: true, analytics: true } },
  { id: "30000000-0000-4000-8000-000000000003", name: "Plus", monthly_amount_inr: 8999, student_limit: 1500, features: { transport: true, syllabus: true, reports: true, analytics: true, groups: true } },
  { id: "30000000-0000-4000-8000-000000000004", name: "School group", monthly_amount_inr: 0, student_limit: null, features: { custom_pricing: true } },
], "id");
await write("school_subscriptions", [{ school_id: schoolId, plan_id: starterPlanId, status: "active", starts_on: "2026-06-01", renews_on: "2026-12-01" }], "school_id");
await write("profiles", profiles);
await write("user_roles", accounts.map((account) => ({ user_id: profileByEmail.get(account.email), school_id: schoolId, role: account.role })), "user_id,school_id,role");
await write("academic_years", [{ id: yearId, school_id: schoolId, name: "2026–27", starts_on: "2026-06-01", ends_on: "2027-05-31", is_current: true }]);
await write("classes", [{ id: class5Id, school_id: schoolId, academic_year_id: yearId, name: "Class 5" }, { id: class6Id, school_id: schoolId, academic_year_id: yearId, name: "Class 6" }]);
await write("sections", [{ id: section5aId, school_id: schoolId, class_id: class5Id, name: "A" }, { id: section5bId, school_id: schoolId, class_id: class5Id, name: "B" }, { id: section6aId, school_id: schoolId, class_id: class6Id, name: "A" }]);
await write("subjects", [{ id: mathId, school_id: schoolId, name: "Mathematics" }, { id: scienceId, school_id: schoolId, name: "Science" }, { id: englishId, school_id: schoolId, name: "English" }]);
await write("teachers", [adminTeacherId, teacherId, secondTeacherId].map((id, index) => ({ id, school_id: schoolId, profile_id: teacherProfileIds[index], employee_code: `T-${index + 1}` })));
await write("teacher_assignments", [{ id: ids(50, 1)[0], school_id: schoolId, teacher_id: teacherId, section_id: section5aId, subject_id: mathId }, { id: ids(51, 1)[0], school_id: schoolId, teacher_id: secondTeacherId, section_id: section5aId, subject_id: scienceId }, { id: ids(52, 1)[0], school_id: schoolId, teacher_id: teacherId, section_id: section5bId, subject_id: englishId }]);
await write("timetable_periods", [
  { id: ids(240, 1)[0], school_id: schoolId, section_id: section5aId, subject_id: mathId, teacher_id: teacherId, day_of_week: 1, period_number: 1, starts_at: "08:00", ends_at: "08:45", room: "Room 5A" },
  { id: ids(241, 1)[0], school_id: schoolId, section_id: section5aId, subject_id: scienceId, teacher_id: secondTeacherId, day_of_week: 1, period_number: 2, starts_at: "08:50", ends_at: "09:35", room: "Science Lab" },
  { id: ids(242, 1)[0], school_id: schoolId, section_id: section5aId, subject_id: englishId, teacher_id: teacherId, day_of_week: 2, period_number: 1, starts_at: "08:00", ends_at: "08:45", room: "Room 5A" },
], "id");
await write("students", studentRows);
const { error: studentLinkError } = await db.from("students").update({ user_id: profileByEmail.get("student@school-connect.demo") }).eq("id", studentIds[0]).eq("school_id", schoolId);
if (studentLinkError) throw new Error(`Link student account: ${studentLinkError.message}`);
await write("parent_student_links", [{ school_id: schoolId, parent_user_id: profileByEmail.get("parent1@school-connect.demo"), student_id: studentIds[0], relationship: "mother", verified_at: new Date().toISOString() }, { school_id: schoolId, parent_user_id: profileByEmail.get("parent1@school-connect.demo"), student_id: studentIds[1], relationship: "guardian", verified_at: new Date().toISOString() }, { school_id: schoolId, parent_user_id: profileByEmail.get("parent2@school-connect.demo"), student_id: studentIds[2], relationship: "mother", verified_at: new Date().toISOString() }], "parent_user_id,student_id");
await write("buses", [{ id: bus12Id, school_id: schoolId, bus_number: "12", registration_number: "TS 09 AB 4582" }, { id: bus18Id, school_id: schoolId, bus_number: "18", registration_number: "TS 09 CD 1032" }]);
await write("drivers", [{ id: driverId, school_id: schoolId, profile_id: driverProfileId, license_last_four: "4821" }]);
await write("bus_routes", [{ id: route2Id, school_id: schoolId, bus_id: bus12Id, driver_id: driverId, name: "Route 02 · North loop" }, { id: route1Id, school_id: schoolId, bus_id: bus18Id, name: "Route 01 · East loop" }]);
await write("bus_stops", ["School", "Green Park", "Lake View", "Srinagar Colony", "Banjara Hills", "North Gate"].map((name, index) => ({ id: stopIds[index], school_id: schoolId, route_id: route2Id, name, sequence: index + 1, latitude: 17.4239 + index * 0.0025, longitude: 78.4738 + index * 0.0031 })));
await write("student_transport_assignments", studentIds.slice(0, 6).map((studentId, index) => ({ id: ids(180 + index, 1)[0], school_id: schoolId, student_id: studentId, route_id: route2Id, pickup_stop_id: stopIds[(index % 4) + 1], dropoff_stop_id: stopIds[0] })));
await write("bus_trips", [{ id: tripId, school_id: schoolId, route_id: route2Id, started_by: driverProfileId, status: "active", simulated: true, started_at: new Date().toISOString() }]);
const { error: clearLocationsError } = await db.from("bus_locations").delete().eq("trip_id", tripId);
if (clearLocationsError) throw new Error(`Clear demo locations: ${clearLocationsError.message}`);
const { error: locationError } = await db.from("bus_locations").insert({ trip_id: tripId, school_id: schoolId, latitude: 17.4298, longitude: 78.4819, simulated: true, recorded_at: new Date().toISOString() });
if (locationError) throw new Error(`Seed demo location: ${locationError.message}`);
await write("syllabus_chapters", [{ id: chapterScienceId, school_id: schoolId, section_id: section5aId, subject_id: scienceId, title: "Living systems", planned_start: "2026-10-01" }, { id: chapterMathId, school_id: schoolId, section_id: section5aId, subject_id: mathId, title: "Number and operations", planned_start: "2026-10-01" }, { id: chapterEnglishId, school_id: schoolId, section_id: section5aId, subject_id: englishId, title: "Reading and writing", planned_start: "2026-10-01" }]);
await write("syllabus_topics", [{ id: topicIds[0], school_id: schoolId, chapter_id: chapterScienceId, title: "Plant systems and growth", status: "Completed", planned_start: "2026-10-12" }, { id: topicIds[1], school_id: schoolId, chapter_id: chapterScienceId, title: "The water cycle", status: "In Progress", planned_start: "2026-10-19" }, { id: topicIds[2], school_id: schoolId, chapter_id: chapterScienceId, title: "Our solar system", status: "Not Started", planned_start: "2026-10-26" }, { id: topicIds[3], school_id: schoolId, chapter_id: chapterMathId, title: "Fractions and decimals", status: "In Progress", planned_start: "2026-10-15" }, { id: topicIds[4], school_id: schoolId, chapter_id: chapterMathId, title: "Measurement and area", status: "Not Started", planned_start: "2026-10-22" }, { id: topicIds[5], school_id: schoolId, chapter_id: chapterEnglishId, title: "Reading for meaning", status: "Completed", planned_start: "2026-10-10" }, { id: topicIds[6], school_id: schoolId, chapter_id: chapterEnglishId, title: "Writing a short story", status: "In Progress", planned_start: "2026-10-20" }]);
await write("attendance_records", studentIds.map((studentId, index) => ({ id: ids(200 + index, 1)[0], school_id: schoolId, student_id: studentId, attendance_date: new Date().toISOString().slice(0, 10), status: index === 3 ? "Absent" : index === 2 ? "Late" : "Present", recorded_by: profileByEmail.get("teacher@school-connect.demo") })), "id");
await write("homework", [[homeworkMathId, mathId, "Fractions · Exercise 4"], [homeworkScienceId, scienceId, "Plant life observation journal"], [homeworkEnglishId, englishId, "Reading response: The Blue Umbrella"]].map(([id, subjectId, title], index) => ({ id, school_id: schoolId, section_id: section5aId, subject_id: subjectId, teacher_id: teacherId, title, description: `Complete the ${title} activity and bring your work to class.`, due_at: new Date(Date.now() + (index + 1) * 86400000).toISOString() })));
await write("exams", [{ id: examMathId, school_id: schoolId, section_id: section5aId, subject_id: mathId, title: "Unit assessment · Fractions", starts_at: "2026-10-24T03:30:00.000Z", max_marks: 50, published_at: "2026-10-25T08:00:00.000Z" }, { id: examScienceId, school_id: schoolId, section_id: section5aId, subject_id: scienceId, title: "Chapter quiz · Plant systems", starts_at: "2026-10-29T05:00:00.000Z", max_marks: 30, published_at: "2026-10-30T08:00:00.000Z" }]);
await write("marks", [{ id: ids(230, 1)[0], school_id: schoolId, exam_id: examMathId, student_id: studentIds[0], score: 42, feedback: "Strong reasoning", entered_by: teacherProfileIds[1] }, { id: ids(231, 1)[0], school_id: schoolId, exam_id: examScienceId, student_id: studentIds[0], score: 25, feedback: "Excellent observation notes", entered_by: teacherProfileIds[2] }]);
await write("announcements", [{ id: announcementId, school_id: schoolId, author_id: profileByEmail.get("admin@school-connect.demo"), title: "Annual day rehearsal schedule", body: "Class rehearsals begin this week. Please check the calendar for class timings.", audience: "school" }]);
await write("notifications", [{ id: ids(170, 1)[0], school_id: schoolId, user_id: profileByEmail.get("parent1@school-connect.demo"), title: "Route 02 update", body: "Your child's bus is on the north loop.", related_type: "bus_trip", related_id: tripId }]);
await write("school_events", [{ id: eventId, school_id: schoolId, title: "Annual day rehearsal", event_type: "school_event", starts_at: "2026-10-22T04:00:00.000Z", description: "Class rehearsals in the main auditorium." }]);
await write("fee_records", [{ id: feeId, school_id: schoolId, student_id: studentIds[0], label: "Term 2 activities", amount: 1800, due_on: "2026-11-01", status: "due" }]);
await write("pickup_contacts", [{ id: ids(190, 1)[0], school_id: schoolId, student_id: studentIds[0], full_name: "Ananya Mehta", relationship: "Mother", phone: "+91 90000 00001", authorized: true }]);
console.log("Seeded Riverside Public School, 12 students, role accounts, classes, routes, syllabus, attendance, homework and announcements.");
console.log("Demo password for all seeded accounts: SchoolDemo!2026");