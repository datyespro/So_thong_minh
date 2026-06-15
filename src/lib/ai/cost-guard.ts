import { type SupabaseClient } from "@supabase/supabase-js";
import {
  EST_COST_PER_TURN_USD,
  getExemptOwnerIds,
  MONTHLY_BUDGET_USD,
  RATE_LIMIT_PER_DAY,
  RATE_LIMIT_PER_MINUTE,
} from "./cost-guard-config";

export type GuardDecision =
  | { allow: true }
  | {
      allow: false;
      reason: "budget_month" | "rate_minute" | "rate_day";
      message: string;
    };

export function evaluateAiGuard({
  perMinuteCount,
  perDayCount,
  monthCount,
  isExempt,
}: {
  perMinuteCount: number;
  perDayCount: number;
  monthCount: number;
  isExempt: boolean;
}): GuardDecision {
  if (monthCount * EST_COST_PER_TURN_USD >= MONTHLY_BUDGET_USD) {
    return {
      allow: false,
      reason: "budget_month",
      message: "Dạ hệ thống tạm nghỉ nhận câu mới trong tháng này ạ. Bác liên hệ để mở thêm nhé.",
    };
  }

  if (!isExempt) {
    if (perMinuteCount >= RATE_LIMIT_PER_MINUTE) {
      return {
        allow: false,
        reason: "rate_minute",
        message: "Dạ bác gửi hơi nhanh, bác đợi một chút rồi thử lại giúp em ạ.",
      };
    }
    if (perDayCount >= RATE_LIMIT_PER_DAY) {
      return {
        allow: false,
        reason: "rate_day",
        message: "Hôm nay em nhận khá nhiều rồi ạ, bác thử lại vào ngày mai nhé.",
      };
    }
  }

  return { allow: true };
}

export async function checkAiGuard({
  supabase,
  ownerId,
}: {
  supabase: Pick<SupabaseClient, "from" | "rpc">;
  ownerId: string;
}): Promise<GuardDecision> {
  try {
    const isExempt = getExemptOwnerIds().includes(ownerId);
    
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();

    const tzOffset = 7 * 60; // UTC+7
    const todayVn = new Date(now.getTime() + tzOffset * 60 * 1000);
    todayVn.setUTCHours(0, 0, 0, 0);
    const startOfDayVnUtc = new Date(todayVn.getTime() - tzOffset * 60 * 1000).toISOString();

    const [minuteRes, dayRes, monthRes] = await Promise.all([
      supabase
        .from("ai_interactions")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .gte("created_at", oneMinuteAgo),
      supabase
        .from("ai_interactions")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .gte("created_at", startOfDayVnUtc),
      supabase.rpc("ai_usage_current_month_count"),
    ]);

    if (minuteRes.error) throw minuteRes.error;
    if (dayRes.error) throw dayRes.error;
    if (monthRes.error) throw monthRes.error;

    return evaluateAiGuard({
      perMinuteCount: minuteRes.count ?? 0,
      perDayCount: dayRes.count ?? 0,
      monthCount: Number(monthRes.data ?? 0),
      isExempt,
    });
  } catch (error) {
    console.warn("Failed to check AI cost guard, failing open:", error);
    return { allow: true };
  }
}
