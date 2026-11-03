import { describe, expect, it } from "vitest";
import { demoSeed } from "./demo-data";
import { checkpointStates, handoverCode, onBoard, safetyAlerts, verifyHandover } from "./safety";
import { toggleAttendance } from "./workflows";

describe("Safety Chain", () => {
  it("flags a child still on the bus and a child who reached school but is marked absent", () => {
    const alerts = safetyAlerts(demoSeed.safety, demoSeed.attendance);
    expect(alerts.map((alert) => alert.id).sort()).toEqual(["st-04-class", "st-06-bus"]);
    expect(onBoard(demoSeed.safety).map((rider) => rider.studentId)).toEqual(["st-06"]);
  });

  it("clears the classroom alert once the register is corrected", () => {
    const attendance = toggleAttendance(demoSeed.attendance, "st-04");
    expect(safetyAlerts(demoSeed.safety, attendance).map((alert) => alert.id)).toEqual(["st-06-bus"]);
  });

  it("suppresses alerts that staff have resolved", () => {
    const state = { ...demoSeed.safety, resolutions: { "st-04": { note: "In the sick room", by: "Administrator", at: new Date().toISOString() } } };
    expect(safetyAlerts(state, demoSeed.attendance).map((alert) => alert.id)).toEqual(["st-06-bus"]);
  });

  it("marks the broken checkpoint for each child", () => {
    const [meera, , kabir, , ishaan] = demoSeed.safety.riders;
    expect(checkpointStates(meera, demoSeed.attendance)).toEqual({ pickup: "done", gate: "done", classroom: "done", handover: "pending" });
    expect(checkpointStates(kabir, demoSeed.attendance).classroom).toBe("broken");
    expect(checkpointStates(ishaan, demoSeed.attendance).gate).toBe("broken");
  });

  it("raises a warning after a wrong handover code", () => {
    const state = { ...demoSeed.safety, blockedHandovers: { "st-01": new Date().toISOString() } };
    expect(safetyAlerts(state, demoSeed.attendance).find((alert) => alert.studentId === "st-01")?.kind).toBe("handover-blocked");
  });

  it("issues a stable four-digit daily handover code per child", () => {
    const day = new Date("2026-11-03T10:00:00Z");
    const code = handoverCode("st-01", day);
    expect(code).toMatch(/^\d{4}$/);
    expect(handoverCode("st-01", day)).toBe(code);
    expect(handoverCode("st-01", new Date("2026-11-04T10:00:00Z"))).not.toBe(code);
    expect(verifyHandover("st-01", ` ${code} `, day)).toBe(true);
    expect(verifyHandover("st-01", code === "0000" ? "0001" : "0000", day)).toBe(false);
  });
});
