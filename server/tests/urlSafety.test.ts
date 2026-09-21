import { describe, it, expect } from "vitest";
import { assertSafeUrl } from "../src/services/retrieval/urlSafety.js";

describe("assertSafeUrl", () => {
  it("rejects an invalid URL string", async () => {
    const result = await assertSafeUrl("not a url");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-http(s) protocol", async () => {
    const result = await assertSafeUrl("ftp://example.com/file");
    expect(result.ok).toBe(false);
  });

  it("rejects a link-local / cloud metadata address", async () => {
    const result = await assertSafeUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.ok).toBe(false);
  });

  it("accepts a normal https URL", async () => {
    const result = await assertSafeUrl("https://example.com/careers");
    expect(result.ok).toBe(true);
  });
});
