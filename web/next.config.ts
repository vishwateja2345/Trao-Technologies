import type { NextConfig } from "next";

// Proxying /api/* to the Express backend keeps the browser's view of the
// app single-origin: the httpOnly session cookie set by the API is then a
// normal same-site cookie from the browser's perspective, with no CORS or
// SameSite=None/Secure cross-site cookie complexity in either dev or prod.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  agentRules: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
