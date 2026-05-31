import { generateText, Output } from "ai";
import { z } from "zod";
import {
  ExtractedIntentOutputSchema,
  ExtractedIntentSchema,
  type ExtractedIntent,
} from "@/src/lib/ai/intent-schema";
import { getIntentModel } from "@/src/lib/ai/provider";
import { buildExtractIntentPrompt } from "@/src/lib/ai/prompts/extract-intent";

export type ExtractIntentInput = {
  rawText: string;
  ownerId: string;
  todayISO?: string;
};

type GenerateStructuredIntent = (input: {
  prompt: string;
}) => Promise<unknown>;

export type ExtractIntentOptions = {
  generateStructuredIntent?: GenerateStructuredIntent;
};

export class IntentExtractionError extends Error {
  constructor(
    public readonly code:
      | "EMPTY_INPUT"
      | "INPUT_TOO_LONG"
      | "AI_CONFIG_MISSING"
      | "INTENT_EXTRACTION_FAILED",
    message = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "IntentExtractionError";
  }
}

export function normalizeIntentInput(rawText: string) {
  return rawText.trim();
}

export async function defaultGenerateStructuredIntent(input: {
  prompt: string;
}): Promise<unknown> {
  const result = await generateText({
    model: getIntentModel(),
    output: Output.object({
      schema: ExtractedIntentOutputSchema,
      name: "ExtractedIntent",
      description:
        "Structured business intent extracted from one Vietnamese shop-owner message",
    }),
    prompt: input.prompt,
    temperature: 0,
  });

  return result.output;
}

export async function extractIntent(
  input: ExtractIntentInput,
  options: ExtractIntentOptions = {},
): Promise<ExtractedIntent> {
  const rawText = normalizeIntentInput(input.rawText);

  if (!rawText) {
    throw new IntentExtractionError("EMPTY_INPUT");
  }

  if (rawText.length > 1000) {
    throw new IntentExtractionError("INPUT_TOO_LONG");
  }

  const todayISO = input.todayISO ?? new Date().toISOString().slice(0, 10);
  const prompt = buildExtractIntentPrompt({ rawText, todayISO });
  const generateStructuredIntent =
    options.generateStructuredIntent ?? defaultGenerateStructuredIntent;

  try {
    const output = await generateStructuredIntent({ prompt });
    return ExtractedIntentSchema.parse(output);
  } catch (error) {
    if (
      error instanceof IntentExtractionError &&
      error.code !== "INTENT_EXTRACTION_FAILED"
    ) {
      throw error;
    }

    if (error instanceof Error && error.message === "AI_CONFIG_MISSING") {
      throw new IntentExtractionError("AI_CONFIG_MISSING", "AI_CONFIG_MISSING", {
        cause: error,
      });
    }

    if (error instanceof z.ZodError) {
      throw new IntentExtractionError(
        "INTENT_EXTRACTION_FAILED",
        "INTENT_EXTRACTION_FAILED",
        { cause: error },
      );
    }

    throw new IntentExtractionError(
      "INTENT_EXTRACTION_FAILED",
      "INTENT_EXTRACTION_FAILED",
      { cause: error },
    );
  }
}
