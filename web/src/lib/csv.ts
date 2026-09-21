/** Minimal RFC4180-ish CSV parser: handles quoted fields containing commas/newlines/escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

export interface BatchCaseInput {
  jd: string;
  company_url: string;
  days: number;
}

/** Accepts either a JSON array of {jd, company_url, days} or a CSV with those headers. */
export function parseBatchFile(filename: string, text: string): BatchCaseInput[] {
  if (filename.endsWith(".json") || text.trim().startsWith("[")) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Expected a JSON array of cases.");
    return data.map((c, i) => normalizeCase(c, i));
  }

  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV must have a header row plus at least one case.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const jdIdx = header.indexOf("jd");
  const urlIdx = header.indexOf("company_url");
  const daysIdx = header.indexOf("days");
  if (jdIdx === -1 || urlIdx === -1 || daysIdx === -1) {
    throw new Error('CSV header must include "jd", "company_url", and "days" columns.');
  }
  return rows.slice(1).map((cells, i) =>
    normalizeCase({ jd: cells[jdIdx], company_url: cells[urlIdx], days: cells[daysIdx] }, i)
  );
}

function normalizeCase(raw: unknown, index: number): BatchCaseInput {
  const c = raw as Record<string, unknown>;
  const jd = String(c?.jd ?? "").trim();
  const company_url = String(c?.company_url ?? "").trim();
  const days = Number(c?.days ?? 5);
  if (!jd) throw new Error(`Case ${index + 1}: "jd" is required.`);
  if (!company_url) throw new Error(`Case ${index + 1}: "company_url" is required.`);
  if (!Number.isFinite(days) || days < 1) throw new Error(`Case ${index + 1}: "days" must be a positive number.`);
  return { jd, company_url, days: Math.min(120, Math.round(days)) };
}
