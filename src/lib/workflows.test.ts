import { describe, expect, it } from "vitest";
import { demoSeed } from "./demo-data";
import { completionPercent, nextTopicStatus, toCsv, toggleAttendance } from "./workflows";

describe("School Connect demo workflows", () => {
  it("toggles one attendance record without changing other students", () => {
    const updated = toggleAttendance(demoSeed.attendance, "st-01");
    expect(updated.find((row) => row.id === "st-01")?.status).toBe("Absent");
    expect(updated.find((row) => row.id === "st-02")?.status).toBe("Present");
    expect(demoSeed.attendance[0].status).toBe("Present");
  });

  it("cycles syllabus status and derives completion from topic records", () => {
    expect(nextTopicStatus("Not Started")).toBe("In Progress");
    expect(nextTopicStatus("In Progress")).toBe("Completed");
    expect(completionPercent(demoSeed.topics)).toBe(29);
    expect(completionPercent([])).toBe(0);
  });

  it("quotes CSV fields and escapes embedded quotes", () => {
    expect(toCsv([["Student", "Name"], ["Aarav", "Mehta, \"A\""]])).toBe('"Student","Name"\n"Aarav","Mehta, ""A"""');
  });
});