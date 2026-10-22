export interface ModelOption {
  value: string;
  label: string;
}

export const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function normalizeOpenAIBaseUrl(input?: string | null): string {
  const value = (input || "").trim() || OPENAI_DEFAULT_BASE_URL;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Enter an HTTP(S) API base URL without credentials, query, or fragment."
    );
  }
  return url.href.replace(/\/+$/, "");
}

export function isCustomOpenAIBaseUrl(input?: string | null): boolean {
  return normalizeOpenAIBaseUrl(input) !== OPENAI_DEFAULT_BASE_URL;
}

export interface ModelLimits {
  contextWindow: number;
  maxOutputTokens: number;
}

export const OPENAI_REASONING_EFFORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
  { value: "minimal", label: "Minimal" },
  { value: "xhigh", label: "Extra High" },
  { value: "none", label: "None" }
] as const;

export type OpenAIReasoningEffort =
  (typeof OPENAI_REASONING_EFFORT_OPTIONS)[number]["value"];

// Active, non-deprecated OpenAI production models
export const OPENAI_DEFAULT_MODELS: ModelOption[] = [
  { value: "gpt-6-astra", label: "GPT-6 Astra (flagship)" },
  { value: "gpt-6.1-sol", label: "GPT-6.1 Sol (reasoning)" },
  { value: "gpt-6.1-luna", label: "GPT-6.1 Luna (fast)" },
  { value: "gpt-6.1-astra", label: "GPT-6.1 Astra" },
  { value: "gpt-6-sol", label: "GPT-6 Sol" },
  { value: "gpt-6-luna", label: "GPT-6 Luna (fast)" },
  { value: "gpt-6", label: "GPT-6" },
  { value: "o3-mini", label: "o3-mini (reasoning)" },
  { value: "o3", label: "o3 (reasoning)" },
  { value: "o4-mini", label: "o4-mini (reasoning)" },
  { value: "o1", label: "o1 (reasoning)" },
  { value: "gpt-4o", label: "GPT-4o (latest)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "chatgpt-4o-latest", label: "ChatGPT-4o Latest" }
];

// Published token limits per model family
export const OPENAI_MODEL_LIMITS: Record<string, ModelLimits> = {
  // GPT-6 & GPT-6.1 Series
  "gpt-6-astra": { contextWindow: 1050000, maxOutputTokens: 128000 },
  "gpt-6.1-astra": { contextWindow: 1050000, maxOutputTokens: 128000 },
  "gpt-6.1-sol": { contextWindow: 1050000, maxOutputTokens: 128000 },
  "gpt-6-sol": { contextWindow: 1050000, maxOutputTokens: 128000 },
  "gpt-6.1-luna": { contextWindow: 500000, maxOutputTokens: 32768 },
  "gpt-6-luna": { contextWindow: 500000, maxOutputTokens: 32768 },
  "gpt-6": { contextWindow: 1050000, maxOutputTokens: 128000 },

  // O-Series Reasoning Models
  o3: { contextWindow: 200000, maxOutputTokens: 100000 },
  "o3-mini": { contextWindow: 200000, maxOutputTokens: 100000 },
  "o4-mini": { contextWindow: 200000, maxOutputTokens: 100000 },
  o1: { contextWindow: 200000, maxOutputTokens: 100000 },

  // Multimodal General-Purpose
  "gpt-4o": { contextWindow: 128000, maxOutputTokens: 16384 },
  "gpt-4o-mini": { contextWindow: 128000, maxOutputTokens: 16384 },
  "chatgpt-4o-latest": { contextWindow: 128000, maxOutputTokens: 16384 }
};

// Recommended completion token ceilings per reasoning level based on OpenAI publications
export const REASONING_EFFORT_TOKEN_LIMITS: Record<string, number> = {
  minimal: 4096,
  low: 16384,
  medium: 32768,
  high: 65536,
  xhigh: 100000,
  max: 128000,
  none: 16384,
  default: 32768
};

export function getOpenAITokenLimit(
  model: string,
  reasoningEffort?: string
): number {
  const m = model.toLowerCase();
  const modelSpec =
    OPENAI_MODEL_LIMITS[m] ||
    (m.startsWith("gpt-6")
      ? m.includes("luna")
        ? OPENAI_MODEL_LIMITS["gpt-6-luna"]
        : OPENAI_MODEL_LIMITS["gpt-6-astra"]
      : m.startsWith("o3")
        ? OPENAI_MODEL_LIMITS["o3"]
        : m.startsWith("o4")
          ? OPENAI_MODEL_LIMITS["o4-mini"]
          : m.startsWith("o1")
            ? OPENAI_MODEL_LIMITS["o1"]
            : m.startsWith("gpt-4o")
              ? OPENAI_MODEL_LIMITS["gpt-4o"]
              : { contextWindow: 128000, maxOutputTokens: 16384 });

  if (isReasoningModel(m)) {
    const effort = (reasoningEffort || "default").toLowerCase();
    const effortLimit =
      REASONING_EFFORT_TOKEN_LIMITS[effort] ||
      REASONING_EFFORT_TOKEN_LIMITS.default;

    return Math.min(effortLimit, modelSpec.maxOutputTokens);
  }

  return modelSpec.maxOutputTokens;
}

export function isReasoningModel(model: string): boolean {
  if (!model) return false;
  const m = model.toLowerCase();
  // Luna is the high-throughput fast execution tier (non-reasoning)
  if (m.includes("luna")) return false;

  return (
    /^o\d/i.test(m) ||
    m.includes("reasoning") ||
    m.includes("codex-max") ||
    m.startsWith("gpt-6") ||
    m.startsWith("gpt-5")
  );
}

export function formatOpenAIModelLabel(id: string): string {
  if (id === "gpt-6-astra") return "GPT-6 Astra (flagship)";
  if (id === "gpt-6.1-sol") return "GPT-6.1 Sol (reasoning)";
  if (id === "gpt-6.1-luna") return "GPT-6.1 Luna (fast)";
  if (id === "gpt-6.1-astra") return "GPT-6.1 Astra";
  if (id === "gpt-6-sol") return "GPT-6 Sol";
  if (id === "gpt-6-luna") return "GPT-6 Luna (fast)";
  if (id === "gpt-6") return "GPT-6";
  if (id === "o3-mini") return "o3-mini (reasoning)";
  if (id === "o3") return "o3 (reasoning)";
  if (id === "o4-mini") return "o4-mini (reasoning)";
  if (id === "o1") return "o1 (reasoning)";
  if (id === "gpt-4o") return "GPT-4o (latest)";
  if (id === "gpt-4o-mini") return "GPT-4o Mini";
  if (id === "chatgpt-4o-latest") return "ChatGPT-4o Latest";

  return id.replace(/^gpt-/i, "GPT-").replace(/^codex-/i, "Codex-");
}

const EXCLUDED_OPENAI_PATTERNS =
  /audio|whisper|tts|dall-e|embedding|moderation|realtime|transcribe|similarity|search|babbage|davinci|curie/i;

// Deprecated models according to OpenAI lifecycle & deprecation schedules
export const DEPRECATED_OPENAI_PATTERNS =
  /o1-preview|o1-mini|gpt-4\.5|gpt-4-turbo|gpt-3\.5|preview-202[0-5]|gpt-4-0314|gpt-4-0613|gpt-4-32k/i;

export function isDeprecatedOpenAIModel(id: string): boolean {
  return DEPRECATED_OPENAI_PATTERNS.test(id);
}

export function filterAndSortOpenAIModels(
  rawModelIds: string[]
): ModelOption[] {
  const filtered = rawModelIds.filter((id) => {
    if (!id || typeof id !== "string") return false;
    if (EXCLUDED_OPENAI_PATTERNS.test(id)) return false;
    if (DEPRECATED_OPENAI_PATTERNS.test(id)) return false;
    return /^(gpt-|o[1-9]|chatgpt-|codex)/i.test(id);
  });

  const unique = Array.from(new Set(filtered));

  const options: ModelOption[] = unique.map((id) => ({
    value: id,
    label: formatOpenAIModelLabel(id)
  }));

  const priorityScore = (id: string): number => {
    const lower = id.toLowerCase();
    if (lower === "gpt-6-astra") return 1;
    if (lower === "gpt-6.1-sol") return 2;
    if (lower === "gpt-6.1-luna") return 3;
    if (lower === "gpt-6.1-astra") return 4;
    if (lower === "gpt-6-sol") return 5;
    if (lower === "gpt-6-luna") return 6;
    if (lower === "gpt-6") return 7;
    if (lower === "o3-mini") return 8;
    if (lower.startsWith("o3-mini")) return 9;
    if (lower === "o3") return 10;
    if (lower.startsWith("o3")) return 11;
    if (lower === "o4-mini") return 12;
    if (lower === "o1") return 13;
    if (lower.startsWith("o1")) return 14;
    if (lower === "gpt-4o") return 15;
    if (lower === "gpt-4o-mini") return 16;
    if (lower.startsWith("chatgpt-4o-latest")) return 17;
    if (lower.startsWith("gpt-6")) return 18;
    if (lower.startsWith("gpt-5")) return 19;
    if (lower.startsWith("codex")) return 20;
    return 100;
  };

  options.sort((a, b) => {
    const scoreA = priorityScore(a.value);
    const scoreB = priorityScore(b.value);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return a.value.localeCompare(b.value);
  });

  return options;
}
