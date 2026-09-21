import { describe, it, expect } from "vitest";
import { checkCoverage } from "../src/services/coverage/coverageCheck.js";
import type { Question, Requirement } from "../src/types/kit.js";

function req(id: string, priority: "must" | "nice"): Requirement {
  return { id, text: `requirement ${id}`, kind: "technical", priority };
}

function q(id: string, requirement_ids: string[]): Question {
  return {
    id,
    requirement_ids,
    category: "technical",
    prompt: "p",
    answer_outline: "a",
    difficulty: 2,
    origin: "generated",
    pinned: false,
  };
}

describe("checkCoverage", () => {
  it("reports no gaps when every must-have requirement has a question", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    const result = checkCoverage(requirements, questions);
    expect(result.uncoveredMustHaveIds).toEqual([]);
  });

  it("flags a must-have requirement with zero linked questions", () => {
    const requirements = [req("r1", "must"), req("r2", "must")];
    const questions = [q("q1", ["r1"])];
    const result = checkCoverage(requirements, questions);
    expect(result.uncoveredMustHaveIds).toEqual(["r2"]);
  });

  it("does not flag an uncovered nice-to-have as a coverage gap", () => {
    const requirements = [req("r1", "must"), req("r2", "nice")];
    const questions = [q("q1", ["r1"])];
    const result = checkCoverage(requirements, questions);
    expect(result.uncoveredMustHaveIds).toEqual([]);
    expect(result.uncoveredNiceToHaveIds).toEqual(["r2"]);
  });

  it("counts a requirement covered by any one of several questions referencing it", () => {
    const requirements = [req("r1", "must")];
    const questions = [q("q1", ["r1", "r2"]), q("q2", [])];
    const result = checkCoverage(requirements, questions);
    expect(result.uncoveredMustHaveIds).toEqual([]);
    expect(result.coveredIds.has("r1")).toBe(true);
  });
});
