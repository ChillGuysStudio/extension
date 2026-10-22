import type { ContextMessage } from "./messages";
import type { PendingRequest, StoredSettings } from "./types";
import {
  getOpenCodeApiVersion,
  isOpenCodeProvider,
  normalizeOpenCodeUrl
} from "../shared/opencode";
import {
  isReasoningModel,
  getOpenAITokenLimit,
  isCustomOpenAIBaseUrl
} from "../shared/openai";
import { getGeminiThinkingConfig } from "../shared/gemini";

interface SendToAIOptions {
  text: string;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  settings: StoredSettings;
  contextMessages: ContextMessage[];
  getPageSessionKey: () => string;
  pendingRequests: Map<string, PendingRequest>;
}

export function imageFilenameForMime(mimeType: string): string {
  const map = {
    "image/jpeg": "image.jpg",
    "image/png": "image.png",
    "image/webp": "image.webp",
    "image/gif": "image.gif",
    "image/bmp": "image.bmp",
    "image/heic": "image.heic",
    "image/heif": "image.heif"
  };
  return map[mimeType] || "image.bin";
}

export function buildRequestBody(
  provider: string,
  model: string | null,
  contextMessages: ContextMessage[],
  keepContext: boolean,
  text: string,
  imageBase64: string | null,
  imageMimeType: string | null,
  reasoningEffort?: string,
  openaiBaseUrl?: string,
  thinkingLevel?: string
): Record<string, unknown> {
  const instruction =
    "You are a helpful AI assistant. Respond using Markdown formatting where appropriate: use **bold**, *italic*, `inline code`, ```code blocks```, bullet lists, numbered lists, and headers. For short factual answers (a letter, number, or single word) just reply directly without extra markup.";

  const userText = text
    ? "Question: " + text
    : "What is the correct answer to this question shown in the image?";
  const previousMessages = keepContext ? contextMessages : [];

  if (provider === "aistudio" || provider === "vertex") {
    const modelId = model || "gemini-3.1-pro-preview";
    type GeminiPart =
      | { text: string }
      | { inline_data: { mime_type: string; data: string } };
    const contents: Array<{
      role: "user" | "model";
      parts: GeminiPart[];
    }> = previousMessages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.text }]
    }));
    const parts: GeminiPart[] = [];
    if (imageBase64 && imageMimeType) {
      parts.push({
        inline_data: { mime_type: imageMimeType, data: imageBase64 }
      });
    }
    parts.push({ text: userText });
    const thinkingConfig = getGeminiThinkingConfig(modelId, thinkingLevel);
    return {
      _geminiModel: modelId,
      systemInstruction: { parts: [{ text: instruction }] },
      contents: contents.concat([{ role: "user", parts }]),
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: thinkingConfig ? 8192 : 2048,
        ...(thinkingConfig ? { thinkingConfig } : {})
      }
    };
  }

  if (provider === "openai" || provider === "openrouter") {
    const messages: Array<{
      role: string;
      content: string | Array<Record<string, unknown>>;
    }> = [{ role: "system", content: instruction }];
    previousMessages.forEach((message) => {
      messages.push({ role: message.role, content: message.text });
    });
    const userContent: Array<Record<string, unknown>> = [];
    if (imageBase64 && imageMimeType) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
      });
    }
    userContent.push({ type: "text", text: userText });
    messages.push({ role: "user", content: userContent });

    const defaultModel =
      provider === "openai" ? "gpt-6.1-sol" : "google/gemini-3.1-pro-preview";
    const selectedModel = model || defaultModel;

    if (provider === "openai") {
      const isReasoning = isReasoningModel(selectedModel);
      const tokenLimit = getOpenAITokenLimit(selectedModel, reasoningEffort);
      const payload: Record<string, unknown> = {
        model: selectedModel,
        messages,
        ...(isCustomOpenAIBaseUrl(openaiBaseUrl) && !isReasoning
          ? { max_tokens: 2048 }
          : { max_completion_tokens: tokenLimit })
      };

      if (!isReasoning) {
        payload.temperature = 0.1;
      }

      if (isReasoning && reasoningEffort && reasoningEffort !== "default") {
        payload.reasoning_effort = reasoningEffort;
      }

      return payload;
    }

    return {
      model: selectedModel,
      messages,
      temperature: 0.1,
      max_tokens: 2048
    };
  }

  if (provider === "grok") {
    const selectedModel = model || "grok-4-fast-reasoning";
    const messages: Array<{
      role: string;
      content: string | Array<Record<string, unknown>>;
    }> = [{ role: "system", content: instruction }];
    previousMessages.forEach((message) => {
      messages.push({ role: message.role, content: message.text });
    });
    const userContent: Array<Record<string, unknown>> = [];
    if (imageBase64 && imageMimeType) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
      });
    }
    userContent.push({ type: "text", text: userText });
    messages.push({ role: "user", content: userContent });

    return {
      model: selectedModel,
      messages,
      stream: false,
      temperature: 0,
      max_tokens: 2048
    };
  }

  if (provider === "anthropic") {
    type AnthropicContent =
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: string;
            data: string;
          };
        }
      | { type: "text"; text: string };
    const messages: Array<{
      role: "user" | "assistant";
      content: AnthropicContent[];
    }> = previousMessages.map((message) => ({
      role: message.role,
      content: [{ type: "text", text: message.text }]
    }));
    const userContent: AnthropicContent[] = [];
    if (imageBase64 && imageMimeType) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imageMimeType,
          data: imageBase64
        }
      });
    }
    userContent.push({ type: "text", text: userText });
    return {
      model: model || "claude-sonnet-4-6",
      max_tokens: 2048,
      system: instruction,
      messages: messages.concat([{ role: "user", content: userContent }])
    };
  }

  if (provider === "opencode") {
    const parts: Array<Record<string, unknown>> = [];
    if (imageBase64 && imageMimeType) {
      parts.push({
        type: "file",
        mime: imageMimeType,
        filename: imageFilenameForMime(imageMimeType),
        url: `data:${imageMimeType};base64,${imageBase64}`
      });
    }
    parts.push({ type: "text", text: userText });

    const body: Record<string, unknown> = {
      system: instruction,
      parts
    };

    if (model && model.includes("/")) {
      const splitIndex = model.indexOf("/");
      body.model = {
        providerID: model.slice(0, splitIndex),
        modelID: model.slice(splitIndex + 1)
      };
    }

    return body;
  }

  if (provider === "opencode-v2") {
    const files: Array<Record<string, unknown>> = [];
    if (imageBase64 && imageMimeType) {
      files.push({
        uri: `data:${imageMimeType};base64,${imageBase64}`,
        name: imageFilenameForMime(imageMimeType)
      });
    }

    const body: Record<string, unknown> = {
      system: instruction,
      text: userText
    };

    if (files.length > 0) {
      body.files = files;
    }

    if (model && model.includes("/")) {
      const splitIndex = model.indexOf("/");
      const modelRef: Record<string, unknown> = {
        providerID: model.slice(0, splitIndex),
        id: model.slice(splitIndex + 1)
      };
      if (thinkingLevel && thinkingLevel !== "default") {
        modelRef.variant = thinkingLevel;
      }
      body.model = modelRef;
    }

    return body;
  }

  return {};
}

export async function sendToAI({
  text,
  imageBase64 = null,
  imageMimeType = null,
  settings,
  contextMessages,
  getPageSessionKey,
  pendingRequests
}: SendToAIOptions): Promise<string> {
  const { key: apiKey, provider, model } = settings;
  if (
    provider === "openai" &&
    isCustomOpenAIBaseUrl(settings.openaiBaseUrl) &&
    !settings.openaiCustomModel &&
    !model
  ) {
    throw new Error("Select a model or enter a custom model ID in settings.");
  }
  if (
    !isOpenCodeProvider(provider) &&
    !apiKey &&
    !(provider === "openai" && isCustomOpenAIBaseUrl(settings.openaiBaseUrl))
  ) {
    throw new Error("API key not configured. Click ⚙️ to set up.");
  }

  const requestBody = buildRequestBody(
    provider,
    provider === "openai" ? settings.openaiCustomModel || model : model,
    contextMessages,
    settings.keepContext,
    text,
    imageBase64,
    imageMimeType,
    provider === "openai" ? settings.openaiReasoningEffort : undefined,
    settings.openaiBaseUrl,
    settings.thinkingLevel
  );
  const apiVersion = getOpenCodeApiVersion(provider);
  const opencodeConfig = {
    baseUrl: normalizeOpenCodeUrl(settings.opencodeUrl, apiVersion),
    password: settings.opencodePassword || ""
  };

  const requestId = Math.random().toString(36).slice(2) + Date.now();
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("Request timed out. Please try again."));
      }
    }, 180000);

    pendingRequests.set(requestId, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });

    void browser.runtime
      .sendMessage({
        type: "sendToAPI",
        requestId,
        apiKey,
        openaiBaseUrl:
          provider === "openai" ? settings.openaiBaseUrl : undefined,
        requestBody,
        provider,
        opencodeConfig,
        pageKey: getPageSessionKey(),
        keepContext: settings.keepContext
      })
      .catch(() => {
        const pending = pendingRequests.get(requestId);
        if (pending) {
          pendingRequests.delete(requestId);
          pending.reject(
            new Error(
              "Could not reach background script. Try reloading the page."
            )
          );
        }
      });
  });
}
