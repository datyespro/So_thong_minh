import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SMALL_TALK_MAX_REPLY_CHARS,
  generateSmallTalkReply,
  guardSmallTalkReply,
} from "@/src/lib/ai/small-talk-reply";

describe("guardSmallTalkReply", () => {
  it("trims and accepts a short polite reply", () => {
    expect(guardSmallTalkReply("  Dạ, em chào bác ạ.  ")).toBe(
      "Dạ, em chào bác ạ.",
    );
  });

  it("rejects empty or whitespace-only text", () => {
    expect(guardSmallTalkReply("")).toBeNull();
    expect(guardSmallTalkReply("   ")).toBeNull();
  });

  it("rejects replies over the max length", () => {
    expect(guardSmallTalkReply("ạ".repeat(SMALL_TALK_MAX_REPLY_CHARS + 1))).toBeNull();
    expect(guardSmallTalkReply("ạ".repeat(SMALL_TALK_MAX_REPLY_CHARS))).toBe(
      "ạ".repeat(SMALL_TALK_MAX_REPLY_CHARS),
    );
  });

  it("rejects business-number patterns", () => {
    expect(guardSmallTalkReply("anh Hùng đang nợ 500k đó bác")).toBeNull();
    expect(guardSmallTalkReply("doanh thu hôm nay 1200000")).toBeNull();
    expect(guardSmallTalkReply("giá 90 nghìn một bao ạ")).toBeNull();
    expect(guardSmallTalkReply("chị Lan còn nợ 2 triệu ạ")).toBeNull();
    expect(guardSmallTalkReply("tầm 500tr thôi bác")).toBeNull();
    expect(guardSmallTalkReply("còn 500đ lẻ ạ")).toBeNull();
    expect(guardSmallTalkReply("khoảng 30 vnd ạ")).toBeNull();
  });

  it("keeps harmless small numbers", () => {
    expect(guardSmallTalkReply("Dạ, bác cứ nhắn 1 câu là em ghi ạ.")).toBe(
      "Dạ, bác cứ nhắn 1 câu là em ghi ạ.",
    );
    expect(guardSmallTalkReply("Dạ, em trực 24 giờ luôn ạ.")).toBe(
      "Dạ, em trực 24 giờ luôn ạ.",
    );
  });
});

describe("generateSmallTalkReply", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns guarded text from the injected generate", async () => {
    const generate = vi.fn().mockResolvedValue("  Dạ, em chào bác ạ.  ");

    await expect(
      generateSmallTalkReply({ rawText: "chào em", generate }),
    ).resolves.toBe("Dạ, em chào bác ạ.");
    expect(generate).toHaveBeenCalledTimes(1);

    const arg = generate.mock.calls[0][0];

    expect(arg.prompt).toBe("chào em");
    expect(arg.system).toContain("tối đa 2 câu");
    expect(arg.system).toContain("con số nghiệp vụ");
    expect(arg.system).toContain("anh Hùng nợ bao nhiêu là em tra liền ạ");
  });

  it("returns null when the model leaks business numbers", async () => {
    const generate = vi.fn().mockResolvedValue("anh Hùng đang nợ 500k đó bác");

    await expect(
      generateSmallTalkReply({ rawText: "dạo này sao em", generate }),
    ).resolves.toBeNull();
  });

  it("returns null when generate rejects (timeout/abort)", async () => {
    const generate = vi
      .fn()
      .mockRejectedValue(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      );

    await expect(
      generateSmallTalkReply({ rawText: "chào em", generate }),
    ).resolves.toBeNull();
  });

  it("returns null via the default generate when the API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await expect(
      generateSmallTalkReply({ rawText: "chào em" }),
    ).resolves.toBeNull();
  });

  it("returns null for empty rawText without calling generate", async () => {
    const generate = vi.fn();

    await expect(
      generateSmallTalkReply({ rawText: "   ", generate }),
    ).resolves.toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });
});
