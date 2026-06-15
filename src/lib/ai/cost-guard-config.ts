export const RATE_LIMIT_PER_MINUTE = 20;
export const RATE_LIMIT_PER_DAY = 300;
export const MONTHLY_BUDGET_USD = 5;
export const EST_COST_PER_TURN_USD = 0.0015;

export function getExemptOwnerIds(): string[] {
  const envVar = process.env.AI_RATE_LIMIT_EXEMPT_OWNER_IDS || "";
  return envVar
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}
