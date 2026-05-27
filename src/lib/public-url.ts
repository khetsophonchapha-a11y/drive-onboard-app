import type { NextRequest } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeOrigin(candidate?: string | null): string | undefined {
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate);
    if (LOCAL_HOSTS.has(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function buildOrigin(proto: string | null | undefined, host: string | null | undefined) {
  if (!host) return undefined;
  return normalizeOrigin(`${proto || "https"}://${host}`);
}

export function resolvePublicOrigin(req?: NextRequest): string | undefined {
  const envCandidates = [
    process.env.PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.WORKER_URL,
  ];

  for (const candidate of envCandidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }

  if (!req) return undefined;

  const forwardedOrigin = normalizeOrigin(req.headers.get("x-forwarded-origin"));
  if (forwardedOrigin) return forwardedOrigin;

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedHostOrigin = buildOrigin(forwardedProto, forwardedHost);
  if (forwardedHostOrigin) return forwardedHostOrigin;

  const hostOrigin = buildOrigin(forwardedProto, req.headers.get("host"));
  if (hostOrigin) return hostOrigin;

  return normalizeOrigin(req.url) || normalizeOrigin(req.nextUrl.origin);
}

