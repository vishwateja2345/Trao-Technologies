import { describe, it, expect } from "vitest";
import { validateKit } from "../src/services/validation/kitSchema.js";
import type { Kit } from "../src/types/kit.js";

function validKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.example.com",
      role: "Backend Engineer",
      location: "",
      jd_chars: 500,
      researched_at: new Date().toISOString(),
      pages_used: ["https://acme.example.com"],
    },
    company_brief: { summary: "Acme makes widgets.", what_they_do: "Widgets", sources: ["https://acme.example.com"] },
    role: {
      title: "Backend Engineer",
      seniority: "senior",
      responsibilities: ["Build APIs"],
      requirements: [{ id: "r1", text: "5+ years with Node.js", kind: "technical", priority: "must" }],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Explain event loop internals.",
        answer_outline: "Cover phases, microtasks.",
        difficulty: 2,
        origin: "generated",
        pinned: false,
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "Node.js event loop?",
        back: "Single-threaded, non-blocking I/O.",
        requirement_ids: ["r1"],
        origin: "generated",
        pinned: false,
      },
    ],
    schedule: { days_available: 1, days: [{ day: 1, focus: "Technical", question_ids: ["q1"], minutes: 30 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe("validateKit", () => {
  it("accepts a well-formed kit matching Appendix A", () => {
    const result = validateKit(validKit());
    expect(result.success).toBe(true);
  });

  it("rejects a kit whose difficulty is not 1, 2, or 3", () => {
    const kit = validKit();
    (kit.questions[0] as any).difficulty = 5;
    const result = validateKit(kit);
    expect(result.success).toBe(false);
  });

  it("rejects a kit with non-integer schedule minutes", () => {
    const kit = validKit();
    (kit.schedule.days[0] as any).minutes = 45.5;
    const result = validateKit(kit);
    expect(result.success).toBe(false);
  });

  it("rejects a question referencing a requirement id that doesn't exist", () => {
    const kit = validKit();
    kit.questions[0].requirement_ids = ["r999"];
    const result = validateKit(kit);
    expect(result.success).toBe(false);
  });

  it("rejects a schedule day referencing a question id that doesn't exist", () => {
    const kit = validKit();
    kit.schedule.days[0].question_ids = ["q999"];
    const result = validateKit(kit);
    expect(result.success).toBe(false);
  });

  it("rejects a schedule whose day count does not match days_available", () => {
    const kit = validKit();
    kit.schedule.days_available = 3;
    const result = validateKit(kit);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid requirement priority", () => {
    const kit = validKit();
    (kit.role.requirements[0] as any).priority = "should";
    const result = validateKit(kit);
    expect(result.success).toBe(false);
  });
});
