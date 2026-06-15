import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAiGuard, checkAiGuard } from "@/src/lib/ai/cost-guard";

describe("evaluateAiGuard", () => {
  it("allows when within limits", () => {
    const decision = evaluateAiGuard({
      perMinuteCount: 5,
      perDayCount: 50,
      monthCount: 1000,
      isExempt: false,
    });
    expect(decision).toEqual({ allow: true });
  });

  it("blocks on rate_minute", () => {
    const decision = evaluateAiGuard({
      perMinuteCount: 20,
      perDayCount: 50,
      monthCount: 1000,
      isExempt: false,
    });
    expect(decision).toEqual({
      allow: false,
      reason: "rate_minute",
      message: "Dạ bác gửi hơi nhanh, bác đợi một chút rồi thử lại giúp em ạ.",
    });
  });

  it("blocks on rate_day", () => {
    const decision = evaluateAiGuard({
      perMinuteCount: 5,
      perDayCount: 300,
      monthCount: 1000,
      isExempt: false,
    });
    expect(decision).toEqual({
      allow: false,
      reason: "rate_day",
      message: "Hôm nay em nhận khá nhiều rồi ạ, bác thử lại vào ngày mai nhé.",
    });
  });

  it("exempts from rate limit for exempt owners", () => {
    const decision = evaluateAiGuard({
      perMinuteCount: 25,
      perDayCount: 400,
      monthCount: 1000,
      isExempt: true,
    });
    expect(decision).toEqual({ allow: true });
  });

  it("blocks on monthly budget even for exempt owners", () => {
    const decision = evaluateAiGuard({
      perMinuteCount: 25,
      perDayCount: 400,
      monthCount: 3500, // 3500 * 0.0015 = 5.25 >= 5
      isExempt: true,
    });
    expect(decision).toEqual({
      allow: false,
      reason: "budget_month",
      message: "Dạ hệ thống tạm nghỉ nhận câu mới trong tháng này ạ. Bác liên hệ để mở thêm nhé.",
    });
  });
});

describe("checkAiGuard", () => {
  const originalEnv = process.env.AI_RATE_LIMIT_EXEMPT_OWNER_IDS;

  beforeEach(() => {
    process.env.AI_RATE_LIMIT_EXEMPT_OWNER_IDS = "exempt-id-1";
  });

  afterEach(() => {
    process.env.AI_RATE_LIMIT_EXEMPT_OWNER_IDS = originalEnv;
  });

  it("fails open if supabase query throws", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockRejectedValue(new Error("Network Error")),
      }),
      rpc: vi.fn(),
    };

    const decision = await checkAiGuard({
      supabase: mockSupabase as unknown as SupabaseClient,
      ownerId: "user-1",
    });

    expect(decision).toEqual({ allow: true });
  });

  it("fails open if rpc returns error", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("RPC Error") }),
    };

    const decision = await checkAiGuard({
      supabase: mockSupabase as unknown as SupabaseClient,
      ownerId: "user-1",
    });

    expect(decision).toEqual({ allow: true });
  });
});
