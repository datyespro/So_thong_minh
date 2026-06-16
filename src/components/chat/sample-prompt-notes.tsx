"use client";

import { cn } from "@/src/lib/utils";

export const SAMPLE_PROMPTS = [
  {
    tag: "GHI ĐƠN",
    tone: "order",
    text: "anh Hùng mua 20 bao xi măng 100k 1 bao",
  },
  {
    tag: "THU NỢ",
    tone: "payment",
    text: "anh Tuấn trả nợ 500k",
  },
  {
    tag: "HỎI",
    tone: "query",
    text: "anh Hùng còn nợ bao nhiêu?",
  },
  {
    tag: "BÁO CÁO",
    tone: "report",
    text: "doanh thu hôm nay",
  },
] as const;

type SamplePrompt = (typeof SAMPLE_PROMPTS)[number];

type SamplePromptNotesProps = Readonly<{
  onPick: (text: string) => void;
}>;

const toneClasses: Record<SamplePrompt["tone"], string> = {
  order: "text-debt",
  payment: "text-paid",
  query: "text-ink",
  report: "text-stamp",
};

const rotationClasses = [
  "-rotate-[1.2deg]",
  "rotate-[0.7deg]",
  "-rotate-[0.5deg]",
  "rotate-[1.1deg]",
] as const;

export function SamplePromptNotes({ onPick }: SamplePromptNotesProps) {
  return (
    <div
      className="mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Mẫu tin nhắn"
    >
      {SAMPLE_PROMPTS.map((prompt, index) => (
        <button
          key={prompt.tag}
          type="button"
          className={cn(
            "group relative min-h-[132px] rounded border border-[#e9deae] bg-paperNote px-5 pb-5 pt-4 text-left shadow-[0_8px_18px_-14px_rgba(60,40,10,0.45),0_1px_0_#d9c97a] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:z-10 hover:-translate-y-1 hover:rotate-0 hover:border-stamp/35 hover:shadow-[0_16px_26px_-18px_rgba(60,40,10,0.45),0_2px_0_#d9c97a] focus-visible:rotate-0 focus-visible:ring-2 focus-visible:ring-ink active:translate-y-0",
            rotationClasses[index],
          )}
          aria-label={`Dùng mẫu: ${prompt.text}`}
          onClick={() => onPick(prompt.text)}
        >
          <span
            className="absolute -top-2 left-1/2 h-3.5 w-14 -translate-x-1/2 -rotate-[1.5deg] border-y border-amber-800/10 bg-yellow-100/80"
            aria-hidden="true"
          />
          <span
            className={cn(
              "font-mono text-[11px] font-semibold uppercase tracking-[0.18em]",
              toneClasses[prompt.tone],
            )}
          >
            {prompt.tag}
          </span>
          <span className="mt-3 block text-[16px] leading-7 text-textMain">
            {prompt.text}
          </span>
        </button>
      ))}
    </div>
  );
}
