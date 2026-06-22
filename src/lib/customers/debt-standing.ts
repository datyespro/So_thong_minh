import { formatVietnameseMoney } from "@/src/lib/format/money";

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
