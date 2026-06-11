import { z } from "zod";
import { IntentNameSchema } from "@/src/lib/ai/intent-schema";
import {
  ResolvedEntitySchema,
  ResolvedItemSchema,
} from "@/src/lib/ai/resolve-schema";

export const ValidationSeveritySchema = z.enum([
  "blocking",
  "warning",
  "info",
]);

export const ValidationCodeSchema = z.enum([
  "missing_customer",
  "customer_unresolved",
  "missing_supplier",
  "supplier_unresolved",
  "no_items",
  "product_unresolved",
  "invalid_quantity",
  "missing_price",
  "price_autofilled",
  "unit_mismatch",
  "missing_amount",
  "invalid_amount",
  "overpayment",
  "payment_status_unknown",
  "payment_method_unknown",
]);

export const ValidationIssueSchema = z.object({
  code: ValidationCodeSchema,
  severity: ValidationSeveritySchema,
  message: z.string().min(1),
  field_path: z.string().nullable(),
  item_index: z.number().int().min(0).nullable(),
});

export const ValidatedLineItemSchema = ResolvedItemSchema.extend({
  effective_quantity: z.number().nullable(),
  effective_unit: z.string().nullable(),
  effective_unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
  issues: z.array(ValidationIssueSchema),
});

export const ValidationKindSchema = z.enum([
  "writable",
  "query",
  "edit",
  "undo",
  "none",
]);

export const ValidatedIntentSchema = z.object({
  intent: IntentNameSchema,
  kind: ValidationKindSchema,
  raw_text: z.string(),
  business_date: z.string().nullable().optional(),
  customer: ResolvedEntitySchema.nullable(),
  supplier: ResolvedEntitySchema.nullable(),
  items: z.array(ValidatedLineItemSchema),
  effective_amount: z.number().nullable(),
  issues: z.array(ValidationIssueSchema),
  ready_for_preview: z.boolean(),
  blocking_count: z.number().int().min(0),
  warning_count: z.number().int().min(0),
});

export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;
export type ValidationCode = z.infer<typeof ValidationCodeSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ValidatedLineItem = z.infer<typeof ValidatedLineItemSchema>;
export type ValidationKind = z.infer<typeof ValidationKindSchema>;
export type ValidatedIntent = z.infer<typeof ValidatedIntentSchema>;
