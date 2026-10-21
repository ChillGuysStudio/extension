import {
  OPENCODE_DEFAULT_URL,
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
  StoredSettings
} from "./types";
import { getById } from "./utils";
import {
  getOpenCodeApiVersion,
  isOpenCodeProvider,
  normalizeOpenCodeUrl
} from "../shared/opencode";
import type { OpenCodeApiVersion } from "../shared/opencode";

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
  const model = getById<HTMLSelectElement>("ai-model-select").value || null;
  const providerLabel = getProviderLabel(provider);
  const modelLabel = getSelectedModelLabel();

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

export function setModelOptions(
  models: ModelOption[],
  savedModel: string | null
) {
  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  modelSelect.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });
  if (savedModel && models.some((m) => m.value === savedModel)) {
    modelSelect.value = savedModel;
  } else if (models.length > 0) {
    modelSelect.value = models[0].value;
  }

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

export async function populateModels(
  provider: string,
  savedModel: string | null,
  settings: Partial<StoredSettings> | undefined,
  modelCache: ModelCache
): Promise<void> {
  if (!isOpenCodeProvider(provider)) {
    setModelOptions(PROVIDER_MODELS[provider] || [], savedModel);
    return;
  }

  const apiVersion = getOpenCodeApiVersion(provider);
  if (!apiVersion) {
    setModelOptions(PROVIDER_MODELS[provider] || [], savedModel);
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
  const opencodeConfig = {
    baseUrl: normalizeOpenCodeUrl(conf.opencodeUrl),
    password: conf.opencodePassword || ""
  };
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
    setModelOptions(merged, savedModel || defaultModel || "");
    status.textContent = `Connected to ${opencodeConfig.baseUrl}`;
  } catch (error) {
    setModelOptions([{ value: "", label: "Server default model" }], "");
    status.textContent = `Model fetch failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getApiKey(): Promise<StoredSettings> {
  const result = await browser.storage.local.get([
    "geminiApiKey",
    "apiProvider",
    "apiModel",
    "aiKeepContext",
    "opencodeServerUrl",
    "opencodePassword",
    "chatOpacity",
    "btnOpacity",
    "chatWidth",
    "chatHeight"
  ]);

  return {
    key: (result.geminiApiKey as string | undefined) || null,
    provider: (result.apiProvider as string | undefined) || "aistudio",
    model: (result.apiModel as string | undefined) || null,
    keepContext:
      typeof result.aiKeepContext === "boolean" ? result.aiKeepContext : true,
    opencodeUrl:
      (result.opencodeServerUrl as string | undefined) || OPENCODE_DEFAULT_URL,
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
  chatHeight: number
): Promise<void> {
  await browser.storage.local.set({
    geminiApiKey: key,
    apiProvider: provider,
    apiModel: model,
    aiKeepContext: keepContext,
    opencodeServerUrl: normalizeOpenCodeUrl(opencodeUrl),
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
    await populateModels(provider, model, settings, state.opencodeModelCache);
  }

  async function autoSave(): Promise<void> {
    const key = getById<HTMLInputElement>("ai-sync-key").value.trim();
    const provider = getById<HTMLSelectElement>("ai-provider-select").value;
    const model = getById<HTMLSelectElement>("ai-model-select").value;
    const keepContext = getById<HTMLInputElement>("ai-keep-context").checked;
    const opacity =
      parseInt(getById<HTMLInputElement>("ai-opacity-slider").value, 10) / 100;
    const buttonOpacity =
      parseInt(getById<HTMLInputElement>("ai-btn-opacity-slider").value, 10) /
      100;
    await saveApiKey(
      key,
      provider,
      model,
      keepContext,
      normalizeOpenCodeUrl(getById<HTMLInputElement>("ai-opencode-url").value),
      getById<HTMLInputElement>("ai-opencode-password").value,
      opacity,
      buttonOpacity,
      chatbox.offsetWidth || 320,
      chatbox.offsetHeight || 480
    );
    updateComposerMetaUI();
  }

  async function load(): Promise<void> {
    if (!layoutController) {
      throw new Error("Settings layout controller has not been attached.");
    }

    const settings = await getApiKey();
    if (settings.key) {
      getById<HTMLInputElement>("ai-sync-key").value = settings.key;
    }
    getById<HTMLInputElement>("ai-opencode-url").value = normalizeOpenCodeUrl(
      settings.opencodeUrl
    );
    getById<HTMLInputElement>("ai-opencode-password").value =
      settings.opencodePassword;

    const resolvedProvider = settings.provider || "aistudio";
    getById<HTMLSelectElement>("ai-provider-select").value = resolvedProvider;
    getById<HTMLInputElement>("ai-keep-context").checked = settings.keepContext;
    await updateProviderModels(resolvedProvider, settings.model, {
      opencodeUrl: normalizeOpenCodeUrl(settings.opencodeUrl),
      opencodePassword: settings.opencodePassword
    });

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
