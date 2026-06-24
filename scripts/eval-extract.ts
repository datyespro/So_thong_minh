import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";

const EXPECTED_CASE_COUNT = 81;
const CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 30_000;
const OWNER_ID = "tip-27-eval";
const BASELINE_GROUPS = new Set(["A", "B", "C", "D", "E", "F", "H"]);

const fieldExpectationSchema = z.object({
  path: z.string().optional(),
  paths: z.array(z.string()).optional(),
  match: z.enum([
    "exact",
    "name",
    "name_any_of",
    "number",
    "items",
    "any_number_path",
  ]),
  value: z.unknown(),
});

const goldenCaseSchema = z.object({
  id: z.string(),
  group: z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "S"]),
  text: z.string().min(1),
  expect: z.object({
    intent: z.string().optional(),
    fields: z.array(fieldExpectationSchema).optional(),
  }),
  mode: z.enum(["assert", "snapshot"]),
});

const goldenSetSchema = z.array(goldenCaseSchema).length(EXPECTED_CASE_COUNT);

type GoldenCase = z.infer<typeof goldenCaseSchema>;
type FieldExpectation = z.infer<typeof fieldExpectationSchema>;

type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  requests: number;
};

type UsageContext = {
  usage: TokenUsage;
  observerErrors: string[];
  timeoutTriggered: boolean;
};

type FieldCheck = {
  label: string;
  passed: boolean;
  expect: unknown;
  got: unknown;
};

type EvalResult = {
  id: string;
  group: GoldenCase["group"];
  text: string;
  mode: GoldenCase["mode"];
  expect: GoldenCase["expect"];
  got: ExtractedIntent | null;
  error: Record<string, unknown> | null;
  intentPassed: boolean | null;
  fieldChecks: FieldCheck[];
  attempts: number;
  durationMs: number;
  usage: TokenUsage;
  usageComplete: boolean;
  usageObserverErrors: string[];
};

type GuardFunction = (extracted: ExtractedIntent) => ExtractedIntent;

class EvalRequestTimeoutError extends Error {
  constructor() {
    super(`OpenAI request exceeded ${REQUEST_TIMEOUT_MS}ms`);
    this.name = "EvalRequestTimeoutError";
  }
}

const usageStorage = new AsyncLocalStorage<UsageContext>();

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, requests: 0 };
}

function addUsage(target: TokenUsage, source: TokenUsage) {
  target.inputTokens += source.inputTokens;
  target.cachedInputTokens += source.cachedInputTokens;
  target.outputTokens += source.outputTokens;
  target.requests += source.requests;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function findUsageObject(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4) return null;

  const record = asRecord(value);
  if (!record) return null;

  const directUsage = asRecord(record.usage);
  if (directUsage) return directUsage;

  for (const nested of Object.values(record)) {
    const found = findUsageObject(nested, depth + 1);
    if (found) return found;
  }

  return null;
}

function tokenUsageFromPayload(payload: unknown): TokenUsage | null {
  const usage = findUsageObject(payload);
  if (!usage) return null;

  const inputTokens =
    asFiniteNumber(usage.input_tokens) ??
    asFiniteNumber(usage.prompt_tokens) ??
    asFiniteNumber(usage.inputTokens);
  const outputTokens =
    asFiniteNumber(usage.output_tokens) ??
    asFiniteNumber(usage.completion_tokens) ??
    asFiniteNumber(usage.outputTokens);
  const inputDetails =
    asRecord(usage.input_tokens_details) ?? asRecord(usage.prompt_tokens_details);
  const cachedInputTokens =
    asFiniteNumber(inputDetails?.cached_tokens) ??
    asFiniteNumber(inputDetails?.cachedTokens) ??
    asFiniteNumber(usage.cached_input_tokens) ??
    0;

  if (inputTokens === null || outputTokens === null) return null;

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    requests: 1,
  };
}

function safeMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_OPENAI_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

function installFetchObserver() {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input, init) => {
    const context = usageStorage.getStore();
    if (!context) return originalFetch(input, init);

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      context.timeoutTriggered = true;
      timeoutController.abort();
    }, REQUEST_TIMEOUT_MS);
    const upstreamSignal = init?.signal;
    const signal = upstreamSignal
      ? AbortSignal.any([upstreamSignal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const response = await originalFetch(input, { ...init, signal });

      try {
        const payload: unknown = await response.clone().json();
        const usage = tokenUsageFromPayload(payload);

        if (usage) {
          addUsage(context.usage, usage);
        } else if (response.ok) {
          context.observerErrors.push("Response did not expose recognized token usage.");
        }
      } catch (error) {
        context.observerErrors.push(`Usage observer: ${safeMessage(error)}`);
      }

      return response;
    } catch (error) {
      if (context.timeoutTriggered) throw new EvalRequestTimeoutError();
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }) as typeof globalThis.fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function normalizeText(value: string) {
  return value.normalize("NFC").trim().toLocaleLowerCase("vi");
}

function normalizeName(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

function nameMatches(got: unknown, expected: unknown) {
  if (typeof got !== "string" || typeof expected !== "string") return false;
  const normalizedGot = normalizeName(got);
  const normalizedExpected = normalizeName(expected);
  return (
    normalizedGot.length > 0 &&
    normalizedExpected.length > 0 &&
    (normalizedGot.includes(normalizedExpected) ||
      normalizedExpected.includes(normalizedGot))
  );
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const compact = normalizeName(value).replace(/\s+/g, "").replace(/,/g, ".");
  if (/^\d+(?:\.\d+)?$/.test(compact)) return Number(compact);

  const thousand = compact.match(/^(\d+(?:\.\d+)?)(?:k|nghin|ngan)$/);
  if (thousand) return Number(thousand[1]) * 1_000;

  const million = compact.match(/^(\d+)(?:tr|trieu)(\d+)?$/);
  if (million) {
    const whole = Number(million[1]) * 1_000_000;
    const fractionDigits = million[2];
    if (!fractionDigits) return whole;
    return whole + Number(fractionDigits) * 10 ** (6 - fractionDigits.length);
  }

  return null;
}

function getValuesAtPath(root: unknown, dottedPath: string): unknown[] {
  let values: unknown[] = [root];

  for (const segment of dottedPath.split(".")) {
    if (segment === "*") {
      values = values.flatMap((value) => (Array.isArray(value) ? value : []));
      continue;
    }

    values = values.map((value) => asRecord(value)?.[segment]);
  }

  return values;
}

function exactMatches(got: unknown, expected: unknown) {
  if (typeof got === "string" && typeof expected === "string") {
    return normalizeText(got) === normalizeText(expected);
  }
  return Object.is(got, expected);
}

function itemsMatch(got: unknown, expected: unknown) {
  if (!Array.isArray(got) || !Array.isArray(expected)) return false;
  const remaining = [...got];

  for (const expectedItem of expected) {
    const expectedRecord = asRecord(expectedItem);
    if (!expectedRecord) return false;

    const matchIndex = remaining.findIndex((candidate) => {
      const gotRecord = asRecord(candidate);
      if (!gotRecord) return false;
      if (!nameMatches(gotRecord.product_name, expectedRecord.product_name)) return false;
      if (
        normalizeNumber(gotRecord.quantity) !== normalizeNumber(expectedRecord.quantity)
      ) {
        return false;
      }
      if (
        expectedRecord.unit !== undefined &&
        !exactMatches(gotRecord.unit, expectedRecord.unit)
      ) {
        return false;
      }
      if (
        expectedRecord.unit_price !== undefined &&
        normalizeNumber(gotRecord.unit_price) !==
          normalizeNumber(expectedRecord.unit_price)
      ) {
        return false;
      }
      return true;
    });

    if (matchIndex < 0) return false;
    remaining.splice(matchIndex, 1);
  }

  return true;
}

function checkField(got: ExtractedIntent, field: FieldExpectation): FieldCheck {
  const values = field.path ? getValuesAtPath(got, field.path) : [];
  const firstValue = values[0];
  let passed = false;
  let actual: unknown = firstValue;

  switch (field.match) {
    case "exact":
      passed = exactMatches(firstValue, field.value);
      break;
    case "name":
      passed = nameMatches(firstValue, field.value);
      break;
    case "name_any_of": {
      const options = Array.isArray(field.value) ? field.value : [];
      passed = options.some((option) =>
        option === null ? firstValue == null : nameMatches(firstValue, option),
      );
      break;
    }
    case "number":
      passed = normalizeNumber(firstValue) === normalizeNumber(field.value);
      break;
    case "items":
      passed = itemsMatch(firstValue, field.value);
      break;
    case "any_number_path": {
      const candidates = (field.paths ?? []).flatMap((candidatePath) =>
        getValuesAtPath(got, candidatePath),
      );
      actual = candidates;
      passed = candidates.some(
        (candidate) => normalizeNumber(candidate) === normalizeNumber(field.value),
      );
      break;
    }
  }

  return {
    label: field.path ?? field.paths?.join(" | ") ?? field.match,
    passed,
    expect: field.value,
    got: actual,
  };
}

function describeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { name: typeof error, message: safeMessage(error) };
  }

  const cause = "cause" in error ? error.cause : null;
  return {
    name: error.name,
    message: safeMessage(error),
    cause: cause && depth < 4 ? describeError(cause, depth + 1) : null,
  };
}

function isTimeoutOrAbort(error: unknown, depth = 0): boolean {
  if (depth > 5 || !(error instanceof Error)) return false;
  if (
    error.name === "EvalRequestTimeoutError" ||
    error.name === "AbortError" ||
    error.name === "TimeoutError"
  ) {
    return true;
  }
  return "cause" in error && error.cause
    ? isTimeoutOrAbort(error.cause, depth + 1)
    : false;
}

async function loadGoldenSet() {
  const filePath = path.join(process.cwd(), "evals", "golden-set.json");
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  const cases = goldenSetSchema.parse(parsed);
  const ids = new Set(cases.map((item) => item.id));

  if (ids.size !== cases.length) throw new Error("Golden set contains duplicate IDs.");
  for (const item of cases) {
    if (item.mode === "assert" && !item.expect.intent) {
      throw new Error(`${item.id}: assert case must declare expect.intent.`);
    }
    if (item.mode === "snapshot" && item.group !== "S") {
      throw new Error(`${item.id}: snapshot cases must belong to group S.`);
    }
  }

  return cases;
}

async function loadGuard(): Promise<{
  guard: GuardFunction;
  measurementLayer: string;
  fallbackReason: string | null;
}> {
  try {
    const pipeline = await import("@/src/lib/ai/chat-pipeline");
    return {
      guard: pipeline.guardSymbolOnlyWritableIntent,
      measurementLayer: "extractIntent + guardSymbolOnlyWritableIntent",
      fallbackReason: null,
    };
  } catch (error) {
    return {
      guard: (extracted) => extracted,
      measurementLayer: "extractIntent (raw fallback; symbol guard unavailable)",
      fallbackReason: safeMessage(error),
    };
  }
}

async function runCase(
  testCase: GoldenCase,
  todayISO: string,
  extractIntent: (
    input: { rawText: string; ownerId: string; todayISO: string },
  ) => Promise<ExtractedIntent>,
  guard: GuardFunction,
): Promise<EvalResult> {
  const startedAt = performance.now();
  const totalUsage = emptyUsage();
  const observerErrors: string[] = [];
  let attempts = 0;

  while (attempts < 2) {
    attempts += 1;
    const context: UsageContext = {
      usage: emptyUsage(),
      observerErrors: [],
      timeoutTriggered: false,
    };

    try {
      const raw = await usageStorage.run(context, () =>
        extractIntent({ rawText: testCase.text, ownerId: OWNER_ID, todayISO }),
      );
      const got = guard(raw);
      addUsage(totalUsage, context.usage);
      observerErrors.push(...context.observerErrors);
      const fieldChecks = (testCase.expect.fields ?? []).map((field) =>
        checkField(got, field),
      );

      return {
        id: testCase.id,
        group: testCase.group,
        text: testCase.text,
        mode: testCase.mode,
        expect: testCase.expect,
        got,
        error: null,
        intentPassed:
          testCase.mode === "assert" ? got.intent === testCase.expect.intent : null,
        fieldChecks,
        attempts,
        durationMs: Math.round(performance.now() - startedAt),
        usage: totalUsage,
        usageComplete: totalUsage.requests >= attempts && observerErrors.length === 0,
        usageObserverErrors: observerErrors,
      };
    } catch (error) {
      addUsage(totalUsage, context.usage);
      observerErrors.push(...context.observerErrors);

      if (attempts === 1 && isTimeoutOrAbort(error)) continue;

      return {
        id: testCase.id,
        group: testCase.group,
        text: testCase.text,
        mode: testCase.mode,
        expect: testCase.expect,
        got: null,
        error: describeError(error),
        intentPassed: testCase.mode === "assert" ? false : null,
        fieldChecks: [],
        attempts,
        durationMs: Math.round(performance.now() - startedAt),
        usage: totalUsage,
        usageComplete: false,
        usageObserverErrors: observerErrors,
      };
    }
  }

  throw new Error(`${testCase.id}: retry loop ended unexpectedly.`);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      output[index] = await worker(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => runWorker()),
  );
  return output;
}

function percentage(passed: number, total: number) {
  return total === 0 ? 0 : Number(((passed / total) * 100).toFixed(1));
}

function intentMetrics(results: EvalResult[]) {
  const assertResults = results.filter((result) => result.mode === "assert");
  const groups = [...new Set(assertResults.map((result) => result.group))].sort();
  const byGroup = groups.map((group) => {
    const groupResults = assertResults.filter((result) => result.group === group);
    const passed = groupResults.filter((result) => result.intentPassed).length;
    return { group, passed, total: groupResults.length, percent: percentage(passed, groupResults.length) };
  });
  const passed = assertResults.filter((result) => result.intentPassed).length;
  const baselineResults = assertResults.filter((result) => BASELINE_GROUPS.has(result.group));
  const baselinePassed = baselineResults.filter((result) => result.intentPassed).length;

  return {
    byGroup,
    overall: { passed, total: assertResults.length, percent: percentage(passed, assertResults.length) },
    baselineGate: {
      passed: baselinePassed,
      total: baselineResults.length,
      percent: percentage(baselinePassed, baselineResults.length),
      achieved: percentage(baselinePassed, baselineResults.length) >= 90,
    },
  };
}

function fieldMetrics(results: EvalResult[]) {
  const checks = results.flatMap((result) => result.fieldChecks);
  const passed = checks.filter((check) => check.passed).length;
  return { passed, total: checks.length, percent: percentage(passed, checks.length) };
}

function calculateCost(model: string, usage: TokenUsage, usageComplete: boolean) {
  if (!usageComplete || !model.startsWith("gpt-4.1-mini")) return null;
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (uncachedInput * 0.4 + usage.cachedInputTokens * 0.1 + usage.outputTokens * 1.6) /
    1_000_000
  );
}

function printReport(
  results: EvalResult[],
  metadata: { model: string; todayISO: string; measurementLayer: string },
  summary: ReturnType<typeof buildSummary>,
  runPath: string,
) {
  console.log("\nTIP-27 EXTRACT EVAL BASELINE");
  console.log(`Model: ${metadata.model}`);
  console.log(`todayISO: ${metadata.todayISO}`);
  console.log(`Tầng đo: ${metadata.measurementLayer}`);
  console.log(`Concurrency: ${CONCURRENCY}; timeout: ${REQUEST_TIMEOUT_MS}ms; retry timeout: 1`);

  console.log("\nINTENT ACCURACY");
  console.log("Group | Correct | Total | Percent");
  console.log("------|---------|-------|--------");
  for (const row of summary.intent.byGroup) {
    console.log(`${row.group}     | ${row.passed}       | ${row.total}     | ${row.percent}%`);
  }
  console.log(
    `ALL   | ${summary.intent.overall.passed}      | ${summary.intent.overall.total}    | ${summary.intent.overall.percent}%`,
  );
  console.log(
    `GATE A-F+H | ${summary.intent.baselineGate.passed} | ${summary.intent.baselineGate.total} | ${summary.intent.baselineGate.percent}% (${summary.intent.baselineGate.achieved ? "ĐẠT" : "CHƯA ĐẠT"})`,
  );
  console.log(
    `Field checks: ${summary.fields.passed}/${summary.fields.total} = ${summary.fields.percent}%`,
  );

  const failures = results.filter(
    (result) =>
      result.mode === "assert" &&
      (!result.intentPassed || result.fieldChecks.some((check) => !check.passed)),
  );
  console.log(`\nFAILURES (${failures.length})`);
  for (const failure of failures) {
    console.log(`\n[${failure.id}] ${failure.text}`);
    console.log(`expect: ${JSON.stringify(failure.expect)}`);
    console.log(`got: ${JSON.stringify(failure.got ?? failure.error)}`);
    const failedFields = failure.fieldChecks.filter((check) => !check.passed);
    if (failedFields.length > 0) {
      console.log(`failed fields: ${JSON.stringify(failedFields)}`);
    }
  }

  console.log("\nSNAPSHOT GROUP S");
  for (const snapshot of results.filter((result) => result.mode === "snapshot")) {
    console.log(`[${snapshot.id}] ${snapshot.text}`);
    console.log(`got: ${JSON.stringify(snapshot.got ?? snapshot.error)}`);
  }

  console.log("\nTOKEN USAGE / COST");
  if (summary.usage.complete && summary.usage.tokens) {
    console.log(
      `input=${summary.usage.tokens.inputTokens}, cached_input=${summary.usage.tokens.cachedInputTokens}, output=${summary.usage.tokens.outputTokens}, requests=${summary.usage.tokens.requests}`,
    );
  } else {
    console.log("usage=N/A (best-effort observer incomplete)");
  }
  console.log(
    summary.usage.estimatedCostUsd === null
      ? "estimated_cost_usd=N/A"
      : `estimated_cost_usd=${summary.usage.estimatedCostUsd.toFixed(6)}`,
  );
  console.log(`Run file: ${runPath}`);
}

function buildSummary(results: EvalResult[], model: string) {
  const usage = emptyUsage();
  for (const result of results) addUsage(usage, result.usage);
  const usageComplete = results.every((result) => result.usageComplete);

  return {
    intent: intentMetrics(results),
    fields: fieldMetrics(results),
    failures: results
      .filter(
        (result) =>
          result.mode === "assert" &&
          (!result.intentPassed || result.fieldChecks.some((check) => !check.passed)),
      )
      .map((result) => result.id),
    usage: {
      complete: usageComplete,
      tokens: usageComplete ? usage : null,
      estimatedCostUsd: calculateCost(model, usage, usageComplete),
      observerErrors: results.flatMap((result) =>
        result.usageObserverErrors.map((error) => `${result.id}: ${error}`),
      ),
    },
  };
}

async function main() {
  loadEnvConfig(process.cwd());
  const startedAt = new Date();
  const todayISO = startedAt.toISOString().slice(0, 10);
  const cases = await loadGoldenSet();

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing from the local environment.");
  }

  const { DEFAULT_AI_MODEL } = await import("@/src/lib/ai/provider");
  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;
  const { extractIntent } = await import("@/src/lib/ai/extract-intent");
  const { guard, measurementLayer, fallbackReason } = await loadGuard();
  const restoreFetch = installFetchObserver();
  let results: EvalResult[];

  try {
    results = await mapWithConcurrency(cases, CONCURRENCY, (testCase) =>
      runCase(testCase, todayISO, extractIntent, guard),
    );
  } finally {
    restoreFetch();
  }

  const finishedAt = new Date();
  const summary = buildSummary(results, model);
  const timestamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const runsDirectory = path.join(process.cwd(), "evals", "runs");
  const runPath = path.join(runsDirectory, `${timestamp}.json`);
  const run = {
    version: 1,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    todayISO,
    model,
    temperature: 0,
    concurrency: CONCURRENCY,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    timeoutRetries: 1,
    ownerIdAffectsPrompt: false,
    measurementLayer,
    guardFallbackReason: fallbackReason,
    reportOnly: true,
    pricing: model.startsWith("gpt-4.1-mini")
      ? { currency: "USD", perMillionTokens: { input: 0.4, cachedInput: 0.1, output: 1.6 } }
      : null,
    summary,
    results,
  };

  await mkdir(runsDirectory, { recursive: true });
  await writeFile(runPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  printReport(results, { model, todayISO, measurementLayer }, summary, runPath);
}

main().catch((error) => {
  console.error("TIP-27 eval could not complete.");
  console.error(JSON.stringify(describeError(error), null, 2));
  process.exitCode = 0;
});
