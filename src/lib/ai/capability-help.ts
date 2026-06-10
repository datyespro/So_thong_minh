import { z } from "zod";

export type CapabilityCategory =
  | "general"
  | "how_order"
  | "how_payment"
  | "how_purchase";

export const CAPABILITY_CHIPS = {
  C1: "Bán cho anh Hùng 5 bao xi măng 90k",
  C2: "Anh Hùng trả 200k",
  C3: "Nhập 20 bao xi măng của đại lý Thành giá 70k",
  C4: "Anh Hùng nợ bao nhiêu?",
  C5: "Hôm nay bán được bao nhiêu?",
  C6: "Còn bao nhiêu xi măng?",
} as const;

const GENERAL_REPLY =
  "Dạ, em là Sổ Thông Minh — em thay cuốn sổ giấy của cửa hàng mình ạ. Bác cứ nhắn như nói chuyện: nhắn một câu là em ghi đơn bán, ghi thu nợ, ghi nhập hàng; hỏi một câu là em tra được khách nợ bao nhiêu, hôm nay bán được bao nhiêu, hàng còn bao nhiêu. Ghi nhầm thì bấm Hoàn tác ngay dưới thẻ. Bác bấm thử một ví dụ bên dưới ạ:";
const ORDER_REPLY =
  "Dạ bác nhắn kiểu: Bán cho [tên khách] [số lượng] [tên hàng] [giá]. Em hiện thẻ xem trước, bác xem đúng rồi bấm Ghi là vào sổ ạ.";
const PAYMENT_REPLY =
  "Dạ bác nhắn kiểu: [Tên khách] trả [số tiền]. Em hiện thẻ xem trước cho bác bấm Ghi ạ.";
const PURCHASE_REPLY =
  "Dạ bác nhắn kiểu: Nhập [số lượng] [tên hàng] của [tên mối] giá [giá] — nhớ kèm tên mối/nhà cung cấp em mới ghi được ạ.";

function normalizeCapabilityText(rawText: string) {
  return rawText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

export function detectCapabilityQuestion(
  rawText: string,
): CapabilityCategory | null {
  const text = normalizeCapabilityText(rawText);

  if (hasAny(text, ["ghi don the nao", "ghi don kieu gi", "ghi so the nao"])) {
    return "how_order";
  }
  if (hasAny(text, ["thu no the nao", "thu no kieu gi"])) {
    return "how_payment";
  }
  if (hasAny(text, ["nhap hang the nao", "nhap hang kieu gi"])) {
    return "how_purchase";
  }
  if (
    hasAny(text, [
      "lam duoc gi",
      "lam gi duoc",
      "co the lam gi",
      "giup duoc gi",
      "biet lam gi",
      "co chuc nang gi",
      "co tinh nang gi",
      "dung the nao",
      "dung sao",
      "dung nhu nao",
      "xai sao",
      "xai the nao",
      "su dung the nao",
      "huong dan",
      "chi toi cach dung",
      "chi em cach dung",
      "bat dau tu dau",
      "bat dau the nao",
      "day la app gi",
      "app nay la gi",
      "cai nay la cai gi",
      "so thong minh la gi",
    ])
  ) {
    return "general";
  }

  return null;
}

export function capabilityReply(category: CapabilityCategory) {
  if (category === "how_order") {
    return { content: ORDER_REPLY, chips: [CAPABILITY_CHIPS.C1] };
  }
  if (category === "how_payment") {
    return { content: PAYMENT_REPLY, chips: [CAPABILITY_CHIPS.C2] };
  }
  if (category === "how_purchase") {
    return { content: PURCHASE_REPLY, chips: [CAPABILITY_CHIPS.C3] };
  }
  return {
    content: GENERAL_REPLY,
    chips: [
      CAPABILITY_CHIPS.C1,
      CAPABILITY_CHIPS.C2,
      CAPABILITY_CHIPS.C3,
      CAPABILITY_CHIPS.C4,
      CAPABILITY_CHIPS.C5,
      CAPABILITY_CHIPS.C6,
    ],
  };
}

const CapabilityChipsMetadataSchema = z.object({
  chips: z.array(z.string().min(1).max(120)).min(1).max(6),
});

export function parseCapabilityChips(metadata: unknown): string[] | null {
  const parsed = CapabilityChipsMetadataSchema.safeParse(metadata);
  return parsed.success ? parsed.data.chips : null;
}
