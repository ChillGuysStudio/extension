<div align="center">

<h1>Clipboard Manager — Firefox Extension</h1>

<p>A floating AI chat assistant, quiz auto-answerer, and image analyzer.<br>Disguised as a clipboard manager. Hidden behind a 20 px button.</p>

[![Version](https://img.shields.io/badge/version-4.5.0-18181b)](https://github.com/chillguysstudio/extension/releases/latest)
[![Firefox](https://img.shields.io/badge/Firefox-Extension-FF7139?logo=firefox-browser&logoColor=white)](https://github.com/chillguysstudio/extension/releases/latest)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

**Website → [chillguysstudio/extension_website](https://github.com/chillguysstudio/extension_website)**

</div>

---

## Installation

**[⬇ Download extension.xpi](https://github.com/chillguysstudio/extension/releases/latest/download/extension.xpi)**

1. Click the link above
2. Firefox prompts you to add the extension — click **Add**
3. Open settings from the floating button, enter your API key for any provider, and start chatting

Updates are delivered automatically via the built-in update manifest — no reinstall needed.

---

## What it actually is

The extension shows up in Firefox as a clipboard manager. That cover holds: it saves text snippets from the toolbar popup, lets you copy them back with one click, and deduplicates entries.

What it also is: a full AI chat assistant injected into every page as a draggable, resizable floating window — invisible until you need it. The same 20 px button hides the entry point to:

- A persistent AI chat with full markdown and LaTeX rendering
- One-shortcut quiz screenshot answer
- One-shortcut quiz DOM autofill with hover-to-select choices
- Image analysis via drag-and-drop or attachment
- 7 AI providers switchable at any time without leaving the page

Everything runs locally in the browser. No proxy, no logging, no external data collection beyond your chosen AI provider's API.

---

## AI Providers

| Provider                | Auth                                  | Models                                                                                                  |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Google AI Studio**    | API Key                               | Gemini 3.1 Pro Preview, Gemini 3 Flash Preview, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite |
| **Vertex AI**           | API Key                               | Same Gemini model list via `aiplatform.googleapis.com`                                                  |
| **OpenAI / compatible** | API Key (optional for custom servers) | OpenAI models, or models discovered from a custom OpenAI-compatible API                                 |
| **Anthropic**           | API Key                               | Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5                                                    |
| **OpenRouter**          | API Key                               | Gemini, GPT-5.2, Claude, Qwen 3.5 122B, Llama 3.3 70B, DeepSeek R1, and hundreds more                   |
| **Grok**                | API Key                               | Grok 4 Fast Reasoning, Grok 4, Grok 3, Grok 3 Mini                                                      |
| **OpenCode**            | URL + optional password               | Models fetched dynamically from a self-hosted v1 server (`http://127.0.0.1:4096`)                       |
| **OpenCode v2**         | Pair link or URL + password/token     | Models fetched dynamically from a self-hosted v2 server (port varies; check `opencode2 service status`) |

OpenCode v1 and v2 share the same settings section. Pick the provider that matches your
running server.
For v2, run `opencode2 pair` (or `opencode pair` when v2 is installed as `opencode`)
and paste the link into **OpenCode Server URL or Pair Link**. The extension redeems
it and stores the server URL and pairing token automatically. Alternatively, enter
the server URL and its plain `OPENCODE_SERVER_PASSWORD` in **Server Password or
Pairing Token**. Use `opencode2 service status` to find the actual server URL;
do not assume its dynamically assigned port is always 49374.

For an OpenAI-compatible server, select **OpenAI (GPT)** and set **OpenAI-compatible
API Base URL**, for example `http://localhost:1234/v1`. Include the API prefix
required by your server; `/models` and `/chat/completions` are appended to it.
Leave this field empty for the official OpenAI API. Custom servers retain their
own model IDs (including non-OpenAI models) and may omit authentication. If model
discovery is unavailable, enter **Custom model ID** manually; it overrides the
model dropdown. Leave that field empty to use the dropdown again.

API keys are stored in browser local storage only. Nothing is proxied or logged by the extension.

---

## Features

### AI Chat

- Floating chat window injected into every page — invisible until toggled
- Full markdown rendering: code blocks, tables, lists, blockquotes, inline code
- KaTeX for inline (`$...$`) and display (`$$...$$`) math expressions
- Persistent conversation history across page navigations and browser restarts
- Configurable context window — optionally send full history with each request
- Selectable thinking level for Gemini models and OpenCode v2 model variants
- `/reset` slash command to wipe message history and start fresh
- Adjustable UI opacity for both the floating button and the chatbox

### Quiz Auto-Answer

**Screenshot mode** (`Alt+Q`)

Captures the visible page with `html2canvas` and sends it to the AI. Returns the answer in the exact format the question requires — single letter, number, or short text. The prompt handles single-choice, multiple-choice, and free-text questions, and focuses on the most fully visible question when multiple appear on screen.

**DOM autofill mode** (`Alt+Shift+Q`)

Detects every interactive input from the page HTML — radio buttons, checkboxes, `<select>` dropdowns, and text inputs — and sends that input context along with the screenshot. For radio buttons and checkboxes, the answer is applied only when you hover the matching option: single-choice selects on the first correct hover, while multiple-choice selects each correct option as you hover it. Dropdowns and text inputs fill immediately. Works on structured quiz platforms where the DOM contains the question text and answer options.

### Image Analysis

- Drag-and-drop images onto the chat or use the attachment button
- Images are base64-encoded and sent to the selected provider
- Works with any vision-capable model (Gemini, GPT-4o, Claude, Grok)

### Keyboard Shortcuts

| Shortcut      | Action                                            |
| ------------- | ------------------------------------------------- |
| `Alt+C`       | Toggle the floating chat window open / closed     |
| `Alt+Q`       | Screenshot the current page and get a quiz answer |
| `Alt+Shift+Q` | Read the DOM and prepare hover-to-select answers  |

Shortcuts use `Alt` only — no `Ctrl` or `⌘` — to avoid clashing with browser and OS bindings. They fire on `keydown` and are suppressed when focus is inside a text field.

### UI & UX

- **Draggable button** — move the 20 px entry point anywhere on screen; position persists in storage
- **Resizable chatbox** — drag from any of the four corners to resize; size persists in storage
- **Auto dark mode** — detects page background luminance and switches to a full dark zinc palette automatically
- **Toast notifications** — confirm copy actions in the clipboard popup
- **Duplicate deduplication** — saving a duplicate moves it to the top instead of creating a second entry

### Clipboard Manager (the cover)

- Save text snippets from the toolbar popup
- One-click copy back to clipboard
- Delete individual items or clear all at once
- Persists in browser local storage across sessions

---

## Keyboard Reference

```
Alt + C              → Toggle chat
Alt + Q              → Screenshot quiz answer
Alt + Shift + Q      → DOM quiz answer, hover choices to apply
/reset  (in chat)    → Clear conversation history
```

---

## Source Structure

```
src/
├── background/
│   ├── index.ts          # Background service worker entry
│   ├── lifecycle.ts      # Install / update lifecycle hooks
│   ├── opencode.ts       # OpenCode v1 provider relay
│   ├── opencode-v2.ts    # OpenCode v2 provider relay
│   ├── providers.ts      # All provider API call implementations
│   └── runtime.ts        # Message routing to providers
├── content/
│   ├── index.ts          # Content script entry — bootstraps everything
│   ├── app.ts            # Top-level coordinator
│   ├── chat.ts           # Chat message send / receive logic
│   ├── dom.ts            # Chatbox and button DOM construction
│   ├── layout.ts         # Drag, resize, position persistence
│   ├── markdown.ts       # Marked + KaTeX rendering pipeline
│   ├── messages.ts       # Message history management
│   ├── overlay.ts        # Screenshot overlay for quiz capture
│   ├── quiz.ts           # Screenshot quiz — prompt + controller
│   ├── quiz-autofill.ts  # DOM autofill — input detection + filling
│   ├── quiz-autofill-controller.ts
│   ├── quiz-hover.ts     # Hover-to-select behavior for choice answers
│   ├── quiz-shared.ts    # Shared quiz request logic
│   ├── requests.ts       # Provider request builders
│   ├── settings.ts       # Settings panel + storage
│   ├── state.ts          # Shared runtime state
│   ├── theme.ts          # Auto dark mode via luminance detection
│   ├── images.ts         # Image attachment + base64 encoding
│   ├── events/           # Event handler modules (drag, images, runtime, settings)
│   ├── constants.ts      # Provider model lists and labels
│   ├── types.ts          # Shared TypeScript types
│   └── utils.ts          # Utility helpers
├── popup/
│   └── index.ts          # Toolbar popup — clipboard manager UI
├── shared/
│   ├── gemini.ts         # Gemini thinking levels and budgets
│   ├── openai.ts         # OpenAI model catalog and token limits
│   └── opencode.ts       # OpenCode shared constants
└── globals.d.ts          # Browser / WebExtension type declarations
```

---

## Development

**Prerequisites:** [Bun](https://bun.sh) and Firefox.

```sh
# Install dependencies
bun install

# Production build → dist/
bun run build

# Watch mode (rebuilds all entry points on change)
bun run dev

# Type-check without emitting
bun run typecheck

# Unit tests
bun test

# Lint
bun run lint
bun run lint:fix

# Format
bun run format
bun run format:check
```

### Loading in Firefox

1. Run `bun run build`
2. Open `about:debugging` → **This Firefox**
3. Click **Load Temporary Add-on...**
4. Select `manifest.json` from the repo root

### Build outputs

Three Vite configs produce three separate bundles:

| Config                      | Output          | Purpose                           |
| --------------------------- | --------------- | --------------------------------- |
| `vite.background.config.ts` | `background.js` | Background service worker         |
| `vite.content.config.ts`    | `content.js`    | Content script (chat, quiz, AI)   |
| `vite.popup.config.ts`      | `popup.js`      | Toolbar popup (clipboard manager) |

---

## Publishing a Release

Requires `web-ext`, `gh` CLI, and a `.env` file with AMO credentials.

```sh
# Bump version in manifest.json, then:
bash publish.sh
```

Signs via AMO API → updates `updates.json` → pushes to GitHub → creates a GitHub Release with the signed `.xpi`.

---

## Privacy

- All AI API keys are stored in browser local storage only
- Requests go directly from the browser to the chosen AI provider's API
- No data is collected, proxied, or transmitted by this extension
- No analytics, no telemetry

---

## License

MIT
