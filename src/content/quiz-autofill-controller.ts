import {
  applyAutoFillPlan,
  buildAutoFillPlan,
  buildAutoFillPrompt,
  detectQuizDom
} from "./quiz-autofill";
import { armChoiceHoverSelection } from "./quiz-hover";
import type { ChoiceHoverSession } from "./quiz-hover";
import type { QuizControllerOptions } from "./quiz-shared";
import { runQuizRequest } from "./quiz-shared";

export function createQuizAutofillController(options: QuizControllerOptions) {
  let hoverSession: ChoiceHoverSession | null = null;

  function cancelHover(): void {
    hoverSession?.dispose();
    hoverSession = null;
  }

  return {
    cancelHover,

    async runQuizAutofill(): Promise<void> {
      cancelHover();

      await runQuizRequest(options, {
        userMessage: "📸 Screenshot sent — answering quiz…",
        buildPrompt: () => {
          const snapshot = detectQuizDom();

          return {
            prompt: buildAutoFillPrompt(snapshot),
            onResponse: (response) => {
              cancelHover();
              const plan = buildAutoFillPlan(snapshot, response);

              if (plan.kind === "choices") {
                hoverSession = armChoiceHoverSelection(plan);
                return;
              }

              applyAutoFillPlan(plan);
            }
          };
        }
      });
    }
  };
}
