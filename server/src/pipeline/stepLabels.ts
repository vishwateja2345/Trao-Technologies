/**
 * Human-friendly labels for pipeline step names, used when surfacing
 * warnings to end users. Internal step identifiers like
 * "search_interview_discussion" are meaningful to developers reading logs
 * but should never appear verbatim in front-of-user copy.
 */
export const STEP_FRIENDLY_LABELS: Record<string, string> = {
  extract_requirements: "Reading the job description",
  crawl_company_site: "Researching the company website",
  search_interview_discussion: "Searching for public interview discussion",
  generate_company_brief: "Writing the company brief",
  generate_questions_technical: "Generating technical questions",
  generate_questions_behavioural: "Generating behavioural questions",
  "generate_questions_system-design": "Generating system design questions",
  "generate_questions_company-fit": "Generating company-fit questions",
  coverage_gap_fill: "Filling coverage gaps",
  generate_flashcards: "Building flashcards",
  build_schedule: "Building the study schedule",
};

export function friendlyStepLabel(step: string): string {
  return STEP_FRIENDLY_LABELS[step] ?? step;
}
