export const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";

export const OPENCODE_PROVIDER = "opencode";
export const OPENCODE_V2_PROVIDER = "opencode-v2";

export type OpenCodeApiVersion = "v1" | "v2";

export function normalizeOpenCodeUrl(url: string | null | undefined): string {
  const raw = (url || "").trim();
  if (!raw) {
    return OPENCODE_DEFAULT_URL;
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
