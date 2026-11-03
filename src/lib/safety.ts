import type { AttendanceRecord } from "@/lib/demo-data";

// Safety Chain: every transported child passes four checkpoints each day.
// A break between checkpoints raises an alert instead of waiting for a parent to notice.
export type Checkpoint = "pickup" | "gate" | "classroom" | "handover";

export interface Guardian {
  name: string;
  relationship: string;
  phone: string;
}

export interface SafetyRider {
  studentId: string;
  name: string;
  initials: string;
  stop: string;
  boardedAt: string | null;
  arrivedAt: string | null;
  handedOverAt: string | null;
  handedOverTo: string | null;
  guardians: Guardian[];
}

export interface SafetyResolution {
  note: string;
  by: string;
  at: string;
}

export interface SafetyState {
  riders: SafetyRider[];
  sweepConfirmedAt: string | null;
  resolutions: Record<string, SafetyResolution>;
  blockedHandovers: Record<string, string>;
  log: { id: string; at: string; text: string; tone: "ok" | "alert" }[];
}

export type AlertKind = "still-on-bus" | "boarded-not-in-class" | "handover-blocked";

export interface SafetyAlert {
  id: string;
  kind: AlertKind;
  studentId: string;
  name: string;
  title: string;
  detail: string;
  severity: "critical" | "warning";
}

export type CheckpointState = "done" | "pending" | "broken";

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function classStatus(attendance: AttendanceRecord[], studentId: string) {
  return attendance.find((row) => row.id === studentId)?.status;
}

export function checkpointStates(rider: SafetyRider, attendance: AttendanceRecord[]): Record<Checkpoint, CheckpointState> {
  const status = classStatus(attendance, rider.studentId);
  const inClass = status === "Present" || status === "Late";
  return {
    pickup: rider.boardedAt ? "done" : "pending",
    gate: rider.arrivedAt ? "done" : rider.boardedAt ? "broken" : "pending",
    classroom: inClass ? "done" : rider.arrivedAt && status === "Absent" ? "broken" : "pending",
    handover: rider.handedOverAt ? "done" : "pending",
  };
}

export function safetyAlerts(state: SafetyState, attendance: AttendanceRecord[]): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  for (const rider of state.riders) {
    if (state.resolutions[rider.studentId]) continue;
    const blockedAt = state.blockedHandovers[rider.studentId];
    if (blockedAt && !rider.handedOverAt) {
      alerts.push({ id: `${rider.studentId}-handover`, kind: "handover-blocked", studentId: rider.studentId, name: rider.name, severity: "warning", title: `Handover of ${rider.name} was blocked`, detail: `A wrong handover code was entered at ${time(blockedAt)}. The child stays with the attendant until a guardian confirms.` });
    }
    if (rider.boardedAt && !rider.arrivedAt) {
      alerts.push({ id: `${rider.studentId}-bus`, kind: "still-on-bus", studentId: rider.studentId, name: rider.name, severity: "critical", title: `${rider.name} was never scanned off the bus`, detail: `Boarded at ${rider.stop} · ${time(rider.boardedAt)}. No gate scan yet. Check the bus before it is parked.` });
    } else if (rider.arrivedAt && classStatus(attendance, rider.studentId) === "Absent") {
      alerts.push({ id: `${rider.studentId}-class`, kind: "boarded-not-in-class", studentId: rider.studentId, name: rider.name, severity: "critical", title: `${rider.name} reached school but is marked absent`, detail: `Got off at the school gate at ${time(rider.arrivedAt)}, but the class register says Absent. Locate the child now.` });
    }
  }
  return alerts;
}

export function onBoard(state: SafetyState) {
  return state.riders.filter((rider) => rider.boardedAt && !rider.arrivedAt);
}

// A four-digit code that changes daily per child. Parents share it only with whoever collects the child.
export function handoverCode(studentId: string, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  let hash = 2166136261;
  for (const char of `${studentId}:${day}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return String((hash >>> 0) % 10000).padStart(4, "0");
}

export function verifyHandover(studentId: string, code: string, date = new Date()) {
  return code.trim() === handoverCode(studentId, date);
}
