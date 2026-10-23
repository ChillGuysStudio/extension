import { describe, expect, test } from "bun:test";
import {
  getGeminiThinkingConfig,
  getGeminiThinkingLevels
} from "../src/shared/gemini";
import { buildRequestBody } from "../src/content/requests";

describe("Gemini thinking levels", () => {
  test("uses thinking levels for Gemini 3 models", () => {
    expect(getGeminiThinkingLevels("gemini-3-flash-preview")).toEqual([
      "minimal",
      "low",
      "medium",
      "high"
    ]);
    expect(getGeminiThinkingLevels("gemini-3.1-pro-preview")).toEqual([
      "low",
      "medium",
      "high"
    ]);
    expect(getGeminiThinkingLevels("gemini-3-pro-preview")).toEqual([
      "low",
      "high"
    ]);
    expect(getGeminiThinkingLevels("gemini-4-argon")).toEqual([
      "low",
      "medium",
      "high"
    ]);
    expect(getGeminiThinkingConfig("gemini-3-flash-preview", "low")).toEqual({
      thinkingLevel: "low"
    });
  });

  test("uses thinking budgets for Gemini 2.5 models", () => {
    expect(getGeminiThinkingLevels("gemini-2.5-flash")).toEqual([
      "low",
      "medium",
      "high"
    ]);
    expect(getGeminiThinkingConfig("gemini-2.5-flash", "low")).toEqual({
      thinkingBudget: 1024
    });
    expect(getGeminiThinkingConfig("gemini-2.5-flash", "medium")).toEqual({
      thinkingBudget: 8192
    });
    expect(getGeminiThinkingConfig("gemini-2.5-flash", "high")).toEqual({
      thinkingBudget: -1
    });
  });

  test("ignores unsupported levels and non-Gemini models", () => {
    expect(getGeminiThinkingConfig("gemini-3.1-pro-preview", "minimal")).toBe(
      null
    );
    expect(getGeminiThinkingConfig("gemini-3.1-pro-preview", "default")).toBe(
      null
    );
    expect(getGeminiThinkingConfig("claude-sonnet-4-6", "high")).toBe(null);
  });

  test("adds thinkingConfig to Gemini requests only when selected", () => {
    const defaultBody = buildRequestBody(
      "aistudio",
      "gemini-3-flash-preview",
      [],
      true,
      "Question",
      null,
      null
    );
    const defaultConfig = defaultBody.generationConfig as Record<
      string,
      unknown
    >;
    expect(defaultConfig.maxOutputTokens).toBe(2048);
    expect(defaultConfig.thinkingConfig).toBeUndefined();

    const thinkingBody = buildRequestBody(
      "aistudio",
      "gemini-3-flash-preview",
      [],
      true,
      "Question",
      null,
      null,
      undefined,
      undefined,
      "medium"
    );
    const thinkingConfig = thinkingBody.generationConfig as Record<
      string,
      unknown
    >;
    expect(thinkingConfig.thinkingConfig).toEqual({ thinkingLevel: "medium" });
    expect(thinkingConfig.maxOutputTokens).toBe(8192);
  });

  test("does not reuse the OpenAI reasoning effort for Gemini", () => {
    const body = buildRequestBody(
      "vertex",
      "gemini-2.5-flash",
      [],
      true,
      "Question",
      null,
      null,
      "low"
    );
    const generationConfig = body.generationConfig as Record<string, unknown>;
    expect(generationConfig.thinkingConfig).toBeUndefined();
  });
});
