import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test
} from "bun:test";
import { Window } from "happy-dom";
import type { ChoiceAutoFillPlan } from "../src/content/quiz-autofill";
import { armChoiceHoverSelection } from "../src/content/quiz-hover";

const testWindow = new Window({ url: "https://example.test" });
const globalNames = ["window", "document", "Event"] as const;
const originalGlobals = new Map<string, unknown>();

for (const name of globalNames) {
  originalGlobals.set(name, (globalThis as Record<string, unknown>)[name]);
}

beforeAll(() => {
  for (const name of globalNames) {
    (globalThis as Record<string, unknown>)[name] =
      name === "window" ? testWindow : testWindow[name as "document" | "Event"];
  }
});

afterAll(() => {
  for (const name of globalNames) {
    const original = originalGlobals.get(name);
    if (original === undefined) {
      delete (globalThis as Record<string, unknown>)[name];
    } else {
      (globalThis as Record<string, unknown>)[name] = original;
    }
  }
});

beforeEach(() => {
  testWindow.document.body.innerHTML = "";
});

function createChoiceInputs(
  type: "radio" | "checkbox",
  count: number
): HTMLInputElement[] {
  testWindow.document.body.innerHTML = Array.from(
    { length: count },
    (_, index) =>
      `<div class="option"><label><input type="${type}" name="question" value="${index}"> Option ${index + 1}</label></div>`
  ).join("");

  return Array.from(
    testWindow.document.querySelectorAll<HTMLInputElement>(
      `input[type="${type}"]`
    )
  );
}

function hover(element: Element, pointerType = "mouse"): void {
  const event = new testWindow.Event("pointerenter");
  Object.defineProperty(event, "pointerType", { value: pointerType });
  element.dispatchEvent(event);
}

function createChoicePlan(
  mode: ChoiceAutoFillPlan["mode"],
  targets: HTMLInputElement[]
): ChoiceAutoFillPlan {
  return { kind: "choices", mode, targets };
}

describe("armChoiceHoverSelection", () => {
  test("selects the correct single-choice option when its label is hovered", () => {
    const inputs = createChoiceInputs("radio", 3);
    const session = armChoiceHoverSelection(
      createChoicePlan("single_choice", [inputs[1]])
    );

    hover(inputs[0].closest("label") as HTMLLabelElement);
    expect(inputs[0].checked).toBe(false);
    expect(inputs[1].checked).toBe(false);

    hover(inputs[1].closest("label") as HTMLLabelElement);
    expect(inputs[1].checked).toBe(true);

    session.dispose();
  });

  test("stops listening after a single-choice selection", () => {
    const inputs = createChoiceInputs("radio", 3);
    const label = inputs[1].closest("label") as HTMLLabelElement;
    armChoiceHoverSelection(createChoicePlan("single_choice", [inputs[1]]));

    hover(label);
    expect(inputs[1].checked).toBe(true);

    inputs[1].checked = false;
    hover(label);
    expect(inputs[1].checked).toBe(false);
  });

  test("selects each correct multiple-choice option as it is hovered", () => {
    const inputs = createChoiceInputs("checkbox", 4);
    const session = armChoiceHoverSelection(
      createChoicePlan("multiple_choice", [inputs[0], inputs[2], inputs[3]])
    );

    hover(inputs[1].closest("label") as HTMLLabelElement);
    expect(inputs.every((input) => !input.checked)).toBe(true);

    hover(inputs[0].closest("label") as HTMLLabelElement);
    expect(inputs[0].checked).toBe(true);

    hover(inputs[2].closest("label") as HTMLLabelElement);
    expect(inputs[2].checked).toBe(true);

    hover(inputs[3].closest("label") as HTMLLabelElement);
    expect(inputs[3].checked).toBe(true);

    session.dispose();
  });

  test("does not select on touch pointer events", () => {
    const inputs = createChoiceInputs("checkbox", 3);
    const session = armChoiceHoverSelection(
      createChoicePlan("multiple_choice", [inputs[1]])
    );

    hover(inputs[1].closest("label") as HTMLLabelElement, "touch");
    expect(inputs[1].checked).toBe(false);

    session.dispose();
  });

  test("removes listeners when disposed", () => {
    const inputs = createChoiceInputs("radio", 3);
    const session = armChoiceHoverSelection(
      createChoicePlan("single_choice", [inputs[1]])
    );

    session.dispose();
    hover(inputs[1].closest("label") as HTMLLabelElement);
    expect(inputs[1].checked).toBe(false);
  });

  test("does nothing when the answer is already selected", () => {
    const inputs = createChoiceInputs("checkbox", 3);
    inputs[1].checked = true;
    armChoiceHoverSelection(createChoicePlan("multiple_choice", [inputs[1]]));

    inputs[1].checked = false;
    hover(inputs[1].closest("label") as HTMLLabelElement);
    expect(inputs[1].checked).toBe(false);
  });

  test("uses an external label associated with the input", () => {
    testWindow.document.body.innerHTML = `
      <input id="option-2" type="radio" name="question" value="2">
      <label for="option-2">Option 2</label>
      <input id="option-1" type="radio" name="question" value="1">
      <label for="option-1">Option 1</label>
    `;
    const input = testWindow.document.getElementById(
      "option-2"
    ) as HTMLInputElement;
    const label = testWindow.document.querySelector(
      'label[for="option-2"]'
    ) as HTMLLabelElement;
    const session = armChoiceHoverSelection(
      createChoicePlan("single_choice", [input])
    );

    hover(label);

    expect(input.checked).toBe(true);
    session.dispose();
  });
});
