import { z } from "zod";
import {
  ExtractedItemSchema,
  IntentNameSchema,
  PaymentStatusSchema,
} from "@/src/lib/ai/intent-schema";

export const ResolveStatusSchema = z.enum([
  "resolved",
  "needs_confirmation",
  "ambiguous",
  "not_found",
]);

export const EntityTypeSchema = z.enum(["customer", "supplier", "product"]);

export const MatchKindSchema = z.enum([
  "name_exact",
  "alias_exact",
  "fuzzy",
]);

export const EntityCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1).nullable().optional(),
  sell_price: z.number().nullable().optional(),
  score: z.number().min(0).max(1),
  matched_on: MatchKindSchema,
  matched_value: z.string().min(1),
});

export const ResolvedEntitySchema = z.object({
  raw: z.string().nullable(),
  entity_type: EntityTypeSchema,
  status: ResolveStatusSchema,
  resolved_id: z.string().nullable(),
  resolved_name: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  candidates: z.array(EntityCandidateSchema).max(3),
});

export const ResolvedItemSchema = ExtractedItemSchema.extend({
  resolution: ResolvedEntitySchema,
});

export const OverallResolveStatusSchema = z.enum([
  "all_resolved",
  "needs_confirmation",
  "has_unresolved",
]);

export const ResolvedIntentSchema = z.object({
  intent: IntentNameSchema,
  raw_text: z.string(),
  amount: z.number().nullable().optional(),
  payment_status: PaymentStatusSchema.optional(),
  payment_method: z.string().nullable().optional(),
  customer: ResolvedEntitySchema.nullable(),
  supplier: ResolvedEntitySchema.nullable(),
  items: z.array(ResolvedItemSchema),
  overall_status: OverallResolveStatusSchema,
  needs_confirmation: z.boolean(),
});

export type ResolveStatus = z.infer<typeof ResolveStatusSchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type MatchKind = z.infer<typeof MatchKindSchema>;
export type EntityCandidate = z.infer<typeof EntityCandidateSchema>;
export type ResolvedEntity = z.infer<typeof ResolvedEntitySchema>;
export type ResolvedItem = z.infer<typeof ResolvedItemSchema>;
export type OverallResolveStatus = z.infer<
  typeof OverallResolveStatusSchema
>;
export type ResolvedIntent = z.infer<typeof ResolvedIntentSchema>;
