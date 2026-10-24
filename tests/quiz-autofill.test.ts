import { describe, expect, test } from "bun:test";
import {
  buildAutoFillPlan,
  type QuizDomSnapshot
} from "../src/content/quiz-autofill";

function createChoiceSnapshot(
  count: number,
  kind: "single_choice" | "multiple_choice" = "single_choice"
): QuizDomSnapshot {
  return {
    kind,
    choiceTargets: Array.from(
      { length: count },
      () => ({ checked: false }) as HTMLInputElement
    ),
    dropdownTargets: [],
    textTargets: [],
    dropdowns: []
  };
}

function getChoicePlan(snapshot: QuizDomSnapshot, response: string) {
  const plan = buildAutoFillPlan(snapshot, response);
  if (plan.kind !== "choices") {
    throw new Error(`Expected a choices plan, received ${plan.kind}.`);
  }
  return plan;
}

describe("buildAutoFillPlan", () => {
  test("maps a single-choice answer to the correct target", () => {
    const snapshot = createChoiceSnapshot(3);
    const plan = getChoicePlan(snapshot, "2");

    expect(plan.mode).toBe("single_choice");
    expect(plan.targets).toEqual([snapshot.choiceTargets[1]]);
  });

  test("parses a multi-choice answer split across lines", () => {
    const snapshot = createChoiceSnapshot(4, "multiple_choice");
    const plan = getChoicePlan(snapshot, "1\n3\n4");

    expect(plan.mode).toBe("multiple_choice");
    expect(plan.targets).toEqual([
      snapshot.choiceTargets[0],
      snapshot.choiceTargets[2],
      snapshot.choiceTargets[3]
    ]);
  });

  test("parses a comma-separated multi-choice answer", () => {
    const snapshot = createChoiceSnapshot(4, "multiple_choice");
    const plan = getChoicePlan(snapshot, "1, 3, 4");

    expect(plan.targets).toEqual([
      snapshot.choiceTargets[0],
      snapshot.choiceTargets[2],
      snapshot.choiceTargets[3]
    ]);
  });

  test("deduplicates repeated option numbers", () => {
    const snapshot = createChoiceSnapshot(4, "multiple_choice");
    const plan = getChoicePlan(snapshot, "1, 1, 3");

    expect(plan.targets).toEqual([
      snapshot.choiceTargets[0],
      snapshot.choiceTargets[2]
    ]);
  });

  test("accepts option-number wording", () => {
    const snapshot = createChoiceSnapshot(4, "multiple_choice");
    const plan = getChoicePlan(snapshot, "Option 1, Option 3, Option 4");

    expect(plan.targets).toEqual([
      snapshot.choiceTargets[0],
      snapshot.choiceTargets[2],
      snapshot.choiceTargets[3]
    ]);
  });

  test("rejects an out-of-range option number", () => {
    const snapshot = createChoiceSnapshot(3);

    expect(() => buildAutoFillPlan(snapshot, "4")).toThrow(
      "AI selected option 4"
    );
  });

  test("returns a no-op plan when no question was found", () => {
    const snapshot = createChoiceSnapshot(3);
    const plan = buildAutoFillPlan(snapshot, "No question found.");

    expect(plan.kind).toBe("none");
  });
});
