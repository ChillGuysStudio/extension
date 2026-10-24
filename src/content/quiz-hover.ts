import type { ChoiceAutoFillPlan } from "./quiz-autofill";
import { triggerChoiceInput } from "./quiz-autofill";

const HOVER_TIMEOUT_MS = 120_000;

interface HoverListener {
  element: Element;
  listener: (event: Event) => void;
}

export interface ChoiceHoverSession {
  dispose: () => void;
}

interface ChoiceHoverOptions {
  timeoutMs?: number;
}

function getChoiceHoverRegions(input: HTMLInputElement): Element[] {
  const regions = new Set<Element>([input]);

  for (const label of Array.from(input.labels ?? [])) {
    regions.add(label);
  }

  const wrappingLabel = input.closest("label");
  if (wrappingLabel) {
    regions.add(wrappingLabel);
  }

  let ancestor = input.parentElement;
  for (let depth = 0; ancestor && depth < 3; depth += 1) {
    if (ancestor === document.body || ancestor === document.documentElement) {
      break;
    }

    const choiceCount = ancestor.querySelectorAll(
      'input[type="radio"], input[type="checkbox"]'
    ).length;
    if (choiceCount !== 1) {
      break;
    }

    regions.add(ancestor);
    ancestor = ancestor.parentElement;
  }

  return Array.from(regions);
}

export function armChoiceHoverSelection(
  plan: ChoiceAutoFillPlan,
  { timeoutMs = HOVER_TIMEOUT_MS }: ChoiceHoverOptions = {}
): ChoiceHoverSession {
  const targets = plan.targets.filter((target) => target.isConnected);
  const listeners: HoverListener[] = [];
  let disposed = false;
  let timeoutId: number | null = null;

  function isComplete(): boolean {
    return (
      targets.length === 0 ||
      targets.every((target) => !target.isConnected || target.checked)
    );
  }

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    for (const { element, listener } of listeners) {
      element.removeEventListener("pointerenter", listener);
    }
    listeners.length = 0;
    document.removeEventListener("change", handleChange, true);

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function handleChange(): void {
    if (!disposed && isComplete()) {
      dispose();
    }
  }

  function handlePointerEnter(target: HTMLInputElement) {
    return (event: Event): void => {
      if (disposed) {
        return;
      }

      const pointerType = (event as PointerEvent).pointerType;
      if (pointerType && pointerType !== "mouse") {
        return;
      }

      if (!target.isConnected) {
        if (isComplete()) {
          dispose();
        }
        return;
      }

      if (!target.checked) {
        triggerChoiceInput(target);
      }

      if (isComplete()) {
        dispose();
      }
    };
  }

  if (targets.length === 0 || isComplete()) {
    return { dispose };
  }

  for (const target of targets) {
    for (const region of getChoiceHoverRegions(target)) {
      const listener = handlePointerEnter(target);
      region.addEventListener("pointerenter", listener);
      listeners.push({ element: region, listener });
    }
  }

  document.addEventListener("change", handleChange, true);
  timeoutId = window.setTimeout(dispose, timeoutMs);

  return { dispose };
}
