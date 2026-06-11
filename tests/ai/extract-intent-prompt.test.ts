import { describe, expect, it } from "vitest";
import { buildExtractIntentPrompt } from "@/src/lib/ai/prompts/extract-intent";

describe("buildExtractIntentPrompt", () => {
  it("includes query_sales few-shot examples for week and month ranges", () => {
    const prompt = buildExtractIntentPrompt({
      rawText: "tuần này bán bao nhiêu",
      todayISO: "2026-06-01",
    });

    expect(prompt).toContain('User: "Hôm nay bán được bao nhiêu?"');
    expect(prompt).toContain("time_range.kind: today");
    expect(prompt).toContain('User: "Tuần này bán được bao nhiêu?"');
    expect(prompt).toContain("time_range.kind: this_week");
    expect(prompt).toContain('User: "Tháng này bán bao nhiêu?"');
    expect(prompt).toContain("time_range.kind: this_month");
    expect(prompt).toContain('User: "Còn bao nhiêu xi măng?"');
    expect(prompt).toContain("Intent: query_inventory");
  });

  it("narrows ambiguous sale-order guidance and includes symbol-only unknown examples", () => {
    const prompt = buildExtractIntentPrompt({
      rawText: "...",
      todayISO: "2026-06-01",
    });

    expect(prompt).toContain("Không lấy tên, số lượng, giá hoặc mặt hàng từ ví dụ mẫu");
    expect(prompt).toContain("Chỉ ưu tiên create_order khi có tín hiệu nghiệp vụ rõ");
    expect(prompt).toContain('User: "..."');
    expect(prompt).toContain('User: "?"');
    expect(prompt).toContain('User: "..??.."');
    expect(prompt).toContain("Intent: unknown");

    expect(prompt).toContain('User: "anh Hùng mua 20 bao xi măng"');
    expect(prompt).toContain('User: "chị Lan lấy 5 khối cát"');
    expect(prompt).toContain('User: "anh Đạt mua 10 bao xi măng 100k"');
    expect(prompt).toContain('User: "Bán cho cô Lan 10 bao xi măng 85k, nợ"');
    expect(prompt).toContain('"bán cho anh Tuấn 10 bao xi măng" => create_order');
    expect(prompt).toContain('User: "nhập hàng 1000 bao xi măng"');
    expect(prompt).toContain('User: "nhập kho 200 viên gạch"');
    expect(prompt).toContain("Thiếu nhà cung cấp sẽ được hỏi ở bước sau, KHÔNG phân loại unknown");
    expect(prompt).toContain('items: [{ product_name: "xi măng", quantity: 1000, unit: "bao", unit_price: null }]');
    expect(prompt).toContain('items: [{ product_name: "gạch", quantity: 200, unit: "viên", unit_price: null }]');
  });

  it("includes manage_product guidance and few-shot examples", () => {
    const prompt = buildExtractIntentPrompt({
      rawText: "đổi đơn vị thép phi 12 thành cây",
      todayISO: "2026-06-01",
    });

    expect(prompt).toContain("manage_product: quản lý danh mục hàng hóa");
    expect(prompt).toContain("entities.product_management");
    expect(prompt).toContain("manage_product KHÔNG phải giao dịch bán/nhập");

    expect(prompt).toContain('User: "đổi đơn vị thép phi 12 thành cây"');
    expect(prompt).toContain('product_management: { action: "set_unit", product_raw: "thép phi 12", unit: "cây", sell_price: null }');
    expect(prompt).toContain('User: "xi măng tính theo bao"');
    expect(prompt).toContain('product_management: { action: "set_unit", product_raw: "xi măng", unit: "bao", sell_price: null }');
    expect(prompt).toContain('User: "đặt giá xi măng 80k"');
    expect(prompt).toContain('product_management: { action: "set_price", product_raw: "xi măng", unit: null, sell_price: 80000 }');
    expect(prompt).toContain('User: "giá cát vàng 250k"');
    expect(prompt).toContain('product_management: { action: "set_price", product_raw: "cát vàng", unit: null, sell_price: 250000 }');
    expect(prompt).toContain('User: "thêm hàng cát vàng"');
    expect(prompt).toContain('product_management: { action: "create", product_raw: "cát vàng", unit: null, sell_price: null }');
  });
});
