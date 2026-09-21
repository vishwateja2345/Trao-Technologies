import http from "node:http";

/**
 * Minimal fixture server used to exercise the crawler + batch entry point
 * locally without hitting real company websites. Mirrors the shape used in
 * Appendix B's example ("http://localhost:8099/acme/"): each "company" is a
 * small set of pages under its own path, with hiring pages buried at
 * different, non-obvious paths on purpose.
 */

const page = (title, body) => `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;

const sites = {
  "/acme/": page(
    "Acme Robotics",
    `<nav>
      <a href="/acme/about">About</a>
      <a href="/acme/join-the-team">Join the team</a>
      <a href="/acme/blog/2020/widgets">Blog</a>
    </nav>
    <p>Acme Robotics builds warehouse automation robots used by retailers worldwide.</p>`
  ),
  "/acme/about": page("About Acme Robotics", "<p>Founded in 2015. 200 employees across 3 countries.</p>"),
  "/acme/join-the-team": page(
    "Careers - Acme Robotics",
    `<h1>Join the team</h1>
     <p>Our interview process: a 30 minute recruiter screen, a take-home coding exercise,
     then an onsite with a system design round and a behavioural round.</p>`
  ),
  "/acme/blog/2020/widgets": page("Engineering Blog", "<p>How we built our widget scanner.</p>"),

  // Globex intentionally has no hiring/about page anywhere — this is the
  // "company site has no discoverable hiring page" edge case from Section 10.
  "/globex/": page(
    "Globex Inc",
    `<nav><a href="/globex/products">Products</a><a href="/globex/contact">Contact</a></nav>
     <p>Globex sells industrial fasteners.</p>`
  ),
  "/globex/products": page("Products", "<p>Bolts, nuts, and washers.</p>"),
  "/globex/contact": page("Contact", "<p>Email us at hello@globex.example.</p>"),
};

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (sites[url]) {
    res.setHeader("content-type", "text/html");
    res.end(sites[url]);
    return;
  }
  if (url.endsWith("/robots.txt")) {
    res.setHeader("content-type", "text/plain");
    res.end("User-agent: *\nAllow: /\n");
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

const port = Number(process.env.FIXTURE_PORT ?? 8099);
server.listen(port, () => {
  console.log(`Fixture company sites server listening on http://localhost:${port}`);
  console.log(`  http://localhost:${port}/acme/    (has a hiring page)`);
  console.log(`  http://localhost:${port}/globex/  (no hiring page anywhere)`);
});
