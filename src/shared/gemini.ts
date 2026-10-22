export const GEMINI_THINKING_LEVELS = [
  "minimal",
  "low",
  "medium",
  "high"
] as const;

export type GeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number];

export interface GeminiThinkingConfig {
  thinkingLevel?: GeminiThinkingLevel;
  thinkingBudget?: number;
}

// Gemini 2.5 uses thinking budgets; Gemini 3+ uses thinking levels.
const GEMINI_THINKING_BUDGETS: Record<GeminiThinkingLevel, number> = {
  minimal: 0,
  low: 1024,
  medium: 8192,
  high: -1
};

function getGeminiSeries(model: string): "4" | "3" | "2.5" | null {
  const id = (model || "").toLowerCase();
  if (id.startsWith("gemini-4")) {
    return "4";
  }
  if (id.startsWith("gemini-3")) {
    return "3";
  }
  if (id.startsWith("gemini-2.5") || id.startsWith("gemini-2-5")) {
    return "2.5";
  }
  return null;
}

export function getGeminiThinkingLevels(
  model: string | null | undefined
): GeminiThinkingLevel[] {
  const id = (model || "").toLowerCase();
  const series = getGeminiSeries(id);
  if (!series) {
    return [];
  }

  if (series === "2.5" || series === "4") {
    return ["low", "medium", "high"];
  }

  if (series === "3" && id.startsWith("gemini-3-pro-preview")) {
    return ["low", "high"];
  }

  if (series === "3" && id.includes("pro")) {
    return ["low", "medium", "high"];
  }

  return ["minimal", "low", "medium", "high"];
}

export function getGeminiThinkingConfig(
  model: string | null | undefined,
  level: string | null | undefined
): GeminiThinkingConfig | null {
  const normalized = (level || "").toLowerCase();
  if (!normalized || normalized === "default") {
    return null;
  }

  const levels = getGeminiThinkingLevels(model);
  if (!levels.includes(normalized as GeminiThinkingLevel)) {
    return null;
  }

  const series = getGeminiSeries(model || "");
  if (series === "2.5") {
    return {
      thinkingBudget: GEMINI_THINKING_BUDGETS[normalized as GeminiThinkingLevel]
    };
  }

  return { thinkingLevel: normalized as GeminiThinkingLevel };
}
