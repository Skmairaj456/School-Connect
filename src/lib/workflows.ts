import type { AttendanceRecord, Topic } from "./demo-data";

export function toggleAttendance(records: AttendanceRecord[], id: string): AttendanceRecord[] {
  return records.map((record) => record.id === id
    ? { ...record, status: record.status === "Present" ? "Absent" : "Present" }
    : record);
}

export function nextTopicStatus(status: Topic["status"]): Topic["status"] {
  if (status === "Not Started") return "In Progress";
  if (status === "In Progress") return "Completed";
  return "Not Started";
}

export function completionPercent(topics: Topic[]): number {
  if (topics.length === 0) return 0;
  return Math.round(topics.filter((topic) => topic.status === "Completed").length / topics.length * 100);
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
}