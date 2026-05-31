import { openai } from "@ai-sdk/openai";

export const DEFAULT_AI_MODEL = "gpt-4.1-mini";

export function getIntentModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI_CONFIG_MISSING");
  }

  return openai(process.env.AI_MODEL || DEFAULT_AI_MODEL);
}
