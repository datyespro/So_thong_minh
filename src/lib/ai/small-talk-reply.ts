import { generateText } from "ai";
import { getIntentModel } from "@/src/lib/ai/provider";

export const SMALL_TALK_TIMEOUT_MS = 3000;
export const SMALL_TALK_MAX_REPLY_CHARS = 300;

// Rọ 5 điều (gói curated v1 mục E). Đổi prompt = đổi hành vi rọ, phải qua duyệt.
const SMALL_TALK_SYSTEM_PROMPT = [
  'Bạn là "em" — trợ lý của cuốn sổ ghi chép cho một cửa hàng vật liệu xây dựng ở Việt Nam, đang trò chuyện với chủ cửa hàng. Luôn gọi người nói chuyện là "bác", xưng "em".',
  "Luật bắt buộc, không có ngoại lệ:",
  '1. Trả lời tối đa 2 câu tiếng Việt, lễ phép, có "Dạ" hoặc "ạ". Không dùng emoji, markdown hay icon.',
  '2. TUYỆT ĐỐI không nói hay bịa bất kỳ con số nghiệp vụ nào (tiền nợ, doanh thu, tồn kho, giá cả). Nếu bác hỏi số liệu, chỉ trả lời: "Bác hỏi em kiểu anh Hùng nợ bao nhiêu là em tra liền ạ."',
  "3. Không nhận là đã ghi, đã sửa hay đã xoá bất cứ thứ gì trong sổ.",
  "4. Không hứa hẹn tính năng mới; không tư vấn pháp lý hay tài chính.",
  "5. Nếu câu chuyện lạc đề xa khỏi cửa hàng, đáp đúng một câu lễ phép rồi lái về chuyện cửa hàng.",
].join("\n");

type GenerateSmallTalkText = (input: {
  system: string;
  prompt: string;
}) => Promise<string>;

export type GenerateSmallTalkReplyInput = {
  rawText: string;
  generate?: GenerateSmallTalkText;
};

// Defense-in-depth: nghi có số liệu nghiệp vụ thì thà fallback còn hơn.
// "đ" không phải word-char nên không đứng được trước \b — tách riêng (D2 đã duyệt).
const BUSINESS_NUMBER_PATTERN =
  /\d{4,}|\d+\s*(k|nghìn|ngàn|triệu|tr|vnd)\b|\d+\s*đ/i;

export function guardSmallTalkReply(text: string): string | null {
  const trimmed = text.trim();

  if (trimmed.length === 0 || trimmed.length > SMALL_TALK_MAX_REPLY_CHARS) {
    return null;
  }

  if (BUSINESS_NUMBER_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

async function defaultGenerateSmallTalkText(input: {
  system: string;
  prompt: string;
}): Promise<string> {
  const result = await generateText({
    model: getIntentModel(),
    system: input.system,
    prompt: input.prompt,
    temperature: 0.6,
    maxOutputTokens: 100,
    abortSignal: AbortSignal.timeout(SMALL_TALK_TIMEOUT_MS),
  });

  return result.text;
}

export async function generateSmallTalkReply(
  input: GenerateSmallTalkReplyInput,
): Promise<string | null> {
  const rawText = input.rawText.trim();

  if (rawText.length === 0) {
    return null;
  }

  const generate = input.generate ?? defaultGenerateSmallTalkText;

  try {
    const text = await generate({
      system: SMALL_TALK_SYSTEM_PROMPT,
      prompt: rawText,
    });

    return guardSmallTalkReply(text);
  } catch {
    // Timeout / thiếu key / lỗi mạng → null, actions.ts đi đường fallback cũ.
    return null;
  }
}
