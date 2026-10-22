import {
  OPENCODE_DEFAULT_URL,
  OPENCODE_V2_PAIR_PLACEHOLDER,
  PROVIDER_MODELS,
  getProviderLabel
} from "./constants";
import type { LayoutController } from "./layout";
import type {
  OverlayElements,
  OverlayState,
  ModelCache,
  ModelOption,
  OpenCodeConfig,
  OpenCodeModelsResponse,
  OpenAIModelsResponse,
  StoredSettings
} from "./types";
import { getById } from "./utils";
import {
  getOpenCodeApiVersion,
  getOpenCodeDefaultUrl,
  isOpenCodeProvider,
  normalizeOpenCodeUrl,
  parseOpenCodePairLink
} from "../shared/opencode";
import type { OpenCodeApiVersion } from "../shared/opencode";
import { getGeminiThinkingLevels } from "../shared/gemini";
import {
  isReasoningModel,
  getOpenAITokenLimit,
  normalizeOpenAIBaseUrl,
  isCustomOpenAIBaseUrl
} from "../shared/openai";

export { normalizeOpenCodeUrl } from "../shared/opencode";

export interface SelectedProviderInfo {
  provider: string;
  providerLabel: string;
  model: string | null;
  modelLabel: string;
  badgeLabel: string;
  signature: string;
}

function shortenModelLabel(label: string): string {
  const trimmed = label
    .replace(/\s*\((latest|stable)\)\s*/gi, "")
    .replace(/\s*Preview\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (trimmed.length <= 24) {
    return trimmed;
  }

  const slashIndex = trimmed.lastIndexOf("/");
  if (slashIndex >= 0 && slashIndex < trimmed.length - 1) {
    return trimmed.slice(slashIndex + 1);
  }

  return `${trimmed.slice(0, 21).trimEnd()}...`;
}

function getSelectedModelLabel(): string {
  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  const selectedOption = modelSelect.selectedOptions[0];
  return selectedOption?.textContent?.trim() || "Default model";
}

export function getSelectedProviderInfo(): SelectedProviderInfo {
  const provider = getById<HTMLSelectElement>("ai-provider-select").value;
  const customModel =
    provider === "openai"
      ? (
          document.getElementById(
            "ai-openai-custom-model"
          ) as HTMLInputElement | null
        )?.value.trim()
      : "";
  const model =
    customModel || getById<HTMLSelectElement>("ai-model-select").value || null;
  const providerLabel = getProviderLabel(provider);
  const modelLabel = customModel || getSelectedModelLabel();

  return {
    provider,
    providerLabel,
    model,
    modelLabel,
    badgeLabel: shortenModelLabel(modelLabel),
    signature: `${provider}::${model || ""}`
  };
}

export function updateComposerMetaUI(): void {
  const info = getSelectedProviderInfo();
  const chip = getById<HTMLSpanElement>("ai-provider-chip");
  const status = getById<HTMLSpanElement>("ai-provider-status");
  const input = getById<HTMLTextAreaElement>("ai-chatbox-input");

  chip.textContent = info.providerLabel;
  input.placeholder = `Message ${info.providerLabel} or paste image`;
  status.textContent = info.modelLabel;
}

export function updateReasoningEffortUI(
  provider: string,
  model: string | null
): void {
  const reasoningGroup = document.getElementById("ai-openai-reasoning-group");
  const reasoningSelect = document.getElementById(
    "ai-reasoning-effort-select"
  ) as HTMLSelectElement | null;
  const reasoningHint = document.getElementById("ai-reasoning-effort-hint");

  if (!reasoningGroup || !reasoningSelect) {
    return;
  }

  const isOpenAI = provider === "openai";
  reasoningGroup.classList.toggle("hidden", !isOpenAI);

  if (isOpenAI) {
    model =
      (
        document.getElementById(
          "ai-openai-custom-model"
        ) as HTMLInputElement | null
      )?.value.trim() || model;
    const isReasoning = isReasoningModel(model || "");
    reasoningSelect.disabled = !isReasoning;
    if (reasoningHint) {
      const limit = getOpenAITokenLimit(model || "", reasoningSelect.value);
      const formattedLimit =
        limit >= 1000 ? `${Math.round(limit / 1000)}k` : `${limit}`;

      if (isReasoning) {
        reasoningHint.textContent = `Effort: ${reasoningSelect.value} (allocates up to ${formattedLimit} tokens for reasoning + answer).`;
      } else {
        reasoningHint.textContent = `Standard model: ${formattedLimit} max output tokens (reasoning effort not applicable).`;
      }
    }
  }
}

const THINKING_LEVEL_LABELS: Record<string, string> = {
  default: "Default",
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra High",
  max: "Max",
  thinking: "Thinking"
};

function formatThinkingLevelLabel(level: string): string {
  const known = THINKING_LEVEL_LABELS[level];
  if (known) {
    return known;
  }

  return level
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSelectedThinkingLevels(): string[] {
  const modelSelect = document.getElementById(
    "ai-model-select"
  ) as HTMLSelectElement | null;
  const raw = modelSelect?.selectedOptions?.[0]?.dataset?.thinkingLevels;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (level): level is string => typeof level === "string" && level.length > 0
    );
  } catch {
    return [];
  }
}

function getAvailableThinkingLevels(
  provider: string,
  model: string | null
): string[] {
  if (provider === "aistudio" || provider === "vertex") {
    return getGeminiThinkingLevels(model);
  }
  if (provider === "opencode-v2") {
    return getSelectedThinkingLevels();
  }
  return [];
}

export function updateThinkingLevelUI(
  provider: string,
  model: string | null,
  preferredLevel?: string | null
): void {
  const group = document.getElementById("ai-thinking-level-group");
  const select = document.getElementById(
    "ai-thinking-level-select"
  ) as HTMLSelectElement | null;
  const hint = document.getElementById("ai-thinking-level-hint");

  if (!group || !select) {
    return;
  }

  const levels = getAvailableThinkingLevels(provider, model);
  group.classList.toggle("hidden", levels.length === 0);

  if (levels.length === 0) {
    return;
  }

  const previous = preferredLevel || select.value;
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "default";
  defaultOption.textContent = "Default";
  select.appendChild(defaultOption);

  levels.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = formatThinkingLevelLabel(level);
    select.appendChild(option);
  });

  select.value = levels.includes(previous) ? previous : "default";

  if (hint) {
    hint.textContent =
      provider === "opencode-v2"
        ? "Thinking variants reported by your OpenCode server for the selected model."
        : "Controls how deeply the model thinks before answering. Default uses the model's setting.";
  }
}

export function setModelOptions(
  models: ModelOption[],
  savedModel: string | null,
  savedThinkingLevel?: string | null
) {
  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  modelSelect.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    if (m.thinkingLevels?.length && opt.dataset) {
      opt.dataset.thinkingLevels = JSON.stringify(m.thinkingLevels);
    }
    modelSelect.appendChild(opt);
  });
  if (savedModel && models.some((m) => m.value === savedModel)) {
    modelSelect.value = savedModel;
  } else if (models.length > 0) {
    modelSelect.value = models[0].value;
  }

  const providerSelect = document.getElementById(
    "ai-provider-select"
  ) as HTMLSelectElement | null;
  updateReasoningEffortUI(providerSelect?.value || "", modelSelect.value);
  updateThinkingLevelUI(
    providerSelect?.value || "",
    modelSelect.value,
    savedThinkingLevel
  );
  updateComposerMetaUI();
}

export function updateProviderSettingsUI(provider: string): void {
  const isOpenCode = isOpenCodeProvider(provider);
  getById<HTMLDivElement>("ai-api-key-group").classList.toggle(
    "hidden",
    isOpenCode
  );
  getById<HTMLDivElement>("ai-opencode-group").classList.toggle(
    "hidden",
    !isOpenCode
  );

  const modelSelect = document.getElementById(
    "ai-model-select"
  ) as HTMLSelectElement | null;
  updateReasoningEffortUI(provider, modelSelect?.value || null);
  updateThinkingLevelUI(provider, modelSelect?.value || null);

  const isV2 = getOpenCodeApiVersion(provider) === "v2";
  const urlLabel = document.getElementById("ai-opencode-url-label");
  const urlInput = getById<HTMLInputElement>("ai-opencode-url");
  const passwordGroup = document.getElementById("ai-opencode-password-group");
  const passwordInput = getById<HTMLInputElement>("ai-opencode-password");
  const passwordLabel = document.getElementById("ai-opencode-password-label");

  if (isV2) {
    if (urlLabel) {
      urlLabel.textContent = "OpenCode Server URL or Pair Link";
    }
    urlInput.placeholder = OPENCODE_V2_PAIR_PLACEHOLDER;
    if (passwordGroup) {
      passwordGroup.classList.remove("hidden");
    }
    if (passwordLabel)
      passwordLabel.textContent = "Server Password or Pairing Token";
    passwordInput.placeholder = "OPENCODE_SERVER_PASSWORD or pairing token";
  } else {
    if (urlLabel) {
      urlLabel.textContent = "OpenCode Server URL";
    }
    urlInput.placeholder = OPENCODE_DEFAULT_URL;
    if (passwordGroup) {
      passwordGroup.classList.remove("hidden");
    }
    if (passwordLabel) {
      passwordLabel.textContent = "Server Password (optional)";
    }
    passwordInput.placeholder = "OPENCODE_SERVER_PASSWORD";
    passwordInput.type = "password";
  }
}

interface OpenCodePairResponse {
  success: boolean;
  baseUrl?: string;
  password?: string;
  error?: string;
}

async function pairOpenCodeV2(pairUrl: string): Promise<OpenCodeConfig | null> {
  if (!parseOpenCodePairLink(pairUrl)) {
    return null;
  }

  const response = (await browser.runtime.sendMessage({
    type: "pairOpenCodeV2",
    opencodePairUrl: pairUrl
  })) as OpenCodePairResponse;

  if (
    !response ||
    !response.success ||
    !response.baseUrl ||
    !response.password
  ) {
    throw new Error(response?.error || "Failed to pair with OpenCode v2.");
  }

  return { baseUrl: response.baseUrl, password: response.password };
}

export async function fetchOpenCodeModels(
  opencodeConfig: OpenCodeConfig,
  apiVersion: OpenCodeApiVersion
): Promise<OpenCodeModelsResponse> {
  const response = (await browser.runtime.sendMessage({
    type: "getOpenCodeModels",
    opencodeConfig,
    apiVersion
  })) as OpenCodeModelsResponse;

  if (!response || !response.success) {
    throw new Error(response?.error || "Failed to load models");
  }

  return response;
}

export async function fetchOpenAIModels(
  apiKey: string,
  baseUrl?: string
): Promise<OpenAIModelsResponse> {
  const response = (await browser.runtime.sendMessage({
    type: "getOpenAIModels",
    apiKey,
    openaiBaseUrl: baseUrl
  })) as OpenAIModelsResponse;

  if (!response || !response.success) {
    throw new Error(response?.error || "Failed to load OpenAI models");
  }

  return response;
}

export async function populateModels(
  provider: string,
  savedModel: string | null,
  settings: Partial<StoredSettings> | undefined,
  modelCache: ModelCache,
  openaiModelCache?: ModelCache
): Promise<void> {
  const savedThinkingLevel = settings?.thinkingLevel || null;

  if (provider === "openai") {
    const conf = settings || (await getApiKey());
    const inputKey =
      (
        document.getElementById("ai-sync-key") as HTMLInputElement | null
      )?.value?.trim() || "";
    const key = (inputKey || conf.key || "").trim();
    let baseUrl: string;
    try {
      baseUrl = normalizeOpenAIBaseUrl(conf.openaiBaseUrl);
    } catch (error) {
      const hint = document.getElementById("ai-api-key-hint");
      if (hint)
        hint.textContent =
          error instanceof Error ? error.message : String(error);
      return;
    }
    const customModel = conf.openaiCustomModel?.trim();
    const fallbackModel = customModel || savedModel;
    const fallbackModels = isCustomOpenAIBaseUrl(baseUrl)
      ? fallbackModel
        ? [{ value: fallbackModel, label: fallbackModel }]
        : [{ value: "", label: "Enter a custom model ID" }]
      : PROVIDER_MODELS.openai || [];

    if (!key && !isCustomOpenAIBaseUrl(baseUrl)) {
      setModelOptions(fallbackModels, savedModel, savedThinkingLevel);
      return;
    }

    const cacheKey = `openai::${baseUrl}::${key}`;
    if (
      openaiModelCache &&
      openaiModelCache.key === cacheKey &&
      openaiModelCache.models.length > 0
    ) {
      setModelOptions(openaiModelCache.models, savedModel, savedThinkingLevel);
      return;
    }

    const hint = document.getElementById("ai-api-key-hint");
    if (hint) {
      hint.textContent = "Fetching OpenAI models...";
    }

    try {
      const data = await fetchOpenAIModels(key, baseUrl);
      if (
        data &&
        data.success &&
        Array.isArray(data.models) &&
        data.models.length > 0
      ) {
        if (openaiModelCache) {
          openaiModelCache.key = cacheKey;
          openaiModelCache.models = data.models;
        }
        setModelOptions(
          data.models,
          savedModel || data.defaultModel || "",
          savedThinkingLevel
        );
        if (hint) {
          hint.textContent = `Loaded ${data.models.length} OpenAI models`;
        }
        return;
      }
    } catch {
      if (hint) {
        hint.textContent =
          "Could not load models. Enter a custom model ID or use a default model.";
      }
    }

    setModelOptions(fallbackModels, savedModel, savedThinkingLevel);
    return;
  }

  if (!isOpenCodeProvider(provider)) {
    setModelOptions(
      PROVIDER_MODELS[provider] || [],
      savedModel,
      savedThinkingLevel
    );
    return;
  }

  const apiVersion = getOpenCodeApiVersion(provider);
  if (!apiVersion) {
    setModelOptions(
      PROVIDER_MODELS[provider] || [],
      savedModel,
      savedThinkingLevel
    );
    return;
  }

  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  const status = getById<HTMLSpanElement>("ai-opencode-status");
  modelSelect.innerHTML = "";
  const loading = document.createElement("option");
  loading.value = "";
  loading.textContent = "Loading models...";
  modelSelect.appendChild(loading);

  const conf = settings || (await getApiKey());
  let opencodeConfig = {
    baseUrl: normalizeOpenCodeUrl(conf.opencodeUrl, apiVersion),
    password: conf.opencodePassword || ""
  };

  if (apiVersion === "v2") {
    const rawUrl =
      getById<HTMLInputElement>("ai-opencode-url")?.value ||
      conf.opencodeUrl ||
      "";
    const rawPass =
      getById<HTMLInputElement>("ai-opencode-password")?.value ||
      conf.opencodePassword ||
      "";
    const pairCandidate = parseOpenCodePairLink(rawUrl)
      ? rawUrl
      : parseOpenCodePairLink(rawPass)
        ? rawPass
        : parseOpenCodePairLink(opencodeConfig.baseUrl)
          ? opencodeConfig.baseUrl
          : parseOpenCodePairLink(opencodeConfig.password)
            ? opencodeConfig.password
            : null;

    if (pairCandidate) {
      try {
        status.textContent = "Connecting with OpenCode v2 pair link...";
        const paired = await pairOpenCodeV2(pairCandidate);
        if (paired) {
          opencodeConfig = paired;
          getById<HTMLInputElement>("ai-opencode-url").value = paired.baseUrl;
          getById<HTMLInputElement>("ai-opencode-password").value =
            paired.password;
          await browser.storage.local.set({
            opencodeServerUrl: paired.baseUrl,
            opencodePassword: paired.password
          });
        }
      } catch (error) {
        setModelOptions(
          [{ value: "", label: "Server default model" }],
          "",
          savedThinkingLevel
        );
        status.textContent = `Pairing failed: ${error instanceof Error ? error.message : String(error)}`;
        return;
      }
    }
  }

  const cacheKey = `${apiVersion}::${opencodeConfig.baseUrl}::${opencodeConfig.password}`;

  try {
    let serverModels: ModelOption[] = [];
    let defaultModel = "";

    if (modelCache.key === cacheKey && modelCache.models.length > 0) {
      serverModels = modelCache.models;
    } else {
      const data = await fetchOpenCodeModels(opencodeConfig, apiVersion);
      serverModels = Array.isArray(data.models) ? data.models : [];
      defaultModel = data.defaultModel || "";
      modelCache.key = cacheKey;
      modelCache.models = serverModels;
    }

    const merged = [{ value: "", label: "Server default model" }].concat(
      serverModels
    );
    setModelOptions(
      merged,
      savedModel || defaultModel || "",
      savedThinkingLevel
    );
    status.textContent = `Connected to ${opencodeConfig.baseUrl}`;
  } catch (error) {
    setModelOptions(
      [{ value: "", label: "Server default model" }],
      "",
      savedThinkingLevel
    );
    status.textContent = `Model fetch failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getApiKey(): Promise<StoredSettings> {
  const result = await browser.storage.local.get([
    "geminiApiKey",
    "apiProvider",
    "apiModel",
    "aiKeepContext",
    "openaiReasoningEffort",
    "openaiBaseUrl",
    "openaiCustomModel",
    "thinkingLevel",
    "opencodeServerUrl",
    "opencodePassword",
    "chatOpacity",
    "btnOpacity",
    "chatWidth",
    "chatHeight"
  ]);

  const provider = (result.apiProvider as string | undefined) || "aistudio";
  const defaultUrl = getOpenCodeDefaultUrl(provider);

  return {
    key: (result.geminiApiKey as string | undefined) || null,
    provider,
    model: (result.apiModel as string | undefined) || null,
    keepContext:
      typeof result.aiKeepContext === "boolean" ? result.aiKeepContext : true,
    openaiReasoningEffort:
      (result.openaiReasoningEffort as string | undefined) || "default",
    openaiBaseUrl: (result.openaiBaseUrl as string | undefined) || "",
    openaiCustomModel: (result.openaiCustomModel as string | undefined) || "",
    thinkingLevel: (result.thinkingLevel as string | undefined) || "default",
    opencodeUrl: (result.opencodeServerUrl as string | undefined) || defaultUrl,
    opencodePassword: (result.opencodePassword as string | undefined) || "",
    opacity: typeof result.chatOpacity === "number" ? result.chatOpacity : 0.95,
    btnOpacity:
      typeof result.btnOpacity === "number" ? result.btnOpacity : 0.25,
    chatWidth: typeof result.chatWidth === "number" ? result.chatWidth : 320,
    chatHeight: typeof result.chatHeight === "number" ? result.chatHeight : 480
  };
}

export async function saveApiKey(
  key: string,
  provider: string,
  model: string,
  keepContext: boolean,
  opencodeUrl: string,
  opencodePassword: string,
  opacity: number,
  btnOp: number,
  chatWidth: number,
  chatHeight: number,
  reasoningEffort?: string,
  openaiBaseUrl?: string,
  openaiCustomModel?: string,
  thinkingLevel?: string
): Promise<void> {
  const apiVersion = getOpenCodeApiVersion(provider);
  await browser.storage.local.set({
    geminiApiKey: key,
    apiProvider: provider,
    apiModel: model,
    aiKeepContext: keepContext,
    openaiReasoningEffort: reasoningEffort || "default",
    openaiBaseUrl: openaiBaseUrl?.trim() || "",
    openaiCustomModel: openaiCustomModel?.trim() || "",
    thinkingLevel: thinkingLevel || "default",
    opencodeServerUrl: normalizeOpenCodeUrl(opencodeUrl, apiVersion),
    opencodePassword: opencodePassword || "",
    chatOpacity: opacity,
    btnOpacity: btnOp,
    chatWidth,
    chatHeight
  });
}

interface SettingsControllerOptions {
  elements: OverlayElements;
  state: OverlayState;
}

export function createSettingsController({
  elements,
  state
}: SettingsControllerOptions) {
  const { aiButton, chatbox } = elements;
  let layoutController: Pick<LayoutController, "applyChatSize"> | null = null;

  async function updateProviderModels(
    provider: string,
    model: string | null,
    settings?: Partial<StoredSettings>
  ): Promise<void> {
    updateProviderSettingsUI(provider);
    await populateModels(
      provider,
      model,
      settings,
      state.opencodeModelCache,
      state.openaiModelCache
    );
  }

  async function autoSave(): Promise<void> {
    const key = getById<HTMLInputElement>("ai-sync-key").value.trim();
    const provider = getById<HTMLSelectElement>("ai-provider-select").value;
    const model = getById<HTMLSelectElement>("ai-model-select").value;
    const keepContext = getById<HTMLInputElement>("ai-keep-context").checked;
    const reasoningEffort =
      (
        document.getElementById(
          "ai-reasoning-effort-select"
        ) as HTMLSelectElement | null
      )?.value || "default";
    const thinkingLevel =
      (
        document.getElementById(
          "ai-thinking-level-select"
        ) as HTMLSelectElement | null
      )?.value || "default";
    const opacity =
      parseInt(getById<HTMLInputElement>("ai-opacity-slider").value, 10) / 100;
    const buttonOpacity =
      parseInt(getById<HTMLInputElement>("ai-btn-opacity-slider").value, 10) /
      100;

    const passwordValue = getById<HTMLInputElement>(
      "ai-opencode-password"
    ).value;

    await saveApiKey(
      key,
      provider,
      model,
      keepContext,
      getById<HTMLInputElement>("ai-opencode-url").value,
      passwordValue,
      opacity,
      buttonOpacity,
      chatbox.offsetWidth || 320,
      chatbox.offsetHeight || 480,
      reasoningEffort,
      getById<HTMLInputElement>("ai-openai-base-url").value,
      getById<HTMLInputElement>("ai-openai-custom-model").value,
      thinkingLevel
    );
    updateComposerMetaUI();
  }

  async function load(): Promise<void> {
    if (!layoutController) {
      throw new Error("Settings layout controller has not been attached.");
    }

    const settings = await getApiKey();
    getById<HTMLInputElement>("ai-openai-base-url").value =
      settings.openaiBaseUrl || "";
    getById<HTMLInputElement>("ai-openai-custom-model").value =
      settings.openaiCustomModel || "";
    if (settings.key) {
      getById<HTMLInputElement>("ai-sync-key").value = settings.key;
    }

    const resolvedProvider = settings.provider || "aistudio";
    const defaultUrl = getOpenCodeDefaultUrl(resolvedProvider);
    getById<HTMLInputElement>("ai-opencode-url").value =
      settings.opencodeUrl && settings.opencodeUrl !== defaultUrl
        ? settings.opencodeUrl
        : "";
    getById<HTMLInputElement>("ai-opencode-password").value =
      settings.opencodePassword;

    getById<HTMLSelectElement>("ai-provider-select").value = resolvedProvider;
    getById<HTMLInputElement>("ai-keep-context").checked = settings.keepContext;

    const reasoningSelect = document.getElementById(
      "ai-reasoning-effort-select"
    ) as HTMLSelectElement | null;
    if (reasoningSelect) {
      reasoningSelect.value = settings.openaiReasoningEffort || "default";
    }

    await updateProviderModels(resolvedProvider, settings.model, settings);

    const thinkingSelect = document.getElementById(
      "ai-thinking-level-select"
    ) as HTMLSelectElement | null;
    if (
      thinkingSelect &&
      thinkingSelect.options.length > 0 &&
      thinkingSelect.value !== settings.thinkingLevel
    ) {
      await browser.storage.local.set({
        thinkingLevel: thinkingSelect.value || "default"
      });
    }

    const pct = Math.round(settings.opacity * 100);
    getById<HTMLInputElement>("ai-opacity-slider").value = String(pct);
    getById<HTMLSpanElement>("ai-opacity-value").textContent = `${pct}%`;
    chatbox.style.opacity = String(settings.opacity);

    const btnPct = Math.round(settings.btnOpacity * 100);
    getById<HTMLInputElement>("ai-btn-opacity-slider").value = String(btnPct);
    getById<HTMLSpanElement>("ai-btn-opacity-value").textContent = `${btnPct}%`;
    aiButton.style.opacity = String(settings.btnOpacity);

    const appliedSize = layoutController.applyChatSize(
      settings.chatWidth,
      settings.chatHeight
    );
    if (
      appliedSize.width !== settings.chatWidth ||
      appliedSize.height !== settings.chatHeight
    ) {
      await autoSave();
    }
    updateComposerMetaUI();
    state.settingsLoaded = true;
  }

  function measurePanelHeight(): void {
    const panel = getById<HTMLDivElement>("ai-settings-panel");
    const header = chatbox.querySelector(".ai-header") as HTMLElement | null;
    const previous = {
      display: chatbox.style.display,
      visibility: chatbox.style.visibility
    };
    const panelWasVisible = panel.classList.contains("visible");
    chatbox.style.visibility = "hidden";
    chatbox.style.display = "flex";
    panel.classList.add("visible");
    const headerHeight = header?.offsetHeight ?? 41;
    const measured = headerHeight + panel.offsetHeight + 16;
    if (measured > 100) {
      state.settingsMinHeight = measured;
    }
    chatbox.style.display = previous.display;
    chatbox.style.visibility = previous.visibility;
    if (!panelWasVisible) {
      panel.classList.remove("visible");
    }
  }

  return {
    attachLayout(layout: Pick<LayoutController, "applyChatSize">) {
      layoutController = layout;
    },
    updateProviderModels,
    load,
    autoSave,
    measurePanelHeight
  };
}
