import { beforeEach, describe, expect, test } from "bun:test";
import {
  callOpenCodeV2,
  getOpenCodeV2Models,
  pairOpenCodeV2
} from "../src/background/opencode-v2";
import { buildRequestBody } from "../src/content/requests";
import { parseOpenCodePairLink } from "../src/shared/opencode";

const storage: Record<string, unknown> = {};

(globalThis as { browser?: unknown }).browser = {
  runtime: { id: "test-extension" },
  storage: {
    local: {
      async get(keys: string | string[]) {
        const list = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(list.map((key) => [key, storage[key]]));
      },
      async set(values: Record<string, unknown>) {
        Object.assign(storage, values);
      }
    }
  }
};

interface CapturedRequest {
  url: string;
  method: string;
  body: unknown;
  headers: Headers;
}

let requests: CapturedRequest[] = [];
let routes: Record<string, () => Response> = {};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const parsedUrl = new URL(url);
  const path = `${parsedUrl.pathname}${parsedUrl.search}`;
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  requests.push({
    url: path,
    method: init?.method || "GET",
    body,
    headers: new Headers(init?.headers)
  });

  const handler = routes[path];
  if (!handler) {
    return json({ message: `Unhandled route: ${path}` }, 404);
  }
  return handler(body);
}) as typeof fetch;

function findRequest(
  method: string,
  path: string
): CapturedRequest | undefined {
  return requests.find(
    (request) => request.method === method && request.url === path
  );
}

beforeEach(() => {
  requests = [];
  routes = {};
  for (const key of Object.keys(storage)) {
    delete storage[key];
  }
});

describe("getOpenCodeV2Models", () => {
  test("maps v2 models and resolves the default model", async () => {
    routes["/api/info"] = () => json({ version: "2.1.2" });
    routes["/api/model"] = () =>
      json({
        data: [
          {
            id: "claude",
            providerID: "anthropic",
            name: "Claude",
            status: "active",
            enabled: true
          },
          {
            id: "old",
            providerID: "openai",
            name: "Old",
            status: "deprecated",
            enabled: true
          },
          {
            id: "off",
            providerID: "openai",
            name: "Off",
            status: "active",
            enabled: false
          },
          {
            id: "gpt",
            providerID: "openai",
            name: "GPT",
            status: "beta",
            enabled: true
          }
        ]
      });
    routes["/api/model/default"] = () =>
      json({
        data: {
          id: "claude",
          providerID: "anthropic",
          name: "Claude"
        }
      });

    const result = await getOpenCodeV2Models({
      baseUrl: "http://127.0.0.1:4096"
    });

    expect(result.defaultModel).toBe("anthropic/claude");
    expect(result.models).toEqual([
      { value: "anthropic/claude", label: "Claude (anthropic)" },
      { value: "openai/gpt", label: "GPT (openai)" }
    ]);
  });
});

describe("parseOpenCodePairLink", () => {
  test("extracts the base URL and pairing code", () => {
    expect(
      parseOpenCodePairLink(
        "http://127.0.0.1:49374/auth/connect/3r4l5Y7UB1umkTSI0xlH0A"
      )
    ).toEqual({
      baseUrl: "http://127.0.0.1:49374",
      code: "3r4l5Y7UB1umkTSI0xlH0A"
    });
  });

  test("ignores regular OpenCode server URLs", () => {
    expect(parseOpenCodePairLink("http://127.0.0.1:49374")).toBeNull();
    expect(parseOpenCodePairLink("not a url")).toBeNull();
  });
});

describe("pairOpenCodeV2", () => {
  test("exchanges a pair link for a session token", async () => {
    routes["/auth/connect/code123"] = () => json({ token: "session-token" });

    const result = await pairOpenCodeV2(
      "http://127.0.0.1:49374/auth/connect/code123"
    );

    expect(result).toEqual({
      baseUrl: "http://127.0.0.1:49374",
      password: "session-token"
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.headers.get("Accept")).toBe("application/json");
  });

  test("reports an expired or already-used pair link", async () => {
    routes["/auth/connect/used"] = () =>
      json({ message: "Authentication required" }, 401);

    await expect(
      pairOpenCodeV2("http://127.0.0.1:49374/auth/connect/used")
    ).rejects.toThrow("pairing link is invalid or expired");
  });
});

describe("callOpenCodeV2", () => {
  test("sends a prompt, waits for the session, and returns assistant text", async () => {
    routes["/api/info"] = () => json({ version: "2.1.2" });
    routes["/api/session"] = () => json({ data: { id: "ses_test" } });
    routes["/api/session/ses_test/model"] = () => noContent();
    routes["/api/session/ses_test/prompt"] = () =>
      json({ data: { id: "msg_user" } });
    routes["/api/experimental/session/ses_test/wait"] = () => noContent();
    routes["/api/session/ses_test/message?order=desc&limit=50"] = () =>
      json({
        data: [
          { id: "msg_idle", type: "idle", outcome: "succeeded" },
          {
            id: "msg_assistant",
            type: "assistant",
            content: [
              { type: "reasoning", text: "thinking" },
              { type: "text", text: "The answer is **OK**." }
            ]
          },
          { id: "msg_user", type: "user", text: "Test" }
        ]
      });

    const text = await callOpenCodeV2(
      { baseUrl: "http://127.0.0.1:4096" },
      {
        system: "System instruction",
        text: "Question: Reply OK",
        files: [
          {
            uri: "data:image/png;base64,AAAA",
            name: "image.png"
          }
        ],
        model: { providerID: "opencode", id: "test-model" }
      },
      "page",
      true
    );

    expect(text).toBe("The answer is **OK**.");

    const create = findRequest("POST", "/api/session");
    expect(create?.body).toEqual({ title: "Page: page" });

    const switchModel = findRequest("POST", "/api/session/ses_test/model");
    expect(switchModel?.body).toEqual({
      model: { providerID: "opencode", id: "test-model" }
    });

    const prompt = findRequest("POST", "/api/session/ses_test/prompt");
    expect(prompt?.body).toEqual({
      text: "System instruction\n\nQuestion: Reply OK",
      files: [
        {
          uri: "data:image/png;base64,AAAA",
          name: "image.png"
        }
      ]
    });

    expect(
      findRequest("POST", "/api/experimental/session/ses_test/wait")
    ).toBeDefined();
    expect(storage.opencodeV2SessionsByPage).toEqual({ page: "ses_test" });
  });

  test("prunes the v2 session before a stateless request", async () => {
    storage.opencodeV2SessionsByPage = { page: "ses_existing" };

    routes["/api/info"] = () => json({ version: "2.1.2" });
    routes["/api/session/ses_existing/message?order=asc&limit=1"] = () =>
      json({ data: [{ id: "msg_first", type: "user" }] });
    routes["/api/session/ses_existing/revert/stage"] = () =>
      json({ data: { messageID: "msg_first", files: [] } });
    routes["/api/session/ses_existing/revert/commit"] = () => noContent();
    routes["/api/session/ses_existing/model"] = () => noContent();
    routes["/api/session/ses_existing/prompt"] = () =>
      json({ data: { id: "msg_user" } });
    routes["/api/experimental/session/ses_existing/wait"] = () => noContent();
    routes["/api/session/ses_existing/message?order=desc&limit=50"] = () =>
      json({
        data: [
          { id: "msg_idle", type: "idle", outcome: "succeeded" },
          {
            id: "msg_assistant",
            type: "assistant",
            content: [{ type: "text", text: "Fresh answer" }]
          }
        ]
      });

    const text = await callOpenCodeV2(
      { baseUrl: "http://127.0.0.1:4096" },
      {
        text: "Question",
        model: { providerID: "opencode", id: "test-model" }
      },
      "page",
      false
    );

    expect(text).toBe("Fresh answer");
    expect(
      findRequest("POST", "/api/session/ses_existing/revert/stage")?.body
    ).toEqual({ messageID: "msg_first", files: false });
    expect(
      findRequest("POST", "/api/session/ses_existing/revert/commit")
    ).toBeDefined();
  });

  test("surfaces v2 authentication failures", async () => {
    routes["/api/info"] = () =>
      json({ message: "Authentication required" }, 401);

    await expect(
      callOpenCodeV2(
        { baseUrl: "http://127.0.0.1:4096" },
        { text: "Question" },
        "page",
        true
      )
    ).rejects.toThrow(
      "OpenCode v2 authentication failed. Paste an opencode pair link in the Server URL field, or check the Server Password in settings."
    );
  });
});

describe("buildRequestBody", () => {
  test("builds the OpenCode v2 prompt payload", () => {
    const body = buildRequestBody(
      "opencode-v2",
      "opencode/test-model",
      [{ role: "user", text: "Old message" }],
      true,
      "Question",
      "AAAA",
      "image/png"
    );

    expect(body).toMatchObject({
      text: "Question: Question",
      files: [
        {
          uri: "data:image/png;base64,AAAA",
          name: "image.png"
        }
      ],
      model: { providerID: "opencode", id: "test-model" }
    });
    expect(typeof body.system).toBe("string");
  });

  test("keeps the OpenCode v1 prompt payload unchanged", () => {
    const body = buildRequestBody(
      "opencode",
      "opencode/test-model",
      [],
      true,
      "Question",
      null,
      null
    );

    expect(body).toMatchObject({
      system: expect.any(String),
      parts: [{ type: "text", text: "Question: Question" }],
      model: { providerID: "opencode", modelID: "test-model" }
    });
  });
});
