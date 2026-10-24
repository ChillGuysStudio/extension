type QuizKind = "single_choice" | "multiple_choice" | "dropdown" | "input_box";
type TextEntryTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

export interface DropdownSnapshot {
  target: HTMLSelectElement;
  options: Array<{
    index: number;
    text: string;
    value: string;
  }>;
}

export interface QuizDomSnapshot {
  kind: QuizKind;
  choiceTargets: HTMLInputElement[];
  dropdownTargets: HTMLSelectElement[];
  textTargets: TextEntryTarget[];
  dropdowns: DropdownSnapshot[];
}

export interface ChoiceAutoFillPlan {
  kind: "choices";
  mode: "single_choice" | "multiple_choice";
  targets: HTMLInputElement[];
}

export interface DropdownAutoFillPlan {
  kind: "dropdown";
  dropdowns: Array<{
    dropdown: DropdownSnapshot;
    responseLine: string;
  }>;
}

export interface TextAutoFillPlan {
  kind: "text";
  target: TextEntryTarget;
  value: string;
}

export interface EmptyAutoFillPlan {
  kind: "none";
}

export type AutoFillPlan =
  | ChoiceAutoFillPlan
  | DropdownAutoFillPlan
  | TextAutoFillPlan
  | EmptyAutoFillPlan;

export function buildAutoFillPrompt(snapshot: QuizDomSnapshot): string {
  const dropdownContext =
    snapshot.kind === "dropdown" && snapshot.dropdowns.length > 0
      ? `

Visible dropdowns detected in page HTML (top to bottom):
${snapshot.dropdowns
  .map(
    (dropdown, dropdownIndex) =>
      `Dropdown ${dropdownIndex + 1}:\n${dropdown.options
        .map((option) => `  ${option.index}. ${option.text}`)
        .join("\n")}`
  )
  .join("\n\n")}`
      : "";

  return `You are a precise quiz-answering assistant. Your only job is to find and answer the question visible in this screenshot.

The page HTML indicates that the visible quiz input type is: ${snapshot.kind}.${dropdownContext}

RULES - follow them exactly, no exceptions:
1. Do NOT describe, summarize, or comment on the screenshot.
2. Scan the screenshot for questions (quiz, test, exercise, form field, etc.). If multiple questions are visible, focus ONLY on the single question that is most fully visible (least cut off). If multiple questions are equally fully visible, choose the one that appears highest (topmost) in the screenshot.
3. If NO question is found -> respond with exactly: no question found
4. If the quiz type is single_choice -> respond with ONLY one positive integer representing the correct option position in top-to-bottom order (example: 3). No explanation.
5. If the quiz type is multiple_choice -> respond with ONLY the correct option numbers, one number per line, in top-to-bottom order. No explanation.
6. If the quiz type is input_box -> respond with ONLY the shortest correct answer. No explanation.
7. If the quiz type is dropdown -> respond with ONLY one line per dropdown, in top-to-bottom order.
8. Each dropdown line must be either the option number or the exact option text for that dropdown. No explanation.

Begin.`;
}

function isNoQuestionResponse(response: string): boolean {
  return (
    response
      .trim()
      .toLowerCase()
      .replace(/[.!]+$/, "")
      .trim() === "no question found"
  );
}

function isOverlayElement(element: Element | null): boolean {
  return Boolean(
    element?.closest("#moodle-ai-chatbox, #moodle-ai-assistant-btn")
  );
}

function isElementVisible(element: Element): boolean {
  if (isOverlayElement(element)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    style.opacity === "0"
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  return (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth
  );
}

function getVisibleChoiceTargets(
  type: "radio" | "checkbox"
): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(`input[type="${type}"]`)
  ).filter(
    (input) => !input.disabled && !input.readOnly && isElementVisible(input)
  );
}

function getVisibleDropdownTargets(): HTMLSelectElement[] {
  return Array.from(
    document.querySelectorAll<HTMLSelectElement>("select")
  ).filter((select) => !select.disabled && isElementVisible(select));
}

function getDropdownSnapshots(
  targets: HTMLSelectElement[]
): DropdownSnapshot[] {
  return targets.map((target) => ({
    target,
    options: Array.from(target.options)
      .map((option, optionIndex) => ({
        index: optionIndex + 1,
        text: option.textContent?.replace(/\s+/g, " ").trim() || "",
        value: option.value
      }))
      .filter((option) => option.text.length > 0)
  }));
}

function isTextEntryInput(input: HTMLInputElement): boolean {
  const type = (input.getAttribute("type") || "text").toLowerCase();
  return ![
    "hidden",
    "checkbox",
    "radio",
    "button",
    "submit",
    "reset",
    "range",
    "file",
    "image",
    "color",
    "password"
  ].includes(type);
}

function getVisibleTextTargets(): TextEntryTarget[] {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("input")
  ).filter(
    (input) =>
      !input.disabled &&
      !input.readOnly &&
      isTextEntryInput(input) &&
      isElementVisible(input)
  );
  const textareas = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>("textarea")
  ).filter(
    (textarea) =>
      !textarea.disabled && !textarea.readOnly && isElementVisible(textarea)
  );
  const editables = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[contenteditable=""], [contenteditable="true"]'
    )
  ).filter((element) => isElementVisible(element));

  return [...inputs, ...textareas, ...editables];
}

function collectQuestionAnchors(): Element[] {
  const selector = [
    "legend",
    "label",
    "h1",
    "h2",
    "h3",
    "h4",
    "p",
    "span",
    "div"
  ].join(",");

  return Array.from(document.querySelectorAll(selector)).filter((element) => {
    if (isOverlayElement(element) || !isElementVisible(element)) {
      return false;
    }

    const text = element.textContent?.replace(/\s+/g, " ").trim() || "";
    if (text.length < 8 || text.length > 500) {
      return false;
    }

    const descriptor = [
      element.id,
      element.className,
      element.getAttribute("aria-label"),
      element.getAttribute("data-testid")
    ]
      .filter(Boolean)
      .join(" ");

    return /\?|question|prompt|choose|select|answer|complete|fill/i.test(
      `${text} ${descriptor}`
    );
  });
}

function pickClosestTextTarget(
  targets: TextEntryTarget[]
): TextEntryTarget | null {
  if (targets.length === 0) {
    return null;
  }

  if (targets.length === 1) {
    return targets[0];
  }

  const anchors = collectQuestionAnchors();
  if (anchors.length === 0) {
    return targets[0];
  }

  const scored = targets.map((target) => {
    const targetRect = target.getBoundingClientRect();
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const nearestAnchorDistance = anchors.reduce((best, anchor) => {
      const rect = anchor.getBoundingClientRect();
      const anchorCenterX = rect.left + rect.width / 2;
      const anchorCenterY = rect.top + rect.height / 2;
      const distance = Math.hypot(
        targetCenterX - anchorCenterX,
        targetCenterY - anchorCenterY
      );
      return Math.min(best, distance);
    }, Number.POSITIVE_INFINITY);

    return {
      target,
      score: nearestAnchorDistance + Math.max(0, targetRect.top) * 0.2
    };
  });

  scored.sort((left, right) => left.score - right.score);
  return scored[0]?.target || targets[0];
}

export function detectQuizDom(): QuizDomSnapshot {
  const checkboxTargets = getVisibleChoiceTargets("checkbox");
  if (checkboxTargets.length > 0) {
    return {
      kind: "multiple_choice",
      choiceTargets: checkboxTargets,
      dropdownTargets: [],
      textTargets: [],
      dropdowns: []
    };
  }

  const radioTargets = getVisibleChoiceTargets("radio");
  if (radioTargets.length > 0) {
    return {
      kind: "single_choice",
      choiceTargets: radioTargets,
      dropdownTargets: [],
      textTargets: [],
      dropdowns: []
    };
  }

  const dropdownTargets = getVisibleDropdownTargets();
  if (dropdownTargets.length > 0) {
    return {
      kind: "dropdown",
      choiceTargets: [],
      dropdownTargets,
      textTargets: [],
      dropdowns: getDropdownSnapshots(dropdownTargets)
    };
  }

  return {
    kind: "input_box",
    choiceTargets: [],
    dropdownTargets: [],
    textTargets: getVisibleTextTargets(),
    dropdowns: []
  };
}

function parseSingleChoiceAnswer(response: string): number {
  const match = response.match(/\d+/);
  if (!match) {
    throw new Error("AI did not return a valid option number.");
  }

  return Number.parseInt(match[0], 10);
}

function parseMultipleChoiceAnswer(response: string): number[] {
  const numbers = Array.from(response.matchAll(/\d+/g))
    .map((match) => Number.parseInt(match[0], 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  const uniqueNumbers = Array.from(new Set(numbers));
  if (uniqueNumbers.length === 0) {
    throw new Error("AI did not return valid option numbers.");
  }

  return uniqueNumbers;
}

function validateSingleChoiceAnswer(
  snapshot: QuizDomSnapshot,
  selectedNumber: number
): void {
  if (selectedNumber < 1 || selectedNumber > snapshot.choiceTargets.length) {
    throw new Error(
      `AI selected option ${selectedNumber}, but only ${snapshot.choiceTargets.length} single-choice options were found.`
    );
  }
}

function validateMultipleChoiceAnswers(
  snapshot: QuizDomSnapshot,
  selectedNumbers: number[]
): void {
  const outOfBounds = selectedNumbers.find(
    (selectedNumber) =>
      selectedNumber < 1 || selectedNumber > snapshot.choiceTargets.length
  );

  if (outOfBounds) {
    throw new Error(
      `AI selected option ${outOfBounds}, but only ${snapshot.choiceTargets.length} multiple-choice options were found.`
    );
  }
}

function parseDropdownAnswerLines(response: string): string[] {
  const lines = response
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    const trimmed = response.trim();
    if (!trimmed) {
      throw new Error("AI did not return a valid dropdown selection.");
    }
    return [trimmed];
  }

  return lines;
}

function selectDropdownOption(
  dropdown: DropdownSnapshot,
  responseLine: string
): void {
  const numericMatch = responseLine.trim().match(/^\d+$/);
  if (numericMatch) {
    const selectedNumber = Number.parseInt(numericMatch[0], 10);
    if (selectedNumber < 1 || selectedNumber > dropdown.options.length) {
      throw new Error(
        `AI selected dropdown option ${selectedNumber}, but only ${dropdown.options.length} options were found.`
      );
    }
  }

  let selectedOption = numericMatch
    ? dropdown.options.find(
        (option) => option.index === Number.parseInt(numericMatch[0], 10)
      )
    : undefined;

  if (!selectedOption) {
    const normalizedResponse = responseLine.trim().toLowerCase();
    selectedOption = dropdown.options.find(
      (option) => option.text.toLowerCase() === normalizedResponse
    );
  }

  if (!selectedOption) {
    const normalizedResponse = responseLine.trim().toLowerCase();
    selectedOption = dropdown.options.find(
      (option) =>
        option.text.toLowerCase().includes(normalizedResponse) ||
        normalizedResponse.includes(option.text.toLowerCase())
    );
  }

  if (!selectedOption) {
    throw new Error(
      `AI selected a dropdown option that was not found: ${responseLine}`
    );
  }

  dropdown.target.focus();
  dropdown.target.value = selectedOption.value;
  dropdown.target.dispatchEvent(new Event("input", { bubbles: true }));
  dropdown.target.dispatchEvent(new Event("change", { bubbles: true }));
}

export function triggerChoiceInput(input: HTMLInputElement): void {
  input.focus();
  input.click();
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setEditableValue(target: TextEntryTarget, value: string): void {
  target.focus();

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    setInputValue(target, value);
    return;
  }

  target.textContent = value;
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

export function buildAutoFillPlan(
  snapshot: QuizDomSnapshot,
  response: string
): AutoFillPlan {
  if (isNoQuestionResponse(response)) {
    return { kind: "none" };
  }

  if (snapshot.kind === "dropdown") {
    const lines = parseDropdownAnswerLines(response);
    const dropdowns = snapshot.dropdowns.map((dropdown, index) => {
      const line = lines[index] || lines[lines.length - 1];
      if (!line) {
        throw new Error("AI did not return enough dropdown selections.");
      }
      return { dropdown, responseLine: line };
    });

    return { kind: "dropdown", dropdowns };
  }

  if (snapshot.kind === "single_choice") {
    const selectedNumber = parseSingleChoiceAnswer(response);
    validateSingleChoiceAnswer(snapshot, selectedNumber);

    return {
      kind: "choices",
      mode: "single_choice",
      targets: [snapshot.choiceTargets[selectedNumber - 1]]
    };
  }

  if (snapshot.kind === "multiple_choice") {
    const selectedNumbers = parseMultipleChoiceAnswer(response);
    validateMultipleChoiceAnswers(snapshot, selectedNumbers);

    return {
      kind: "choices",
      mode: "multiple_choice",
      targets: selectedNumbers.map(
        (selectedNumber) => snapshot.choiceTargets[selectedNumber - 1]
      )
    };
  }

  const textTarget = pickClosestTextTarget(snapshot.textTargets);
  if (!textTarget) {
    throw new Error("No visible input box was found for the answer.");
  }

  return {
    kind: "text",
    target: textTarget,
    value: response.trim()
  };
}

export function applyAutoFillPlan(plan: AutoFillPlan): void {
  if (plan.kind === "none") {
    return;
  }

  if (plan.kind === "dropdown") {
    for (const { dropdown, responseLine } of plan.dropdowns) {
      selectDropdownOption(dropdown, responseLine);
    }
    return;
  }

  if (plan.kind === "text") {
    setEditableValue(plan.target, plan.value);
    return;
  }

  for (const target of plan.targets) {
    if (!target.checked) {
      triggerChoiceInput(target);
    }
  }
}
