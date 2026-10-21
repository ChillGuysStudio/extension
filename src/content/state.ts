import type { OverlayState } from "./types";

export function createOverlayState(): OverlayState {
  return {
    isOpen: false,
    settingsOpen: false,
    settingsLoaded: false,
    currentImageBase64: null,
    currentImageMimeType: null,
    settingsMinHeight: 354,
    opencodeModelCache: { key: "", models: [] },
    openaiModelCache: { key: "", models: [] },
    resizeCornerVertical: "top",
    resizeCornerHorizontal: "left",
    resizeAnchorX: 0,
    resizeAnchorY: 0,
    isDragging: false,
    dragMoved: false,
    dragStartX: 0,
    dragStartY: 0,
    btnStartLeft: 0,
    btnStartTop: 0,
    isResizing: false,
    viewportNormalizeTimer: null,
    isMobile: false
  };
}
