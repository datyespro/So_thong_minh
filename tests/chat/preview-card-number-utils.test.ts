import { describe, expect, it } from "vitest";
import {
  formatVietnameseMoney,
  parseVietnameseNumber,
} from "@/src/components/chat/preview-card/number-utils";

describe("preview card number helpers", () => {
  it("parses Vietnamese shorthand numbers", () => {
    expect(parseVietnameseNumber("100k")).toBe(100000);
    expect(parseVietnameseNumber("1,6 triệu")).toBe(1600000);
    expect(parseVietnameseNumber("100.000")).toBe(100000);
    expect(parseVietnameseNumber("rác")).toBeNull();
  });

  it("formats Vietnamese money", () => {
    expect(formatVietnameseMoney(2000000)).toBe("2.000.000 đ");
    expect(formatVietnameseMoney(null)).toBe("Chưa có");
  });
});
