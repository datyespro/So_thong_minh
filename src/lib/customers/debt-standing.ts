import { formatVietnameseMoney } from "@/src/lib/format/money";
import { vietnameseAmountInWords } from "@/src/lib/format/number-to-words-vi";

// VĐ3: debt_total có thể xuống ÂM (khách trả/đặt trước → mình nợ lại khách).
// Đây là NGUỒN QUYẾT ĐỊNH DẤU DUY NHẤT cho mọi surface hiển thị "standing".
export type DebtStanding =
  | { kind: "debt"; amount: number } // khách đang nợ mình
  | { kind: "credit"; amount: number } // khách trả trước → mình nợ lại khách
  | { kind: "settled" }; // = 0

export function debtStanding(debtTotal: number): DebtStanding {
  if (debtTotal > 0) return { kind: "debt", amount: debtTotal };
  if (debtTotal < 0) return { kind: "credit", amount: -debtTotal };
  return { kind: "settled" };
}

// Câu trả lời truy vấn nợ (terminal-text + tái dùng được).
export function debtStandingSentence(name: string, debtTotal: number): string {
  const s = debtStanding(debtTotal);
  if (s.kind === "debt") return `${name} đang nợ ${formatVietnameseMoney(s.amount)}`;
  if (s.kind === "credit")
    return `${name} đã trả trước ${formatVietnameseMoney(s.amount)} (mình đang nợ lại khách) ạ.`;
  return `${name} không còn nợ ạ.`;
}

// Dòng cuối khối đối chiếu khách (#24/#31): ">=0" → "Còn nợ X" (debt);
// "<0" → "Khách trả trước |X|" (credit). settled → "Còn nợ 0" (giữ hành vi cũ).
export function reconciliationFinalLine(debtTotal: number): {
  label: string;
  amount: number;
  tone: "debt" | "credit";
} {
  const s = debtStanding(debtTotal);
  if (s.kind === "credit") {
    return { label: "Khách trả trước", amount: s.amount, tone: "credit" };
  }
  return { label: "Còn nợ", amount: s.kind === "debt" ? s.amount : 0, tone: "debt" };
}

// Dòng tổng cuối của BẢN IN đối chiếu (#TIP-INV-CREDIT-1). Tái dùng debtStanding
// làm nguồn dấu duy nhất → "amount"/"words" LUÔN dương, không bao giờ ra chữ "Âm".
// credit (<0) → đổi nhãn "Khách trả trước" + câu diễn giải; debt/settled giữ y cũ.
export function reconciliationPrintFinalLine(debtTotal: number): {
  label: string;
  amount: number;
  words: string;
  note?: string;
} {
  const s = debtStanding(debtTotal);
  if (s.kind === "credit") {
    return {
      label: "= Khách trả trước",
      amount: s.amount,
      words: vietnameseAmountInWords(s.amount),
      note: `Cửa hàng đang giữ trước của khách ${formatVietnameseMoney(s.amount)}, sẽ trừ vào đơn sau.`,
    };
  }
  const amount = s.kind === "debt" ? s.amount : 0;
  return {
    label: "= Còn nợ cuối kỳ",
    amount,
    words: vietnameseAmountInWords(amount),
  };
}
