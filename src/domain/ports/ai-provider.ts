import type { AiMessage, AssessmentResult } from "../entities/assessment.js";

export interface AiProvider {
  readonly name: string;
  fetchAssessment(messages: AiMessage[]): Promise<AssessmentResult>;
}
