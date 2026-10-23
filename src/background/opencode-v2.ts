import {
  normalizeOpenCodeUrl,
  parseOpenCodePairLink
} from "../shared/opencode";

const OPENCODE_V2_SESSION_MAP_KEY = "opencodeV2SessionsByPage";
const OPENCODE_V2_POLL_INTERVAL_MS = 1000;
const OPENCODE_V2_WAIT_TIMEOUT_MS = 180000;

interface OpenCodeV2Config {
  baseUrl?: string;
  password?: string;
}

interface OpenCodeV2FetchOptions {
  method?: string;
  headers?: HeadersInit;
  body?: string;
}

interface OpenCodeV2SessionMap {
  [pageKey: string]: string;
}

interface OpenCodeV2SessionResponse {
  data?: {
    id?: string;
  };
}

interface OpenCodeV2MessagePart {
  type?: string;
  text?: string;
}

interface OpenCodeV2Message {
  id?: string;
  type?: string;
  text?: string;
  content?: OpenCodeV2MessagePart[];
  time?: {
    created?: number;
    completed?: number;
  };
  outcome?: string;
  error?: {
    message?: string;
  } | null;
}

interface OpenCodeV2MessagesResponse {
  data?: OpenCodeV2Message[];
}

interface OpenCodeV2ModelInfo {
  id?: string;
  providerID?: string;
  name?: string;
  status?: string;
  enabled?: boolean;
  variants?: Array<{ id?: string }>;
}

interface OpenCodeV2ModelListResponse {
  data?: OpenCodeV2ModelInfo[];
}

interface OpenCodeV2ModelDefaultResponse {
  data?: OpenCodeV2ModelInfo | null;
}

interface OpenCodeV2ModelOption {
  value: string;
  label: string;
  thinkingLevels?: string[];
}

interface OpenCodeV2RequestModel {
  providerID: string;
  id: string;
  variant?: string;
}

interface OpenCodeV2PairingSession {
  token?: string;
}

interface OpenCodeV2FileAttachment {
  uri: string;
  name?: string;
}

interface OpenCodeV2RequestBody {
  [key: string]: unknown;
  text?: unknown;
  system?: unknown;
  files?: unknown;
  model?: unknown;
}

function parseErrorPayload(text: string): string {
  if (!text) {
    return "";
  }

  try {
    const json = JSON.parse(text) as {
      error?: { message?: string };
      data?: { message?: string };
      message?: string;
    };
    if (typeof json.error?.message === "string") {
      return json.error.message;
    }
    if (typeof json.data?.message === "string") {
      return json.data.message;
    }
    if (typeof json.message === "string") {
      return json.message;
    }
    return text;
  } catch {
    return text;
  }
}

function createOpenCodeV2AuthHeader(password: string): string | null {
  if (!password) {
    return null;
  }
  return `Basic ${btoa(`opencode:${password}`)}`;
}

function buildOpenCodeV2CorsHint(baseUrl: string): string {
  const extensionOrigin = `moz-extension://${browser.runtime.id}`;
  let hostname = "127.0.0.1";
  let port = "49374";

  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname) {
      hostname = parsed.hostname;
    }
    if (parsed.port) {
      port = parsed.port;
    } else if (parsed.protocol === "https:") {
      port = "443";
    } else {
      port = "80";
    }
  } catch {
    // Keep defaults.
  }

  return `Cannot reach OpenCode v2 server at ${baseUrl}. If it is local, run:\nopencode serve --hostname ${hostname} --port ${port} --cors ${extensionOrigin}`;
}

async function openCodeV2Fetch<T>(
  baseUrl: string,
  password: string,
  path: string,
  options: OpenCodeV2FetchOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (
    options.method &&
    options.method !== "GET" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const authHeader = createOpenCodeV2AuthHeader(password);
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      body: options.body,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new Error(`${buildOpenCodeV2CorsHint(baseUrl)}\nDetails: ${message}`);
  }

  if (!response.ok) {
    const text = await response.text();
    const message =
      parseErrorPayload(text) || response.statusText || "Request failed";
    if (response.status === 401) {
      throw new Error(
        "OpenCode v2 authentication failed. Check your server password or pairing token, or run `opencode pair` and paste a fresh pairing link into the extension settings."
      );
    }
    throw new Error(
      `OpenCode v2 request failed (${response.status}): ${message}`
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("OpenCode v2 returned an invalid JSON response.");
  }
}

export async function pairOpenCodeV2(
  pairUrl: string
): Promise<{ baseUrl: string; password: string }> {
  const link = parseOpenCodePairLink(pairUrl);
  if (!link) {
    throw new Error(
      "Paste the opencode pair link from `opencode pair` into the settings."
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `${link.baseUrl}/auth/connect/${encodeURIComponent(link.code)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new Error(
      `${buildOpenCodeV2CorsHint(link.baseUrl)}\nDetails: ${message}`
    );
  }

  if (!response.ok) {
    if ([400, 401, 404, 410].includes(response.status)) {
      throw new Error(
        "OpenCode v2 pairing link is invalid or expired. Run `opencode pair` again and paste the new link."
      );
    }

    const text = await response.text();
    const message =
      parseErrorPayload(text) || response.statusText || "Request failed";
    throw new Error(
      `OpenCode v2 pairing failed (${response.status}): ${message}`
    );
  }

  const data = (await response
    .json()
    .catch(() => null)) as OpenCodeV2PairingSession | null;
  if (!data?.token) {
    throw new Error("OpenCode v2 did not return a pairing token.");
  }

  return { baseUrl: link.baseUrl, password: data.token };
}

async function getOpenCodeV2SessionMap(): Promise<OpenCodeV2SessionMap> {
  const result = (await browser.storage.local.get(
    OPENCODE_V2_SESSION_MAP_KEY
  )) as Record<string, unknown>;
  const map = result[OPENCODE_V2_SESSION_MAP_KEY];
  if (map && typeof map === "object") {
    return map as OpenCodeV2SessionMap;
  }
  return {};
}

async function setOpenCodeV2SessionMap(
  map: OpenCodeV2SessionMap
): Promise<void> {
  await browser.storage.local.set({ [OPENCODE_V2_SESSION_MAP_KEY]: map });
}

async function getOpenCodeV2SessionId(pageKey: string): Promise<string | null> {
  const map = await getOpenCodeV2SessionMap();
  return map[pageKey] || null;
}

async function saveOpenCodeV2SessionId(
  pageKey: string,
  sessionId: string
): Promise<void> {
  const map = await getOpenCodeV2SessionMap();
  map[pageKey] = sessionId;
  await setOpenCodeV2SessionMap(map);
}

async function clearOpenCodeV2SessionId(pageKey: string): Promise<void> {
  const map = await getOpenCodeV2SessionMap();
  if (map[pageKey]) {
    delete map[pageKey];
    await setOpenCodeV2SessionMap(map);
  }
}

async function createOpenCodeV2Session(
  baseUrl: string,
  password: string,
  pageKey: string
): Promise<string> {
  const title = pageKey ? `Page: ${pageKey.slice(0, 120)}` : undefined;
  const body = title ? { title } : {};
  const data = await openCodeV2Fetch<OpenCodeV2SessionResponse>(
    baseUrl,
    password,
    "/api/session",
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );

  const sessionId = data?.data?.id;
  if (!sessionId) {
    throw new Error("OpenCode v2 did not return a session ID.");
  }
  return sessionId;
}

async function ensureOpenCodeV2Session(
  baseUrl: string,
  password: string,
  pageKey: string
): Promise<string> {
  const existing = await getOpenCodeV2SessionId(pageKey);
  if (existing) {
    return existing;
  }
  const created = await createOpenCodeV2Session(baseUrl, password, pageKey);
  await saveOpenCodeV2SessionId(pageKey, created);
  return created;
}

function shouldRetryWithNewSession(error: unknown): boolean {
  return error instanceof Error && /\(404\)/.test(error.message);
}

function extractOpenCodeV2Text(message: OpenCodeV2Message): string {
  if (message.error?.message) {
    throw new Error(message.error.message);
  }

  const parts = Array.isArray(message.content) ? message.content : [];
  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n\n")
    .trim();
}

function extractOpenCodeV2Model(value: unknown): OpenCodeV2RequestModel | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const model = value as {
    providerID?: unknown;
    id?: unknown;
    variant?: unknown;
  };
  if (typeof model.providerID !== "string" || typeof model.id !== "string") {
    return null;
  }
  if (!model.providerID || !model.id) {
    return null;
  }

  const result: OpenCodeV2RequestModel = {
    providerID: model.providerID,
    id: model.id
  };
  if (typeof model.variant === "string" && model.variant) {
    result.variant = model.variant;
  }
  return result;
}

function extractOpenCodeV2Files(value: unknown): OpenCodeV2FileAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const file = item as { uri?: unknown; name?: unknown };
    if (typeof file.uri !== "string" || !file.uri) {
      return [];
    }

    const attachment: OpenCodeV2FileAttachment = { uri: file.uri };
    if (typeof file.name === "string" && file.name) {
      attachment.name = file.name;
    }
    return [attachment];
  });
}

function buildOpenCodeV2PromptText(requestBody: OpenCodeV2RequestBody): string {
  const system =
    typeof requestBody.system === "string" ? requestBody.system.trim() : "";
  const text =
    typeof requestBody.text === "string" ? requestBody.text.trim() : "";

  if (!text) {
    throw new Error("OpenCode v2 request is missing message text.");
  }

  return system ? `${system}\n\n${text}` : text;
}

async function getOpenCodeV2DefaultModel(
  baseUrl: string,
  password: string
): Promise<OpenCodeV2RequestModel | null> {
  try {
    const defaultData = await openCodeV2Fetch<OpenCodeV2ModelDefaultResponse>(
      baseUrl,
      password,
      "/api/model/default",
      { method: "GET" }
    );
    const model = defaultData?.data;
    if (model?.id && model.providerID) {
      return { providerID: model.providerID, id: model.id };
    }
  } catch {
    // The server does not have to expose a default model.
  }
  return null;
}

async function switchOpenCodeV2Model(
  baseUrl: string,
  password: string,
  sessionId: string,
  model: OpenCodeV2RequestModel | null
): Promise<void> {
  if (!model) {
    return;
  }

  await openCodeV2Fetch<null>(
    baseUrl,
    password,
    `/api/session/${encodeURIComponent(sessionId)}/model`,
    {
      method: "POST",
      body: JSON.stringify({ model })
    }
  );
}

async function getOpenCodeV2Messages(
  baseUrl: string,
  password: string,
  sessionId: string,
  order: "asc" | "desc",
  limit = 50
): Promise<OpenCodeV2Message[]> {
  const data = await openCodeV2Fetch<OpenCodeV2MessagesResponse>(
    baseUrl,
    password,
    `/api/session/${encodeURIComponent(sessionId)}/message?order=${order}&limit=${limit}`,
    { method: "GET" }
  );
  return Array.isArray(data?.data) ? data.data : [];
}

async function pruneOpenCodeV2Session(
  baseUrl: string,
  password: string,
  sessionId: string
): Promise<void> {
  const messages = await getOpenCodeV2Messages(
    baseUrl,
    password,
    sessionId,
    "asc",
    1
  );
  const firstMessageId = messages[0]?.id;
  if (!firstMessageId) {
    return;
  }

  await openCodeV2Fetch<unknown>(
    baseUrl,
    password,
    `/api/session/${encodeURIComponent(sessionId)}/revert/stage`,
    {
      method: "POST",
      body: JSON.stringify({ messageID: firstMessageId, files: false })
    }
  );

  await openCodeV2Fetch<null>(
    baseUrl,
    password,
    `/api/session/${encodeURIComponent(sessionId)}/revert/commit`,
    { method: "POST" }
  );
}

async function sendOpenCodeV2Prompt(
  baseUrl: string,
  password: string,
  sessionId: string,
  requestBody: OpenCodeV2RequestBody
): Promise<void> {
  const body: Record<string, unknown> = {
    text: buildOpenCodeV2PromptText(requestBody)
  };

  const files = extractOpenCodeV2Files(requestBody.files);
  if (files.length > 0) {
    body.files = files;
  }

  await openCodeV2Fetch<unknown>(
    baseUrl,
    password,
    `/api/session/${encodeURIComponent(sessionId)}/prompt`,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

async function pollOpenCodeV2Session(
  baseUrl: string,
  password: string,
  sessionId: string,
  startedAt: number
): Promise<void> {
  const deadline = Date.now() + OPENCODE_V2_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const messages = await getOpenCodeV2Messages(
      baseUrl,
      password,
      sessionId,
      "desc",
      20
    );
    const assistant = messages.find(
      (message) =>
        message.type === "assistant" &&
        (message.time?.created ?? 0) >= startedAt
    );
    const idle = messages.find(
      (message) =>
        message.type === "idle" && (message.time?.created ?? 0) >= startedAt
    );

    if (assistant && (assistant.time?.completed || idle)) {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, OPENCODE_V2_POLL_INTERVAL_MS)
    );
  }

  throw new Error("OpenCode v2 did not finish the response in time.");
}

async function waitOpenCodeV2Session(
  baseUrl: string,
  password: string,
  sessionId: string,
  startedAt: number
): Promise<void> {
  try {
    await openCodeV2Fetch<null>(
      baseUrl,
      password,
      `/api/experimental/session/${encodeURIComponent(sessionId)}/wait`,
      { method: "POST" }
    );
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/\(404\)|\(405\)/.test(message)) {
      throw error;
    }
  }

  await pollOpenCodeV2Session(baseUrl, password, sessionId, startedAt);
}

export async function callOpenCodeV2(
  opencodeConfig: OpenCodeV2Config | undefined,
  requestBody: OpenCodeV2RequestBody | undefined,
  pageKey: string | undefined,
  keepContext = true
): Promise<string> {
  const baseUrl = normalizeOpenCodeUrl(opencodeConfig?.baseUrl, "v2");
  const password = opencodeConfig?.password || "";
  const scopedPageKey = pageKey || "default";

  if (!requestBody) {
    throw new Error("OpenCode v2 request is missing a body.");
  }

  const model =
    extractOpenCodeV2Model(requestBody.model) ??
    (await getOpenCodeV2DefaultModel(baseUrl, password));
  buildOpenCodeV2PromptText(requestBody);

  await openCodeV2Fetch(baseUrl, password, "/api/info", { method: "GET" });

  let sessionId = await ensureOpenCodeV2Session(
    baseUrl,
    password,
    scopedPageKey
  );

  const startedAt = Date.now();

  try {
    if (!keepContext) {
      await pruneOpenCodeV2Session(baseUrl, password, sessionId);
    }
    await switchOpenCodeV2Model(baseUrl, password, sessionId, model);
    await sendOpenCodeV2Prompt(baseUrl, password, sessionId, requestBody);
  } catch (error) {
    if (!shouldRetryWithNewSession(error)) {
      throw error;
    }

    await clearOpenCodeV2SessionId(scopedPageKey);
    sessionId = await ensureOpenCodeV2Session(baseUrl, password, scopedPageKey);
    await switchOpenCodeV2Model(baseUrl, password, sessionId, model);
    await sendOpenCodeV2Prompt(baseUrl, password, sessionId, requestBody);
  }

  await waitOpenCodeV2Session(baseUrl, password, sessionId, startedAt);

  const messages = await getOpenCodeV2Messages(
    baseUrl,
    password,
    sessionId,
    "desc",
    50
  );
  const idle = messages.find((message) => message.type === "idle");
  if (idle?.error?.message) {
    throw new Error(idle.error.message);
  }
  if (idle?.outcome === "failed") {
    throw new Error("OpenCode v2 response failed.");
  }

  const assistant = messages.find((message) => message.type === "assistant");
  if (!assistant) {
    throw new Error("No response generated");
  }

  const text = extractOpenCodeV2Text(assistant);
  if (!text) {
    throw new Error("No response generated");
  }

  return text;
}

export async function restartOpenCodeV2Session(
  pageKey: string | undefined
): Promise<void> {
  const scopedPageKey = pageKey || "default";
  await clearOpenCodeV2SessionId(scopedPageKey);
}

export async function getOpenCodeV2Models(
  opencodeConfig: OpenCodeV2Config | undefined
): Promise<{ models: OpenCodeV2ModelOption[]; defaultModel: string }> {
  const baseUrl = normalizeOpenCodeUrl(opencodeConfig?.baseUrl, "v2");
  const password = opencodeConfig?.password || "";

  await openCodeV2Fetch(baseUrl, password, "/api/info", { method: "GET" });
  const modelsData = await openCodeV2Fetch<OpenCodeV2ModelListResponse>(
    baseUrl,
    password,
    "/api/model",
    { method: "GET" }
  );

  const availableModels = Array.isArray(modelsData?.data)
    ? modelsData.data
    : [];
  const modelsByValue = new Map<string, OpenCodeV2ModelOption>();

  availableModels.forEach((model) => {
    if (
      !model?.id ||
      !model.providerID ||
      model.status === "deprecated" ||
      model.enabled === false
    ) {
      return;
    }

    const value = `${model.providerID}/${model.id}`;
    const label = model.name ? `${model.name} (${model.providerID})` : value;
    const option: OpenCodeV2ModelOption = { value, label };
    const thinkingLevels = Array.isArray(model.variants)
      ? Array.from(
          new Set(
            model.variants
              .map((variant) =>
                typeof variant?.id === "string" ? variant.id : ""
              )
              .filter((variant) => variant.length > 0)
          )
        )
      : [];
    if (thinkingLevels.length > 0) {
      option.thinkingLevels = thinkingLevels;
    }
    modelsByValue.set(value, option);
  });

  const models = Array.from(modelsByValue.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  let defaultModel = "";
  const defaultModelRef = await getOpenCodeV2DefaultModel(baseUrl, password);
  if (defaultModelRef) {
    defaultModel = `${defaultModelRef.providerID}/${defaultModelRef.id}`;
  }

  return { models, defaultModel };
}
