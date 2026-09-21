import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { crawlCompanySite } from "../src/services/retrieval/crawler.js";

const HOMEPAGE_HTML = `<!doctype html><html><head><title>Acme Corp</title></head><body>
  <nav>
    <a href="/about">About</a>
    <a href="/careers">Careers</a>
    <a href="/blog/2021/01/01/unrelated-post">Blog</a>
    <a href="https://twitter.com/acme">Twitter</a>
  </nav>
  <p>Acme builds widgets for everyone.</p>
</body></html>`;

const CAREERS_HTML = `<!doctype html><html><head><title>Careers at Acme</title></head><body>
  <h1>Join us</h1>
  <p>Our interview process: a 30-minute screen, a take-home project, then a system design round.</p>
</body></html>`;

const ABOUT_HTML = `<!doctype html><html><head><title>About Acme</title></head><body>
  <p>Acme was founded in 2010 to make the best widgets on Earth.</p>
</body></html>`;

describe("crawlCompanySite", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.setHeader("content-type", "text/html");
      if (req.url === "/") res.end(HOMEPAGE_HTML);
      else if (req.url === "/careers") res.end(CAREERS_HTML);
      else if (req.url === "/about") res.end(ABOUT_HTML);
      else if (req.url?.startsWith("/blog")) res.end("<html><body>Unrelated blog post</body></html>");
      else if (req.url === "/robots.txt") {
        res.setHeader("content-type", "text/plain");
        res.end("User-agent: *\nAllow: /\n");
      } else {
        res.statusCode = 404;
        res.end("not found");
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}/`;
  });

  afterAll(() => {
    server.close();
  });

  it("finds the careers/hiring page without any hard-coded path list", async () => {
    const result = await crawlCompanySite(baseUrl);
    expect(result.hiringPageFound).toBe(true);
    expect(result.hiringUrls.some((u) => u.includes("/careers"))).toBe(true);
  });

  it("does not follow an unrelated external domain (twitter.com)", async () => {
    const result = await crawlCompanySite(baseUrl);
    expect(result.pages.some((p) => p.url.includes("twitter.com"))).toBe(false);
  });

  it("skips an unreachable homepage without throwing", async () => {
    const result = await crawlCompanySite("http://127.0.0.1:1/"); // nothing listens here
    expect(result.pages).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});
