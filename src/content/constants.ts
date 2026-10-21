export { OPENCODE_DEFAULT_URL } from "../shared/opencode";

const GEMINI_MODELS = [
  {
    value: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview (latest)"
  },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (stable)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (stable)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" }
];

export const PROVIDER_MODELS = {
  aistudio: GEMINI_MODELS,
  vertex: GEMINI_MODELS,
  openai: [
    { value: "gpt-5.2", label: "GPT-5.2 (latest)" },
    { value: "gpt-5.2-pro", label: "GPT-5.2 Pro" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
    { value: "gpt-5-nano", label: "GPT-5 Nano" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4o", label: "GPT-4o" }
  ],
  anthropic: [
    { value: "claude-opus-4-6", label: "Claude Opus 4.6 (latest)" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }
  ],
  openrouter: [
    {
      value: "google/gemini-3.1-pro-preview",
      label: "Gemini 3.1 Pro Preview"
    },
    { value: "openai/gpt-5.2", label: "GPT-5.2" },
    { value: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "qwen/qwen3.5-122b-a10b", label: "Qwen 3.5 122B" },
    {
      value: "meta-llama/llama-3.3-70b-instruct",
      label: "Llama 3.3 70B"
    },
    { value: "deepseek/deepseek-r1", label: "DeepSeek R1" }
  ],
  grok: [
    {
      value: "grok-4-fast-reasoning",
      label: "Grok 4 Fast Reasoning (latest)"
    },
    { value: "grok-4", label: "Grok 4" },
    { value: "grok-3", label: "Grok 3" },
    { value: "grok-3-mini", label: "Grok 3 Mini" }
  ]
};

export const PROVIDER_LABELS: Record<string, string> = {
  aistudio: "AI Studio",
  vertex: "Vertex AI",
  openai: "OpenAI",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  grok: "Grok",
  opencode: "OpenCode",
  "opencode-v2": "OpenCode v2"
};

export function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider;
}
