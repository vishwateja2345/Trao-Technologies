import { describe, it, expect } from "vitest";
import { buildSchedule } from "../src/services/scheduling/scheduleBuilder.js";
import type { Question, Requirement } from "../src/types/kit.js";

function req(id: string, priority: "must" | "nice"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(id: string, requirement_ids: string[], difficulty: 1 | 2 | 3): Question {
  return {
    id,
    requirement_ids,
    category: "technical",
    prompt: "p",
    answer_outline: "a",
    difficulty,
    origin: "generated",
    pinned: false,
  };
}

describe("buildSchedule", () => {
  it("produces exactly the number of days requested", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1"], 2)];
    for (const days of [1, 3, 7, 14]) {
      const schedule = buildSchedule(requirements, questions, days);
      expect(schedule.days).toHaveLength(days);
      expect(schedule.days_available).toBe(days);
    }
  });

  it("places every must-have requirement's question somewhere in the schedule", () => {
    const requirements = [req("r1", "must"), req("r2", "must"), req("r3", "nice")];
    const questions = [q("q1", ["r1"], 3), q("q2", ["r2"], 1), q("q3", ["r3"], 2)];
    const schedule = buildSchedule(requirements, questions, 3);

    const scheduledQuestionIds = new Set(schedule.days.flatMap((d) => d.question_ids));
    expect(scheduledQuestionIds.has("q1")).toBe(true);
    expect(scheduledQuestionIds.has("q2")).toBe(true);
  });

  it("uses only integer minutes", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1"], 3), q("q2", ["r1"], 2), q("q3", [], 1)];
    const schedule = buildSchedule(requirements, questions, 2);
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
    }
  });

  it("front-loads harder, must-have-covering questions onto earlier days", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("hard", ["r1"], 3), q("easy", [], 1)];
    const schedule = buildSchedule(requirements, questions, 2);
    const hardDay = schedule.days.find((d) => d.question_ids.includes("hard"))!.day;
    const easyDay = schedule.days.find((d) => d.question_ids.includes("easy"))!.day;
    expect(hardDay).toBeLessThanOrEqual(easyDay);
  });

  it("packs everything into a single day when only one day is requested", () => {
    const requirements = [req("r1", "must"), req("r2", "must")];
    const questions = [q("q1", ["r1"], 3), q("q2", ["r2"], 3), q("q3", [], 2)];
    const schedule = buildSchedule(requirements, questions, 1);
    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].question_ids.sort()).toEqual(["q1", "q2", "q3"]);
  });

  it("fills every day with something even when far more days are requested than there is material (60-day case)", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1"], 2)];
    const schedule = buildSchedule(requirements, questions, 60);
    expect(schedule.days).toHaveLength(60);
    for (const day of schedule.days) {
      expect(day.question_ids.length).toBeGreaterThan(0);
      expect(day.minutes).toBeGreaterThan(0);
    }
  });

  it("every schedule question id refers to a real question", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1"], 2), q("q2", [], 1)];
    const schedule = buildSchedule(requirements, questions, 5);
    const validIds = new Set(questions.map((qq) => qq.id));
    for (const day of schedule.days) {
      for (const id of day.question_ids) expect(validIds.has(id)).toBe(true);
    }
  });
});
