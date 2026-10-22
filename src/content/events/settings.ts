import type { EventBindingsOptions } from "./types";
import { getById, getInputEventValue, queryRequired } from "../utils";
import {
  getOpenCodeApiVersion,
  isOpenCodeProvider,
  parseOpenCodePairLink
} from "../../shared/opencode";
import { updateReasoningEffortUI, updateThinkingLevelUI } from "../settings";

export function bindSettingsEvents({
  elements,
  state,
  chat,
  settings,
  images
}: Pick<
  EventBindingsOptions,
  "elements" | "state" | "chat" | "settings" | "images"
>): void {
  const { aiButton, chatbox } = elements;
  const providerSelect = getById<HTMLSelectElement>("ai-provider-select");
  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  const apiKeyInput = getById<HTMLInputElement>("ai-sync-key");
  const keepContextInput = getById<HTMLInputElement>("ai-keep-context");
  const reasoningEffortSelect = document.getElementById(
    "ai-reasoning-effort-select"
  ) as HTMLSelectElement | null;
  const thinkingLevelSelect = document.getElementById(
    "ai-thinking-level-select"
  ) as HTMLSelectElement | null;
  const opencodePasswordInput = getById<HTMLInputElement>(
    "ai-opencode-password"
  );
  const opencodeUrlInput = getById<HTMLInputElement>("ai-opencode-url");
  const opacitySlider = getById<HTMLInputElement>("ai-opacity-slider");
  const buttonOpacitySlider = getById<HTMLInputElement>(
    "ai-btn-opacity-slider"
  );
  const chatboxInput = getById<HTMLTextAreaElement>("ai-chatbox-input");

  queryRequired<HTMLButtonElement>(chatbox, ".ai-close").addEventListener(
    "click",
    chat.close
  );
  getById<HTMLButtonElement>("ai-settings-toggle").addEventListener(
    "click",
    settings.toggle
  );

  providerSelect.addEventListener("change", async () => {
    await settings.updateProviderModels(providerSelect.value, null);
    await settings.autoSave();
  });

  modelSelect.addEventListener("change", () => {
    updateReasoningEffortUI(providerSelect.value, modelSelect.value);
    updateThinkingLevelUI(providerSelect.value, modelSelect.value);
    void settings.autoSave();
  });

  if (reasoningEffortSelect) {
    reasoningEffortSelect.addEventListener("change", () => {
      updateReasoningEffortUI(providerSelect.value, modelSelect.value);
      void settings.autoSave();
    });
  }

  if (thinkingLevelSelect) {
    thinkingLevelSelect.addEventListener("change", () => {
      updateThinkingLevelUI(providerSelect.value, modelSelect.value);
      void settings.autoSave();
    });
  }

  const checkOpenAIKey = async () => {
    if (providerSelect.value !== "openai") {
      return;
    }
    state.openaiModelCache = { key: "", models: [] };
    await settings.autoSave();
    await settings.updateProviderModels("openai", modelSelect.value);
  };

  apiKeyInput.addEventListener("blur", () => {
    void (async () => {
      await settings.autoSave();
      if (providerSelect.value === "openai") {
        await checkOpenAIKey();
      }
    })();
  });

  for (const id of ["ai-openai-base-url", "ai-openai-custom-model"]) {
    getById<HTMLInputElement>(id).addEventListener("change", () => {
      void checkOpenAIKey();
    });
  }

  apiKeyInput.addEventListener("input", (event) => {
    const val = getInputEventValue(event).trim();
    if (
      providerSelect.value === "openai" &&
      ((val.startsWith("sk-") && val.length > 20) || val.length >= 40)
    ) {
      void checkOpenAIKey();
    }
  });

  keepContextInput.addEventListener("change", () => {
    void settings.autoSave();
  });

  let reloadingOpenCode = false;
  const reloadOpenCodeModels = async () => {
    if (reloadingOpenCode) return;
    reloadingOpenCode = true;
    try {
      const nextSettings = {
        opencodeUrl: opencodeUrlInput.value,
        opencodePassword: opencodePasswordInput.value
      };
      state.opencodeModelCache = { key: "", models: [] };
      await settings.autoSave();
      if (isOpenCodeProvider(providerSelect.value)) {
        await settings.updateProviderModels(
          providerSelect.value,
          modelSelect.value,
          nextSettings
        );
      }
    } finally {
      reloadingOpenCode = false;
    }
  };

  const checkPairLink = (value: string) => {
    if (getOpenCodeApiVersion(providerSelect.value) !== "v2") {
      return;
    }
    if (parseOpenCodePairLink(value)) {
      void reloadOpenCodeModels();
    }
  };

  opencodePasswordInput.addEventListener("blur", () => {
    void reloadOpenCodeModels();
  });
  opencodeUrlInput.addEventListener("blur", () => {
    void reloadOpenCodeModels();
  });
  opencodePasswordInput.addEventListener("input", (event) => {
    checkPairLink(getInputEventValue(event));
  });
  opencodeUrlInput.addEventListener("input", (event) => {
    checkPairLink(getInputEventValue(event));
  });

  opacitySlider.addEventListener("input", (event) => {
    getById<HTMLSpanElement>("ai-opacity-value").textContent =
      `${getInputEventValue(event)}%`;
    chatbox.style.opacity = `${parseInt(getInputEventValue(event), 10) / 100}`;
    void settings.autoSave();
  });

  buttonOpacitySlider.addEventListener("input", (event) => {
    getById<HTMLSpanElement>("ai-btn-opacity-value").textContent =
      `${getInputEventValue(event)}%`;
    aiButton.style.opacity = `${parseInt(getInputEventValue(event), 10) / 100}`;
    void settings.autoSave();
  });

  getById<HTMLButtonElement>("ai-chatbox-send").addEventListener(
    "click",
    () => {
      void chat.send();
    }
  );
  getById<HTMLButtonElement>("ai-quiz-screenshot-btn").addEventListener(
    "click",
    () => {
      void chat.runQuizScreenshot();
    }
  );
  getById<HTMLButtonElement>("ai-chatbox-reset").addEventListener(
    "click",
    () => {
      void chat.reset();
    }
  );
  chatboxInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void chat.send();
    }
  });
  getById<HTMLButtonElement>("ai-remove-image").addEventListener(
    "click",
    images.remove
  );
  getById<HTMLButtonElement>("ai-attach-image-btn").addEventListener(
    "click",
    images.openPicker
  );
}
