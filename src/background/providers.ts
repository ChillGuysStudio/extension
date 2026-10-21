import { filterAndSortOpenAIModels } from "../shared/openai";
import type { ModelOption } from "../shared/openai";

function getProviderErrorMessage(text, status) {
  if (!text) return `Request failed: ${status}`;
  try {
    const err = JSON.parse(text);
    return err.error?.message || `Request failed: ${status}`;
  } catch {
    return `Request failed: ${status} ${text}`;
  }
}

export function callGemini(apiKey, requestBody) {
  const model = requestBody._geminiModel || "gemini-3.1-pro-preview";
  const body = Object.assign({}, requestBody);
  delete body._geminiModel;

  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  )
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(getProviderErrorMessage(text, response.status));
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const textPart = data.candidates[0].content.parts.find((p) => p.text);
        if (textPart) return textPart.text;
      }
      throw new Error("No response generated");
    });
}

// Google AI Studio — same endpoint as Gemini Developer API
export function callAIStudio(apiKey, requestBody) {
  return callGemini(apiKey, requestBody);
}

// Vertex AI Express Mode — uses aiplatform.googleapis.com with just an API key
export function callVertexAI(apiKey, requestBody) {
  const model = requestBody._geminiModel || "gemini-2.5-flash";
  const body = Object.assign({}, requestBody);
  delete body._geminiModel;

  return fetch(
    `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  )
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(getProviderErrorMessage(text, response.status));
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const textPart = data.candidates[0].content.parts.find((p) => p.text);
        if (textPart) return textPart.text;
      }
      throw new Error("No response generated");
    });
}

function callChatCompletions(url, apiKey, requestBody, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...headers
    },
    body: JSON.stringify(requestBody)
  })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(getProviderErrorMessage(text, response.status));
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      throw new Error("No response generated");
    });
}

export function callOpenAI(apiKey, requestBody) {
  return callChatCompletions(
    "https://api.openai.com/v1/chat/completions",
    apiKey,
    requestBody
  );
}

export async function getOpenAIModels(apiKey: string): Promise<{
  models: ModelOption[];
  defaultModel: string;
}> {
  if (!apiKey) {
    throw new Error("No OpenAI API key provided");
  }

  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(getProviderErrorMessage(text, response.status));
  }

  const data = (await response.json()) as {
    data?: Array<{ id?: string; shutdown_date?: number | string }>;
  };
  const list = Array.isArray(data?.data) ? data.data : [];
  const rawIds = list
    .filter((item) => {
      if (!item?.id) return false;
      if (item.shutdown_date) {
        const shutdownTime =
          typeof item.shutdown_date === "number"
            ? item.shutdown_date * 1000
            : Date.parse(String(item.shutdown_date));
        if (!isNaN(shutdownTime) && shutdownTime <= Date.now()) {
          return false;
        }
      }
      return true;
    })
    .map((item) => item.id as string);

  const models = filterAndSortOpenAIModels(rawIds);
  const defaultModel = models[0]?.value || "gpt-6.1-sol";

  return { models, defaultModel };
}

export function callAnthropic(apiKey, requestBody) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify(requestBody)
  })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(getProviderErrorMessage(text, response.status));
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text;
      }
      throw new Error("No response generated");
    });
}

export function callGrok(apiKey, requestBody) {
  return callChatCompletions(
    "https://api.x.ai/v1/chat/completions",
    apiKey,
    requestBody
  );
}

export function callOpenRouter(apiKey, requestBody) {
  return callChatCompletions(
    "https://openrouter.ai/api/v1/chat/completions",
    apiKey,
    requestBody,
    {
      "HTTP-Referer": "https://else.fcim.utm.md",
      "X-Title": "Quick Notes"
    }
  );
}
