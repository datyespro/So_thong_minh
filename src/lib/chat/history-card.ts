import { z } from "zod";

const HistoryCommitCardItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  line_total: z.number(),
});

const HistoryCommitCardSchema = z.object({
  v: z.literal(1),
  kind: z.enum(["create_order", "record_payment", "create_purchase", "edit_order"]),
  entity_name: z.string().nullable(),
  business_date: z.string().nullable(),
  total_amount: z.number().nullable(),
  debt_amount: z.number().nullable(),
  amount: z.number().nullable(),
  items: z.array(HistoryCommitCardItemSchema).nullable(),
  source_id: z.string().min(1),
});

export type HistoryCommitCard = z.infer<typeof HistoryCommitCardSchema>;
export type HistoryCommitCardItem = z.infer<typeof HistoryCommitCardItemSchema>;

export function parseHistoryCommitCard(metadata: unknown): HistoryCommitCard | null {
  if (!metadata || typeof metadata !== "object" || !("card" in metadata)) {
    return null;
  }

  const parsed = HistoryCommitCardSchema.safeParse(
    (metadata as { card?: unknown }).card,
  );

  return parsed.success ? parsed.data : null;
}
