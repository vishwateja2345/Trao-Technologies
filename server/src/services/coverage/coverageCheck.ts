import type { Question, Requirement } from "../../types/kit.js";

/**
 * Deterministic coverage check (brief Section 3 & 4: this is "your code's
 * decision to make, not the model's"). A requirement is "covered" if at
 * least one question's requirement_ids includes it. We report gaps among
 * MUST-have requirements — a kit shipping with an uncovered must-have has
 * "failed at the one job it had" per the brief, so this is the signal that
 * drives the second pass.
 */
export interface CoverageResult {
  uncoveredMustHaveIds: string[];
  uncoveredNiceToHaveIds: string[];
  coveredIds: Set<string>;
}

export function checkCoverage(requirements: Requirement[], questions: Question[]): CoverageResult {
  const covered = new Set<string>();
  for (const q of questions) {
    for (const rid of q.requirement_ids) covered.add(rid);
  }

  const uncoveredMustHaveIds: string[] = [];
  const uncoveredNiceToHaveIds: string[] = [];
  for (const req of requirements) {
    if (covered.has(req.id)) continue;
    if (req.priority === "must") uncoveredMustHaveIds.push(req.id);
    else uncoveredNiceToHaveIds.push(req.id);
  }

  return { uncoveredMustHaveIds, uncoveredNiceToHaveIds, coveredIds: covered };
}
