import { diceSimilarity, normalizeVi } from "@/src/lib/ai/normalize";
import type {
  EntityCandidate,
  EntityType,
  MatchKind,
  ResolvedEntity,
} from "@/src/lib/ai/resolve-schema";

export type EntityRow = {
  id: string;
  name: string;
  aliases: string[];
  unit?: string | null;
  sell_price?: number | null;
};

export const RESOLVE_THRESHOLDS = {
  AUTO_RESOLVE_MIN: 0.81,
  CONFIRM_MIN: 0.4,
  AMBIGUITY_GAP: 0.12,
} as const;

// Vietnamese honorifics in ALREADY-normalized form (no diacritics, lowercase),
// because stripHonorific runs on the output of normalizeVi. Used ONLY in the
// fuzzy branch so a leading "anh/chị/..." does not inflate trigram similarity.
const HONORIFICS = new Set([
  "anh",
  "chi",
  "co",
  "chu",
  "bac",
  "ong",
  "ba",
  "em",
  "di",
  "cau",
  "mo",
  "thim",
]);

// Drops a single leading honorific token when at least one token follows it.
// "anh phat" -> "phat"; "anh" -> "anh" (nothing after); "anh ba" -> "ba"
// (only the leading position is stripped, so "ba" is kept).
function stripHonorific(normalized: string): string {
  const spaceIndex = normalized.indexOf(" ");

  if (spaceIndex === -1) {
    return normalized;
  }

  const firstToken = normalized.slice(0, spaceIndex);

  if (!HONORIFICS.has(firstToken)) {
    return normalized;
  }

  return normalized.slice(spaceIndex + 1);
}

// Gendered subsets of HONORIFICS. A leading honorific that is clearly male on
// one side and clearly female on the other names two DIFFERENT people, so the
// fuzzy branch must not match across them. "bac"/"em" carry no gender and are
// intentionally absent => treated as unknown.
const MALE_HONORIFICS = new Set(["anh", "chu", "ong", "cau"]);
const FEMALE_HONORIFICS = new Set(["chi", "co", "ba", "di", "mo", "thim"]);

// Gender carried by the leading honorific token of an already-normalized string.
// null when the first token is not a gendered honorific (including no honorific).
function honorificGender(normalized: string): "male" | "female" | null {
  const spaceIndex = normalized.indexOf(" ");
  const firstToken =
    spaceIndex === -1 ? normalized : normalized.slice(0, spaceIndex);

  if (MALE_HONORIFICS.has(firstToken)) {
    return "male";
  }

  if (FEMALE_HONORIFICS.has(firstToken)) {
    return "female";
  }

  return null;
}

export function numberTokens(normalized: string): string[] {
  const matches = normalized.match(/\d+/g);
  if (!matches) {
    return [];
  }
  return matches.sort();
}

export function numbersConflict(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  if (a.length !== b.length) {
    return true;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return true;
    }
  }
  return false;
}

// Hai chuỗi ĐÃ normalizeVi + stripHonorific. Trả true khi mỗi bên còn ít nhất
// một token "đặc trưng" (không tìm được token đối ứng đủ giống ở bên kia) — tức
// hai tên cùng một khúc soạn sẵn nhưng chỉ tên riêng khác nhau => khác thực thể.
export const TOKEN_MATCH_MIN = 0.5;
export function distinctiveTokenConflict(a: string, b: string): boolean {
  const aTokens = a.split(" ").filter(Boolean);
  const bTokens = b.split(" ").filter(Boolean);
  if (aTokens.length === 0 || bTokens.length === 0) {
    return false;
  }
  const matched = (token: string, others: string[]) =>
    others.some((o) => o === token || diceSimilarity(token, o) >= TOKEN_MATCH_MIN);
  const aUnmatched = aTokens.some((t) => !matched(t, bTokens));
  const bUnmatched = bTokens.some((t) => !matched(t, aTokens));
  return aUnmatched && bUnmatched;
}

function emptyResolution(
  raw: string | null,
  entityType: EntityType,
): ResolvedEntity {
  return {
    raw,
    entity_type: entityType,
    status: "not_found",
    resolved_id: null,
    resolved_name: null,
    confidence: 0,
    candidates: [],
  };
}

function sortCandidates(candidates: EntityCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.name.localeCompare(right.name);
  });
}

function candidateFor(
  row: EntityRow,
  score: number,
  matchedOn: MatchKind,
  matchedValue: string,
): EntityCandidate {
  const candidate: EntityCandidate = {
    id: row.id,
    name: row.name,
    score,
    matched_on: matchedOn,
    matched_value: matchedValue,
  };

  if (row.unit) {
    candidate.unit = row.unit;
  }

  if (row.sell_price !== undefined) {
    candidate.sell_price = row.sell_price;
  }

  return candidate;
}

function resolvedEntity(
  raw: string,
  entityType: EntityType,
  candidate: EntityCandidate,
): ResolvedEntity {
  return {
    raw,
    entity_type: entityType,
    status: "resolved",
    resolved_id: candidate.id,
    resolved_name: candidate.name,
    confidence: candidate.score,
    candidates: [candidate],
  };
}

function unresolvedEntity(
  raw: string,
  entityType: EntityType,
  status: "needs_confirmation" | "ambiguous",
  candidates: EntityCandidate[],
): ResolvedEntity {
  const topCandidate = candidates[0];

  return {
    raw,
    entity_type: entityType,
    status,
    resolved_id: null,
    resolved_name: null,
    confidence: topCandidate?.score ?? 0,
    candidates: candidates.slice(0, 3),
  };
}

function exactAliasCandidates(
  normalizedRaw: string,
  rows: EntityRow[],
): EntityCandidate[] {
  const candidatesByRow = new Map<string, EntityCandidate>();

  for (const row of rows) {
    for (const alias of row.aliases) {
      if (normalizeVi(alias) !== normalizedRaw) {
        continue;
      }

      if (!candidatesByRow.has(row.id)) {
        candidatesByRow.set(
          row.id,
          candidateFor(row, 0.95, "alias_exact", alias),
        );
      }
    }
  }

  return sortCandidates([...candidatesByRow.values()]);
}

// Fuzzy scoring strips a leading honorific from BOTH the query and each row
// value (after the existing normalizeVi). normalizeVi is idempotent and
// diceSimilarity re-normalizes internally, so feeding it already-normalized
// input is safe. matched_value keeps the original string for display.
function bestFuzzyCandidate(raw: string, row: EntityRow): EntityCandidate {
  // Gendered-honorific guard: opposite explicit genders (e.g. "chị Phát" vs
  // "anh Phát") name different people. Force score 0 so the CONFIRM_MIN filter
  // drops this candidate. Same gender, or either side unknown, scores normally.
  const rawGender = honorificGender(normalizeVi(raw));
  const rowGender = honorificGender(normalizeVi(row.name));

  if (rawGender && rowGender && rawGender !== rowGender) {
    return candidateFor(row, 0, "fuzzy", row.name);
  }

  const strippedRaw = stripHonorific(normalizeVi(raw));
  const rawNums = numberTokens(strippedRaw);

  let bestScore = -1;
  let bestValue = row.name;

  const valuesToScore = [row.name, ...row.aliases];

  for (const value of valuesToScore) {
    const strippedValue = stripHonorific(normalizeVi(value));
    const valueNums = numberTokens(strippedValue);

    if (numbersConflict(rawNums, valueNums)) {
      continue;
    }

    if (distinctiveTokenConflict(strippedRaw, strippedValue)) {
      continue;
    }

    const score = diceSimilarity(strippedRaw, strippedValue);

    if (score > bestScore) {
      bestScore = score;
      bestValue = value;
    }
  }

  if (bestScore === -1) {
    return candidateFor(row, 0, "fuzzy", row.name);
  }

  return candidateFor(row, bestScore, "fuzzy", bestValue);
}

export function resolveOne(
  rawName: string | null,
  entityType: EntityType,
  rows: EntityRow[],
): ResolvedEntity {
  const raw = rawName?.trim() || null;

  if (!raw) {
    return emptyResolution(null, entityType);
  }

  const normalizedRaw = normalizeVi(raw);

  if (!normalizedRaw) {
    return emptyResolution(null, entityType);
  }

  const exactNameCandidates = sortCandidates(
    rows
      .filter((row) => normalizeVi(row.name) === normalizedRaw)
      .map((row) => candidateFor(row, 1, "name_exact", row.name)),
  );

  if (exactNameCandidates.length === 1) {
    return resolvedEntity(raw, entityType, exactNameCandidates[0]);
  }

  if (exactNameCandidates.length > 1) {
    return unresolvedEntity(
      raw,
      entityType,
      "ambiguous",
      exactNameCandidates,
    );
  }

  const aliasCandidates = exactAliasCandidates(normalizedRaw, rows);

  if (aliasCandidates.length === 1) {
    return resolvedEntity(raw, entityType, aliasCandidates[0]);
  }

  if (aliasCandidates.length > 1) {
    return unresolvedEntity(raw, entityType, "ambiguous", aliasCandidates);
  }

  const fuzzyCandidates = sortCandidates(
    rows.map((row) => bestFuzzyCandidate(raw, row)),
  )
    .filter((candidate) => candidate.score >= RESOLVE_THRESHOLDS.CONFIRM_MIN)
    .slice(0, 3);
  const top = fuzzyCandidates[0];

  if (!top) {
    return emptyResolution(raw, entityType);
  }

  const second = fuzzyCandidates[1];

  if (top.score >= RESOLVE_THRESHOLDS.AUTO_RESOLVE_MIN) {
    if (
      second &&
      top.score - second.score < RESOLVE_THRESHOLDS.AMBIGUITY_GAP &&
      second.score >= RESOLVE_THRESHOLDS.CONFIRM_MIN
    ) {
      return unresolvedEntity(raw, entityType, "ambiguous", fuzzyCandidates);
    }

    return resolvedEntity(raw, entityType, top);
  }

  return unresolvedEntity(
    raw,
    entityType,
    "needs_confirmation",
    fuzzyCandidates,
  );
}
