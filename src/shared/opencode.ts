export const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";

export const OPENCODE_PROVIDER = "opencode";
export const OPENCODE_V2_PROVIDER = "opencode-v2";

export type OpenCodeApiVersion = "v1" | "v2";

export interface OpenCodePairLink {
  baseUrl: string;
  code: string;
}

export function normalizeOpenCodeUrl(url: string | null | undefined): string {
  const raw = (url || "").trim();
  if (!raw) {
    return OPENCODE_DEFAULT_URL;
  }

  return raw.replace(/\/$/, "");
}

export function parseOpenCodePairLink(
  url: string | null | undefined
): OpenCodePairLink | null {
  const raw = (url || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const match = parsed.pathname.match(/^\/auth\/connect\/([^/]+)\/?$/);
    if (!match) {
      return null;
    }

    return {
      baseUrl: parsed.origin,
      code: decodeURIComponent(match[1])
    };
  } catch {
    return null;
  }
}

export function getOpenCodeApiVersion(
  provider: string
): OpenCodeApiVersion | null {
  if (provider === OPENCODE_V2_PROVIDER) {
    return "v2";
  }
  if (provider === OPENCODE_PROVIDER) {
    return "v1";
  }
  return null;
}

export function isOpenCodeProvider(provider: string): boolean {
  return getOpenCodeApiVersion(provider) !== null;
}
