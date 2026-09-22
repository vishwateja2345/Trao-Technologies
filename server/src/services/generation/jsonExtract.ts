/**
 * Extracts a JSON object from raw model text. Free-tier instruct models
 * frequently wrap JSON in markdown fences or add a stray sentence
 * before/after — we strip fences and take the outermost balanced {...}
 * rather than failing on the first non-JSON character.
 */
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object found in model output");
  }
  const candidate = text.slice(start, end + 1);
  return JSON.parse(candidate);
}
