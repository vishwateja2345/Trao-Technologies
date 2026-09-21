import dns from "node:dns/promises";
import net from "node:net";
import { env } from "../../config/env.js";

/**
 * SSRF guard. Every URL the retrieval layer touches — the company site,
 * links discovered while crawling it, and anything a search step turns up —
 * passes through here first. We resolve the hostname and check the actual
 * IP, not just the string, because "https://trusted.example" can still
 * resolve to 127.0.0.1 or a link-local cloud metadata address.
 */

const LOOPBACK_RANGES: Array<[string, number]> = [["127.0.0.0", 8]];

const OTHER_PRIVATE_RANGES: Array<[string, number]> = [
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["169.254.0.0", 16], // link-local incl. cloud metadata endpoint — never bypassable
  ["0.0.0.0", 8],
];

function ipToLong(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function matchesRange(ip: string, ranges: Array<[string, number]>): boolean {
  if (!net.isIPv4(ip)) return false;
  const target = ipToLong(ip);
  return ranges.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (ipToLong(base) & mask);
  });
}

function isLoopbackIPv6(ip: string): boolean {
  return ip.toLowerCase() === "::1";
}

function isOtherPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

export interface UrlCheckResult {
  ok: boolean;
  reason?: string;
  normalizedUrl?: string;
}

export async function assertSafeUrl(rawUrl: string): Promise<UrlCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, reason: "unsupported_protocol" };
  }

  const hostname = parsed.hostname;
  const allowLoopback = env.ALLOW_PRIVATE_HOSTS;

  if (hostname === "localhost") {
    if (allowLoopback) return { ok: true, normalizedUrl: parsed.toString() };
    return { ok: false, reason: "loopback_blocked" };
  }

  let addresses: string[] = [];
  try {
    if (net.isIP(hostname)) {
      addresses = [hostname];
    } else {
      const records = await dns.lookup(hostname, { all: true });
      addresses = records.map((r) => r.address);
    }
  } catch {
    return { ok: false, reason: "dns_lookup_failed" };
  }

  for (const addr of addresses) {
    const isLoopback = matchesRange(addr, LOOPBACK_RANGES) || isLoopbackIPv6(addr);
    if (isLoopback) {
      if (allowLoopback) continue;
      return { ok: false, reason: "loopback_blocked" };
    }
    // Non-loopback private ranges (RFC1918, link-local/cloud metadata) are
    // ALWAYS blocked — ALLOW_PRIVATE_HOSTS only exists so the batch entry
    // point can reach a local fixture server on localhost/127.0.0.1, never
    // to open up the rest of a private network.
    if (matchesRange(addr, OTHER_PRIVATE_RANGES) || isOtherPrivateIPv6(addr)) {
      return { ok: false, reason: "private_address_blocked" };
    }
  }

  return { ok: true, normalizedUrl: parsed.toString() };
}
