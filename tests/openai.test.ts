import { describe, expect, test } from "bun:test";
import {
  isReasoningModel,
  isDeprecatedOpenAIModel,
  filterAndSortOpenAIModels,
  formatOpenAIModelLabel,
  getOpenAITokenLimit,
  OPENAI_DEFAULT_MODELS,
  OPENAI_MODEL_LIMITS,
  OPENAI_REASONING_EFFORT_OPTIONS,
  REASONING_EFFORT_TOKEN_LIMITS
} from "../src/shared/openai";
import { buildRequestBody } from "../src/content/requests";
import { getOpenAIModels } from "../src/background/providers";

describe("OpenAI shared utilities and deprecation pruning", () => {
  test("isReasoningModel detects reasoning models accurately", () => {
    // GPT-6 & GPT-6.1 reasoning models
    expect(isReasoningModel("gpt-6-astra")).toBe(true);
    expect(isReasoningModel("gpt-6.1-sol")).toBe(true);
    expect(isReasoningModel("gpt-6.1-astra")).toBe(true);
    expect(isReasoningModel("gpt-6-sol")).toBe(true);
    expect(isReasoningModel("gpt-6")).toBe(true);

    // GPT-6 Luna is fast non-reasoning tier
    expect(isReasoningModel("gpt-6.1-luna")).toBe(false);
    expect(isReasoningModel("gpt-6-luna")).toBe(false);

    // O-Series reasoning models
    expect(isReasoningModel("o3-mini")).toBe(true);
    expect(isReasoningModel("o3")).toBe(true);
    expect(isReasoningModel("o1")).toBe(true);
    expect(isReasoningModel("o4-mini")).toBe(true);
    expect(isReasoningModel("gpt-5.2")).toBe(true);
    expect(isReasoningModel("gpt-5.1-codex-max")).toBe(true);
    expect(isReasoningModel("model-with-reasoning")).toBe(true);

    // Non-reasoning standard models
    expect(isReasoningModel("gpt-4o")).toBe(false);
    expect(isReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isReasoningModel("claude-sonnet-4-6")).toBe(false);
    expect(isReasoningModel("")).toBe(false);
  });

  test("isDeprecatedOpenAIModel identifies retired and deprecated models", () => {
    expect(isDeprecatedOpenAIModel("o1-mini")).toBe(true);
    expect(isDeprecatedOpenAIModel("o1-preview")).toBe(true);
    expect(isDeprecatedOpenAIModel("gpt-4-turbo")).toBe(true);
    expect(isDeprecatedOpenAIModel("gpt-4-turbo-2024-04-09")).toBe(true);
    expect(isDeprecatedOpenAIModel("gpt-3.5-turbo")).toBe(true);
    expect(isDeprecatedOpenAIModel("gpt-4.5-preview")).toBe(true);
    expect(isDeprecatedOpenAIModel("gpt-4-0314")).toBe(true);

    expect(isDeprecatedOpenAIModel("gpt-6-astra")).toBe(false);
    expect(isDeprecatedOpenAIModel("gpt-6.1-sol")).toBe(false);
    expect(isDeprecatedOpenAIModel("gpt-6.1-luna")).toBe(false);
    expect(isDeprecatedOpenAIModel("o3-mini")).toBe(false);
    expect(isDeprecatedOpenAIModel("o3")).toBe(false);
    expect(isDeprecatedOpenAIModel("o4-mini")).toBe(false);
    expect(isDeprecatedOpenAIModel("o1")).toBe(false);
    expect(isDeprecatedOpenAIModel("gpt-4o")).toBe(false);
    expect(isDeprecatedOpenAIModel("gpt-4o-mini")).toBe(false);
  });

  test("OPENAI_DEFAULT_MODELS includes at least 6 distinct GPT-6/6.1 models and excludes deprecated", () => {
    const values = OPENAI_DEFAULT_MODELS.map((m) => m.value);

    // Excludes deprecated
    expect(values).not.toContain("o1-mini");
    expect(values).not.toContain("o1-preview");
    expect(values).not.toContain("gpt-4-turbo");
    expect(values).not.toContain("gpt-3.5-turbo");
    expect(values).not.toContain("gpt-4.5-preview");

    // Specific GPT-6 / 6.1 models mapped (no lower than 6 models)
    const gpt6Models = values.filter((v) => v.startsWith("gpt-6"));
    expect(gpt6Models.length).toBeGreaterThanOrEqual(6);
    expect(values).toContain("gpt-6-astra");
    expect(values).toContain("gpt-6.1-sol");
    expect(values).toContain("gpt-6.1-luna");
    expect(values).toContain("gpt-6.1-astra");
    expect(values).toContain("gpt-6-sol");
    expect(values).toContain("gpt-6-luna");
    expect(values).toContain("gpt-6");

    // Active production models
    expect(values).toContain("o3-mini");
    expect(values).toContain("o3");
    expect(values).toContain("o4-mini");
    expect(values).toContain("o1");
    expect(values).toContain("gpt-4o");
    expect(values).toContain("gpt-4o-mini");
  });

  test("formatOpenAIModelLabel gives clean, accurate names", () => {
    expect(formatOpenAIModelLabel("gpt-6-astra")).toBe("GPT-6 Astra (flagship)");
    expect(formatOpenAIModelLabel("gpt-6.1-sol")).toBe("GPT-6.1 Sol (reasoning)");
    expect(formatOpenAIModelLabel("gpt-6.1-luna")).toBe("GPT-6.1 Luna (fast)");
    expect(formatOpenAIModelLabel("gpt-6.1-astra")).toBe("GPT-6.1 Astra");
    expect(formatOpenAIModelLabel("gpt-6-sol")).toBe("GPT-6 Sol");
    expect(formatOpenAIModelLabel("gpt-6-luna")).toBe("GPT-6 Luna (fast)");
    expect(formatOpenAIModelLabel("gpt-6")).toBe("GPT-6");

    expect(formatOpenAIModelLabel("o3-mini")).toBe("o3-mini (reasoning)");
    expect(formatOpenAIModelLabel("o3")).toBe("o3 (reasoning)");
    expect(formatOpenAIModelLabel("o4-mini")).toBe("o4-mini (reasoning)");
    expect(formatOpenAIModelLabel("o1")).toBe("o1 (reasoning)");
    expect(formatOpenAIModelLabel("gpt-4o")).toBe("GPT-4o (latest)");
    expect(formatOpenAIModelLabel("gpt-4o-mini")).toBe("GPT-4o Mini");
    expect(formatOpenAIModelLabel("chatgpt-4o-latest")).toBe("ChatGPT-4o Latest");
  });

  test("filterAndSortOpenAIModels filters deprecated and orders GPT-6 models first", () => {
    const raw = [
      "text-embedding-3-small",
      "whisper-1",
      "tts-1-hd",
      "dall-e-3",
      "text-moderation-latest",
      "gpt-4o-realtime-preview",
      "o1-preview",
      "o1-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
      "gpt-4o",
      "o3-mini",
      "gpt-6-astra",
      "gpt-6.1-sol",
      "gpt-6.1-luna",
      "gpt-6.1-astra",
      "gpt-6-sol",
      "gpt-6-luna",
      "gpt-6",
      "o4-mini",
      "gpt-4o-mini",
      "o1",
      "o3",
      "codex-max"
    ];

    const result = filterAndSortOpenAIModels(raw);
    const values = result.map((r) => r.value);

    // Deprecated and non-chat are filtered out
    expect(values).not.toContain("text-embedding-3-small");
    expect(values).not.toContain("whisper-1");
    expect(values).not.toContain("o1-preview");
    expect(values).not.toContain("o1-mini");
    expect(values).not.toContain("gpt-4-turbo");
    expect(values).not.toContain("gpt-3.5-turbo");

    // All 7 GPT-6 models kept
    expect(values).toContain("gpt-6-astra");
    expect(values).toContain("gpt-6.1-sol");
    expect(values).toContain("gpt-6.1-luna");
    expect(values).toContain("gpt-6.1-astra");
    expect(values).toContain("gpt-6-sol");
    expect(values).toContain("gpt-6-luna");
    expect(values).toContain("gpt-6");

    // GPT-6 Astra ranks before Sol, which ranks before o3, which ranks before gpt-4o
    const astraIndex = values.indexOf("gpt-6-astra");
    const solIndex = values.indexOf("gpt-6.1-sol");
    const o3Index = values.indexOf("o3-mini");
    const gpt4oIndex = values.indexOf("gpt-4o");

    expect(astraIndex).toBeLessThan(solIndex);
    expect(solIndex).toBeLessThan(o3Index);
    expect(o3Index).toBeLessThan(gpt4oIndex);
  });

  test("contains default reasoning effort options", () => {
    const values = OPENAI_REASONING_EFFORT_OPTIONS.map((opt) => opt.value);
    expect(values).toContain("default");
    expect(values).toContain("low");
    expect(values).toContain("medium");
    expect(values).toContain("high");
    expect(values).toContain("max");
    expect(values).toContain("minimal");
    expect(values).toContain("xhigh");
    expect(values).toContain("none");
  });
});

describe("Token limits per model and reasoning level", () => {
  test("specifies official model token limits", () => {
    // GPT-6 Family
    expect(OPENAI_MODEL_LIMITS["gpt-6-astra"].contextWindow).toBe(1050000);
    expect(OPENAI_MODEL_LIMITS["gpt-6-astra"].maxOutputTokens).toBe(128000);

    expect(OPENAI_MODEL_LIMITS["gpt-6.1-astra"].contextWindow).toBe(1050000);
    expect(OPENAI_MODEL_LIMITS["gpt-6.1-astra"].maxOutputTokens).toBe(128000);

    expect(OPENAI_MODEL_LIMITS["gpt-6.1-sol"].contextWindow).toBe(1050000);
    expect(OPENAI_MODEL_LIMITS["gpt-6.1-sol"].maxOutputTokens).toBe(128000);

    expect(OPENAI_MODEL_LIMITS["gpt-6-sol"].contextWindow).toBe(1050000);
    expect(OPENAI_MODEL_LIMITS["gpt-6-sol"].maxOutputTokens).toBe(128000);

    expect(OPENAI_MODEL_LIMITS["gpt-6.1-luna"].contextWindow).toBe(500000);
    expect(OPENAI_MODEL_LIMITS["gpt-6.1-luna"].maxOutputTokens).toBe(32768);

    expect(OPENAI_MODEL_LIMITS["gpt-6-luna"].contextWindow).toBe(500000);
    expect(OPENAI_MODEL_LIMITS["gpt-6-luna"].maxOutputTokens).toBe(32768);

    // O-Series Reasoning Models
    expect(OPENAI_MODEL_LIMITS["o3"].maxOutputTokens).toBe(100000);
    expect(OPENAI_MODEL_LIMITS["o3-mini"].maxOutputTokens).toBe(100000);
    expect(OPENAI_MODEL_LIMITS["o4-mini"].maxOutputTokens).toBe(100000);
    expect(OPENAI_MODEL_LIMITS["o1"].maxOutputTokens).toBe(100000);

    // General Multimodal
    expect(OPENAI_MODEL_LIMITS["gpt-4o"].maxOutputTokens).toBe(16384);
    expect(OPENAI_MODEL_LIMITS["gpt-4o-mini"].maxOutputTokens).toBe(16384);
  });

  test("specifies reasoning effort token ceilings based on publications", () => {
    expect(REASONING_EFFORT_TOKEN_LIMITS.minimal).toBe(4096);
    expect(REASONING_EFFORT_TOKEN_LIMITS.low).toBe(16384);
    expect(REASONING_EFFORT_TOKEN_LIMITS.medium).toBe(32768);
    expect(REASONING_EFFORT_TOKEN_LIMITS.high).toBe(65536);
    expect(REASONING_EFFORT_TOKEN_LIMITS.xhigh).toBe(100000);
    expect(REASONING_EFFORT_TOKEN_LIMITS.max).toBe(128000);
    expect(REASONING_EFFORT_TOKEN_LIMITS.default).toBe(32768);
  });

  test("calculates token limit dynamically with getOpenAITokenLimit", () => {
    // GPT-6 Astra & Sol (128k cap)
    expect(getOpenAITokenLimit("gpt-6-astra", "minimal")).toBe(4096);
    expect(getOpenAITokenLimit("gpt-6-astra", "low")).toBe(16384);
    expect(getOpenAITokenLimit("gpt-6.1-sol", "medium")).toBe(32768);
    expect(getOpenAITokenLimit("gpt-6.1-sol", "default")).toBe(32768);
    expect(getOpenAITokenLimit("gpt-6.1-sol", "high")).toBe(65536);
    expect(getOpenAITokenLimit("gpt-6.1-sol", "xhigh")).toBe(100000);
    expect(getOpenAITokenLimit("gpt-6.1-sol", "max")).toBe(128000);

    // GPT-6 Luna is non-reasoning, always returns its 32,768 cap
    expect(getOpenAITokenLimit("gpt-6.1-luna", "high")).toBe(32768);
    expect(getOpenAITokenLimit("gpt-6-luna", "max")).toBe(32768);

    // O3-mini (100k cap)
    expect(getOpenAITokenLimit("o3-mini", "minimal")).toBe(4096);
    expect(getOpenAITokenLimit("o3-mini", "low")).toBe(16384);
    expect(getOpenAITokenLimit("o3-mini", "high")).toBe(65536);
    // Capped at 100k maxOutputTokens even when max effort limit is 128k
    expect(getOpenAITokenLimit("o3-mini", "max")).toBe(100000);

    // Standard non-reasoning models always use their model max
    expect(getOpenAITokenLimit("gpt-4o", "high")).toBe(16384);
    expect(getOpenAITokenLimit("gpt-4o-mini", "low")).toBe(16384);
  });
});

describe("buildRequestBody with dynamic token limits", () => {
  test("defaults provider openai to gpt-6.1-sol", () => {
    const body = buildRequestBody(
      "openai",
      null,
      [],
      true,
      "Hello",
      null,
      null,
      "default"
    );

    expect(body.model).toBe("gpt-6.1-sol");
    expect(body.max_completion_tokens).toBe(32768);
  });

  test("configures gpt-6.1-sol with high effort and 65,536 token ceiling", () => {
    const body = buildRequestBody(
      "openai",
      "gpt-6.1-sol",
      [],
      true,
      "Analyze this architecture",
      null,
      null,
      "high"
    );

    expect(body.model).toBe("gpt-6.1-sol");
    expect(body.max_completion_tokens).toBe(65536);
    expect(body.reasoning_effort).toBe("high");
    expect(body.temperature).toBeUndefined();
  });

  test("configures gpt-6-astra with max effort and 128,000 token ceiling", () => {
    const body = buildRequestBody(
      "openai",
      "gpt-6-astra",
      [],
      true,
      "Write a complex system",
      null,
      null,
      "max"
    );

    expect(body.model).toBe("gpt-6-astra");
    expect(body.max_completion_tokens).toBe(128000);
    expect(body.reasoning_effort).toBe("max");
    expect(body.temperature).toBeUndefined();
  });

  test("configures gpt-6.1-luna as fast non-reasoning with 32,768 ceiling and temperature 0.1", () => {
    const body = buildRequestBody(
      "openai",
      "gpt-6.1-luna",
      [],
      true,
      "Fast response needed",
      null,
      null,
      "high"
    );

    expect(body.model).toBe("gpt-6.1-luna");
    expect(body.max_completion_tokens).toBe(32768);
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.temperature).toBe(0.1);
  });

  test("configures o3 with max effort and 100,000 token ceiling", () => {
    const body = buildRequestBody(
      "openai",
      "o3",
      [],
      true,
      "Solve this theorem",
      null,
      null,
      "max"
    );

    expect(body.model).toBe("o3");
    expect(body.max_completion_tokens).toBe(100000);
    expect(body.reasoning_effort).toBe("max");
    expect(body.temperature).toBeUndefined();
  });

  test("configures gpt-4o with 16,384 tokens and no reasoning_effort", () => {
    const body = buildRequestBody(
      "openai",
      "gpt-4o",
      [],
      true,
      "Summarize this text",
      null,
      null,
      "high"
    );

    expect(body.model).toBe("gpt-4o");
    expect(body.max_completion_tokens).toBe(16384);
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.temperature).toBe(0.1);
  });
});

describe("getOpenAIModels", () => {
  test("fetches and sorts models, filtering out deprecated and non-chat models", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes("api.openai.com/v1/models")) {
          const auth = init?.headers && "Authorization" in init.headers
            ? (init.headers as Record<string, string>)["Authorization"]
            : "";
          if (auth !== "Bearer test-api-key") {
            return new Response(JSON.stringify({ error: { message: "Invalid key" } }), {
              status: 401
            });
          }
          return new Response(
            JSON.stringify({
              object: "list",
              data: [
                { id: "gpt-4o", object: "model" },
                { id: "gpt-6.1-sol", object: "model" },
                { id: "gpt-6-astra", object: "model" },
                { id: "o3-mini", object: "model" },
                { id: "o1-mini", object: "model" }, // deprecated
                { id: "gpt-4-turbo", object: "model" }, // deprecated
                { id: "whisper-1", object: "model" }, // non-chat
                { id: "gpt-4o-mini", object: "model" }
              ]
            }),
            { status: 200 }
          );
        }
        return new Response("Not found", { status: 404 });
      }) as typeof fetch;

      const result = await getOpenAIModels("test-api-key");
      expect(result.models.length).toBe(5);
      const values = result.models.map((m) => m.value);
      expect(values).toContain("gpt-6-astra");
      expect(values).toContain("gpt-6.1-sol");
      expect(values).toContain("o3-mini");
      expect(values).toContain("gpt-4o");
      expect(values).toContain("gpt-4o-mini");
      expect(values).not.toContain("o1-mini");
      expect(values).not.toContain("gpt-4-turbo");
      expect(values).not.toContain("whisper-1");
      expect(result.defaultModel).toBe("gpt-6-astra");

      await expect(getOpenAIModels("wrong-key")).rejects.toThrow("Invalid key");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("throws if no API key is provided", async () => {
    await expect(getOpenAIModels("")).rejects.toThrow("No OpenAI API key provided");
  });
});
