import type { EventBindingsOptions } from "./types";
import { getById, getInputEventValue, queryRequired } from "../utils";
import {
  getOpenCodeApiVersion,
  isOpenCodeProvider,
  parseOpenCodePairLink
} from "../../shared/opencode";

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
    void settings.autoSave();
  });
  apiKeyInput.addEventListener("blur", () => {
    void settings.autoSave();
  });
  keepContextInput.addEventListener("change", () => {
    void settings.autoSave();
  });

  const reloadOpenCodeModels = async () => {
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
