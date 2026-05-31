import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const examples = [
  "Bán cho cô Lan 10 bao xi măng 85k, nợ",
  "Cô Lan trả 500k",
  "Còn bao nhiêu xi măng?",
  "Hôm nay bán được bao nhiêu?",
  "Sửa đơn hôm qua của cô Lan thành 12 bao",
  "Hoàn tác đơn vừa rồi",
];

function sanitizeForLog(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_OPENAI_KEY]")
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (/api[_-]?key|authorization|token|secret/i.test(key)) {
        output[key] = "[REDACTED]";
        continue;
      }

      output[key] = sanitizeForLog(item);
    }

    return output;
  }

  return value;
}

function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {
      name: typeof error,
      message: String(error),
    };
  }

  return {
    name: error.name,
    message: error.message,
    cause:
      "cause" in error && error.cause
        ? sanitizeForLog(describeError(error.cause))
        : null,
  };
}

async function main() {
  const { DEFAULT_AI_MODEL } = await import("@/src/lib/ai/provider");

  console.log(`AI_MODEL: ${process.env.AI_MODEL || DEFAULT_AI_MODEL}`);

  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY missing - skipping live AI test.");
    return;
  }

  const { extractIntent } = await import("@/src/lib/ai/extract-intent");

  for (const text of examples) {
    const extracted = await extractIntent({
      rawText: text,
      ownerId: "manual-live-test",
    });

    console.log(
      JSON.stringify(
        {
          input: text,
          intent: extracted.intent,
          confidence: extracted.confidence,
          missing_info: extracted.missing_info,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error("Live AI intent test failed.");
  console.error(JSON.stringify(sanitizeForLog(describeError(error)), null, 2));
  process.exitCode = 1;
});
