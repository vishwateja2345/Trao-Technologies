import { describe, it, expect } from "vitest";
import { buildWeakSpotsReport } from "../src/services/kitService.js";
import type { KitDoc } from "../src/models/Kit.js";

function fakeKit(overrides: Partial<KitDoc>): KitDoc {
  return {
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    practiceRecords: [],
    role: { title: "", seniority: "", responsibilities: [], requirements: [] },
    questions: [],
    flashcards: [],
    ...overrides,
  } as unknown as KitDoc;
}

describe("buildWeakSpotsReport", () => {
  it("ranks an uncovered must-have requirement as a gap, first", () => {
    const kit = fakeKit({
      coverage: { uncovered_requirement_ids: ["r1"], passes: 2 },
      role: {
        title: "",
        seniority: "",
        responsibilities: [],
        requirements: [
          { id: "r1", text: "Uncovered must", kind: "technical", priority: "must" },
          { id: "r2", text: "Covered must", kind: "technical", priority: "must" },
        ],
      },
      questions: [
        { id: "q1", requirement_ids: ["r2"], category: "technical", prompt: "p", answer_outline: "", difficulty: 2, origin: "generated", pinned: false },
      ],
    });

    const report = buildWeakSpotsReport(kit);
    expect(report[0].requirement_id).toBe("r1");
    expect(report[0].status).toBe("gap");
  });

  it("marks a covered requirement with no practice history as unpracticed", () => {
    const kit = fakeKit({
      role: { title: "", seniority: "", responsibilities: [], requirements: [{ id: "r1", text: "x", kind: "technical", priority: "must" }] },
      flashcards: [{ id: "f1", front: "f", back: "b", requirement_ids: ["r1"], origin: "generated", pinned: false }],
    });
    const report = buildWeakSpotsReport(kit);
    expect(report[0].status).toBe("unpracticed");
  });

  it("marks a requirement with low average confidence as weak, and high confidence as solid", () => {
    const kit = fakeKit({
      role: {
        title: "",
        seniority: "",
        responsibilities: [],
        requirements: [
          { id: "r1", text: "weak one", kind: "technical", priority: "must" },
          { id: "r2", text: "solid one", kind: "technical", priority: "must" },
        ],
      },
      flashcards: [
        { id: "f1", front: "f", back: "b", requirement_ids: ["r1"], origin: "generated", pinned: false },
        { id: "f2", front: "f", back: "b", requirement_ids: ["r2"], origin: "generated", pinned: false },
      ],
      practiceRecords: [
        { flashcard_id: "f1", confidence: 1, reviewed_at: "2024-01-01T00:00:00.000Z" },
        { flashcard_id: "f2", confidence: 5, reviewed_at: "2024-01-01T00:00:00.000Z" },
      ],
    });
    const report = buildWeakSpotsReport(kit);
    const weak = report.find((r) => r.requirement_id === "r1")!;
    const solid = report.find((r) => r.requirement_id === "r2")!;
    expect(weak.status).toBe("weak");
    expect(solid.status).toBe("solid");
  });
});
