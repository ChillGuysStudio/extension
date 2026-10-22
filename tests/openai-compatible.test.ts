import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { callOpenAI, getOpenAIModels } from "../src/background/providers";
import { buildRequestBody, sendToAI } from "../src/content/requests";
import { normalizeOpenAIBaseUrl } from "../src/shared/openai";
import {
  getApiKey,
  saveApiKey,
  updateProviderSettingsUI
} from "../src/content/settings";

const originalFetch = globalThis.fetch;
const originalBrowser = (globalThis as any).browser;
const originalDocument = globalThis.document;
let requests: Array<{ url: string; init?: RequestInit }>;

beforeEach(() => {
  requests = [];
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json(
      String(url).endsWith("/models")
        ? {
            data: [
              { id: "meta/llama-3.3" },
              { id: "qwen3" },
              { id: "meta/llama-3.3" }
            ]
          }
        : { choices: [{ message: { content: "OK" } }] }
    );
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as any).browser = originalBrowser;
  globalThis.document = originalDocument;
});

describe("OpenAI-compatible endpoints", () => {
  test("normalizes base URLs without adding an unwanted /v1", () => {
    expect(normalizeOpenAIBaseUrl()).toBe("https://api.openai.com/v1");
    expect(normalizeOpenAIBaseUrl(" http://localhost:1234/v1/// ")).toBe(
      "http://localhost:1234/v1"
    );
    expect(normalizeOpenAIBaseUrl("https://example.com/custom")).toBe(
      "https://example.com/custom"
    );
    for (const url of [
      "file:///tmp/test",
      "https://user:password@example.com",
      "https://example.com?key=secret"
    ]) {
      expect(() => normalizeOpenAIBaseUrl(url)).toThrow();
    }
  });

  test("sends completions and authorization to the configured endpoint", async () => {
    expect(
      await callOpenAI(
        "local-key",
        { model: "qwen3" },
        "http://localhost:1234/v1/"
      )
    ).toBe("OK");
    expect(requests[0].url).toBe("http://localhost:1234/v1/chat/completions");
    expect(new Headers(requests[0].init?.headers).get("Authorization")).toBe(
      "Bearer local-key"
    );
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      model: "qwen3"
    });
  });

  test("allows keyless local models and keeps non-OpenAI model IDs", async () => {
    const result = await getOpenAIModels("", "http://localhost:1234/v1");
    expect(result.models.map((m) => m.value)).toEqual([
      "meta/llama-3.3",
      "qwen3"
    ]);
    expect(requests[0].url).toBe("http://localhost:1234/v1/models");
    expect(new Headers(requests[0].init?.headers).has("Authorization")).toBe(
      false
    );
    await expect(getOpenAIModels("")).rejects.toThrow("No OpenAI API key");
  });

  test("uses generic completion parameters for a custom model", () => {
    const body = buildRequestBody(
      "openai",
      "meta/llama-3.3",
      [],
      true,
      "Hello",
      "AAAA",
      "image/png",
      "default",
      "http://localhost:1234/v1"
    );
    expect(body.model).toBe("meta/llama-3.3");
    expect(body.max_tokens).toBe(2048);
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(JSON.stringify(body.messages)).toContain(
      "data:image/png;base64,AAAA"
    );
  });

  test("relays the custom URL and manual model without requiring an API key", async () => {
    const pendingRequests = new Map();
    let request: any;
    (globalThis as any).browser = {
      runtime: {
        async sendMessage(value: any) {
          request = value;
          pendingRequests.get(value.requestId).resolve("OK");
          pendingRequests.delete(value.requestId);
        }
      }
    };
    const result = await sendToAI({
      text: "Hello",
      settings: {
        key: null,
        provider: "openai",
        model: "wrong",
        openaiCustomModel: "qwen3",
        openaiBaseUrl: "http://localhost:1234/v1",
        keepContext: true,
        opencodeUrl: "",
        opencodePassword: "",
        opacity: 1,
        btnOpacity: 1,
        chatWidth: 320,
        chatHeight: 480
      },
      contextMessages: [],
      getPageSessionKey: () => "page",
      pendingRequests
    });
    expect(result).toBe("OK");
    expect(request.openaiBaseUrl).toBe("http://localhost:1234/v1");
    expect(request.requestBody.model).toBe("qwen3");
  });
});

describe("connection settings", () => {
  test("persists custom endpoint/model and permits clearing a password", async () => {
    const storage: Record<string, unknown> = {};
    (globalThis as any).browser = {
      storage: {
        local: {
          async set(values: any) {
            Object.assign(storage, values);
          },
          async get() {
            return storage;
          }
        }
      }
    };
    await saveApiKey(
      "",
      "openai",
      "qwen3",
      true,
      "http://localhost:49489",
      "",
      1,
      1,
      320,
      480,
      "default",
      "http://localhost:1234/v1",
      "qwen3"
    );
    const settings = await getApiKey();
    expect(settings.openaiBaseUrl).toBe("http://localhost:1234/v1");
    expect(settings.openaiCustomModel).toBe("qwen3");
    expect(settings.opencodePassword).toBe("");
  });

  test("v2 exposes both a server URL and a masked password field", () => {
    const elements = new Map<string, any>();
    const get = (id: string) => {
      if (!elements.has(id)) {
        const classes = new Set<string>();
        elements.set(id, {
          value: "",
          type: "password",
          classList: {
            add: (name: string) => classes.add(name),
            remove: (name: string) => classes.delete(name),
            toggle: (name: string, active: boolean) =>
              active ? classes.add(name) : classes.delete(name),
            contains: (name: string) => classes.has(name)
          }
        });
      }
      return elements.get(id);
    };
    globalThis.document = { getElementById: get } as any;
    updateProviderSettingsUI("opencode-v2");
    expect(get("ai-opencode-url-label").textContent).toBe(
      "OpenCode Server URL or Pair Link"
    );
    expect(get("ai-opencode-password-group").classList.contains("hidden")).toBe(
      false
    );
    expect(get("ai-opencode-password").type).toBe("password");
  });
});
