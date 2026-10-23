export interface OverlayElements {
  aiButton: HTMLButtonElement;
  chatbox: HTMLDivElement;
}

export interface Position {
  left: number;
  top: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ViewportBounds extends Position, Size {}

export interface LayoutResult extends Position {
  buttonLeft: number;
  buttonTop: number;
  chatLeft: number;
  chatTop: number;
  isAbove: boolean;
  isButtonLeft: boolean;
}

export interface SizeLimits {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export interface ModelOption {
  value: string;
  label: string;
  thinkingLevels?: string[];
}

export interface ModelCache {
  key: string;
  models: ModelOption[];
}

export interface StoredSettings {
  key: string | null;
  provider: string;
  model: string | null;
  keepContext: boolean;
  opencodeUrl: string;
  opencodePassword: string;
  openaiReasoningEffort?: string;
  openaiBaseUrl?: string;
  openaiCustomModel?: string;
  thinkingLevel?: string;
  opacity: number;
  btnOpacity: number;
  chatWidth: number;
  chatHeight: number;
}

export interface PendingRequest {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

export interface OpenCodeConfig {
  baseUrl: string;
  password: string;
}

export interface OpenCodeModelsResponse {
  success: boolean;
  models?: ModelOption[];
  defaultModel?: string;
  error?: string;
}

export interface OpenAIModelsResponse {
  success: boolean;
  models?: ModelOption[];
  defaultModel?: string;
  error?: string;
}

export interface CaptureTabResponse {
  success: boolean;
  base64?: string;
  mimeType?: string;
  error?: string;
}

export interface OverlayState {
  isOpen: boolean;
  settingsOpen: boolean;
  settingsLoaded: boolean;
  currentImageBase64: string | null;
  currentImageMimeType: string | null;
  settingsMinHeight: number;
  opencodeModelCache: ModelCache;
  openaiModelCache: ModelCache;
  resizeCornerVertical: "top" | "bottom";
  resizeCornerHorizontal: "left" | "right";
  resizeAnchorX: number;
  resizeAnchorY: number;
  isDragging: boolean;
  dragMoved: boolean;
  dragStartX: number;
  dragStartY: number;
  btnStartLeft: number;
  btnStartTop: number;
  isResizing: boolean;
  viewportNormalizeTimer: number | null;
  isMobile: boolean;
}
