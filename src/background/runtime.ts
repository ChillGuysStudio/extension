import {
  callAIStudio,
  callAnthropic,
  callGrok,
  callOpenAI,
  callOpenRouter,
  callVertexAI,
  getOpenAIModels
} from "./providers";
import {
  callOpenCode,
  getOpenCodeModels,
  restartOpenCodeSession
} from "./opencode";
import {
  callOpenCodeV2,
  getOpenCodeV2Models,
  pairOpenCodeV2,
  restartOpenCodeV2Session
} from "./opencode-v2";

interface RuntimeRequest {
  type: string;
  apiKey?: string;
  openaiBaseUrl?: string;
  requestBody?: Record<string, unknown> & { parts?: unknown[] };
  provider?: string;
  opencodeConfig?: { baseUrl?: string; password?: string };
  opencodePairUrl?: string;
  apiVersion?: string;
  pageKey?: string;
  requestId?: string;
  keepContext?: boolean;
}

export function setupRuntimeMessages(): void {
  browser.runtime.onMessage.addListener((request: RuntimeRequest) => {
    if (request.type === "getSyncKey") {
      return browser.storage.local
        .get(["geminiApiKey", "apiProvider"])
        .then((result) => ({
          syncKey: (result.geminiApiKey as string | undefined) || null,
          provider: (result.apiProvider as string | undefined) || "aistudio"
        }));
    }

    if (request.type === "getOpenCodeModels") {
      const loadModels =
        request.apiVersion === "v2" ? getOpenCodeV2Models : getOpenCodeModels;

      return loadModels(request.opencodeConfig)
        .then((data) => ({
          success: true,
          models: data.models,
          defaultModel: data.defaultModel || ""
        }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (request.type === "getOpenAIModels") {
      return getOpenAIModels(request.apiKey || "", request.openaiBaseUrl)
        .then((data) => ({
          success: true,
          models: data.models,
          defaultModel: data.defaultModel || ""
        }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (request.type === "pairOpenCodeV2") {
      return pairOpenCodeV2(request.opencodePairUrl || "")
        .then((data) => ({
          success: true,
          baseUrl: data.baseUrl,
          password: data.password
        }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (request.type === "restartOpenCodeSession") {
      return Promise.all([
        restartOpenCodeSession(request.pageKey),
        restartOpenCodeV2Session(request.pageKey)
      ])
        .then(() => ({ success: true }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (request.type === "captureTab") {
      return browser.tabs
        .captureVisibleTab(undefined, { format: "png" })
        .then((dataUrl) => ({
          success: true,
          base64: dataUrl.replace(/^data:image\/png;base64,/, ""),
          mimeType: "image/png"
        }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (
      request.type !== "sendToAPI" ||
      !request.requestId ||
      !request.requestBody
    ) {
      return undefined;
    }

    const selectedProvider = request.provider || "aistudio";
    let apiCall: Promise<string>;
    switch (selectedProvider) {
      case "openai":
        apiCall = callOpenAI(
          request.apiKey || "",
          request.requestBody,
          request.openaiBaseUrl
        );
        break;
      case "anthropic":
        apiCall = callAnthropic(request.apiKey || "", request.requestBody);
        break;
      case "openrouter":
        apiCall = callOpenRouter(request.apiKey || "", request.requestBody);
        break;
      case "grok":
        apiCall = callGrok(request.apiKey || "", request.requestBody);
        break;
      case "opencode":
        apiCall = callOpenCode(
          request.opencodeConfig,
          request.requestBody,
          request.pageKey,
          request.keepContext !== false
        );
        break;
      case "opencode-v2":
        apiCall = callOpenCodeV2(
          request.opencodeConfig,
          request.requestBody,
          request.pageKey,
          request.keepContext !== false
        );
        break;
      case "vertex":
        apiCall = callVertexAI(request.apiKey || "", request.requestBody);
        break;
      case "aistudio":
      default:
        apiCall = callAIStudio(request.apiKey || "", request.requestBody);
        break;
    }

    void apiCall
      .then((text) =>
        browser.storage.local.set({
          [request.requestId as string]: { success: true, text }
        })
      )
      .catch((error: unknown) =>
        browser.storage.local.set({
          [request.requestId as string]: {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        })
      );

    return Promise.resolve({ received: true });
  });
}
