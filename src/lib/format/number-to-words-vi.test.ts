import { describe, it, expect } from "vitest";
import { vietnameseAmountInWords } from "./number-to-words-vi";

describe("vietnameseAmountInWords", () => {
  it("formats golden cases correctly", () => {
    expect(vietnameseAmountInWords(0)).toBe("Không đồng.");
    expect(vietnameseAmountInWords(1000)).toBe("Một nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(5000)).toBe("Năm nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(15000)).toBe("Mười lăm nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(21000)).toBe("Hai mươi mốt nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(85000)).toBe("Tám mươi lăm nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(105000)).toBe("Một trăm lẻ năm nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(1000000)).toBe("Một triệu đồng chẵn.");
    expect(vietnameseAmountInWords(1700000)).toBe("Một triệu bảy trăm nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(2700000)).toBe("Hai triệu bảy trăm nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(10450000)).toBe("Mười triệu bốn trăm năm mươi nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(11250000)).toBe("Mười một triệu hai trăm năm mươi nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(1000000000)).toBe("Một tỷ đồng chẵn.");
  });

  it("handles negative and non-chẵn numbers", () => {
    expect(vietnameseAmountInWords(-1000)).toBe("Âm một nghìn đồng chẵn.");
    expect(vietnameseAmountInWords(1500)).toBe("Một nghìn năm trăm đồng.");
    expect(vietnameseAmountInWords(100500)).toBe("Một trăm nghìn năm trăm đồng.");
  });
});
