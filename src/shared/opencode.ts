export const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";
export const OPENCODE_V2_DEFAULT_URL = "http://127.0.0.1:49374";
export const OPENCODE_V2_PAIR_PLACEHOLDER =
  "http://127.0.0.1:49374/auth/connect/...";

export const OPENCODE_PROVIDER = "opencode";
export const OPENCODE_V2_PROVIDER = "opencode-v2";

export type OpenCodeApiVersion = "v1" | "v2";

export interface OpenCodePairLink {
  baseUrl: string;
  code: string;
}

export function getOpenCodeDefaultUrl(
  versionOrProvider?: string | null
): string {
  if (
    versionOrProvider === "v2" ||
    versionOrProvider === OPENCODE_V2_PROVIDER
  ) {
    return OPENCODE_V2_DEFAULT_URL;
  }
  return OPENCODE_DEFAULT_URL;
}

export function parseOpenCodePairLink(
  input: string | null | undefined
): OpenCodePairLink | null {
  const raw = (input || "").trim();
  if (!raw) {
    return null;
  }

  // Matches either exact URL or pair link embedded in terminal output / text
  const match = raw.match(
    /(https?:\/\/[^\s"'<>\\]+?)\/auth\/connect\/([A-Za-z0-9_-]+)/
  );
  if (!match) {
    return null;
  }

  try {
    const origin = new URL(match[1]).origin;
    return {
      baseUrl: origin,
      code: decodeURIComponent(match[2])
    };
  } catch {
    return null;
  }
}

export function normalizeOpenCodeUrl(
  url: string | null | undefined,
  versionOrProvider?: string | null
): string {
  const raw = (url || "").trim();
  if (!raw) {
    return getOpenCodeDefaultUrl(versionOrProvider);
  }

  const pairLink = parseOpenCodePairLink(raw);
  if (pairLink) {
    return pairLink.baseUrl;
  }

  return raw.replace(/\/$/, "");
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
