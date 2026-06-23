import { z } from "zod";

export const IntentNameSchema = z.enum([
  "create_order",
  "record_payment",
  "create_purchase",
  "manage_product",
  "manage_customer",
  "query_debt",
  "query_inventory",
  "query_sales",
  "edit_order",
  "undo",
  "small_talk",
  "unknown",
]);

export const PaymentStatusSchema = z.enum([
  "paid",
  "partial",
  "debt",
  "unknown",
]);

export const TimeRangeSchema = z.object({
  raw: z.string().nullable(),
  kind: z
    .enum(["today", "yesterday", "this_week", "this_month", "custom", "unknown"])
    .default("unknown"),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

export const TimeRangeOutputSchema = z.object({
  raw: z.string().nullable(),
  kind: z.enum([
    "today",
    "yesterday",
    "this_week",
    "this_month",
    "custom",
    "unknown",
  ]),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

export const ExtractedItemSchema = z.object({
  raw: z.string(),
  product_name: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ProductManagementActionSchema = z.enum([
  "set_unit",
  "set_price",
  "create",
  "delete",
]);

export const ProductManagementSchema = z.object({
  action: ProductManagementActionSchema,
  product_raw: z.string(),
  unit: z.string().nullable(),
  sell_price: z.number().nullable(),
});

export const CustomerManagementActionSchema = z.enum(["rename", "set_phone"]);
export type CustomerManagementAction = z.infer<
  typeof CustomerManagementActionSchema
>;

export const CustomerManagementSchema = z.object({
  action: CustomerManagementActionSchema,
  customer_raw: z.string(),
  new_name: z.string().nullable(),
  phone_raw: z.string().nullable().default(null),
});
export type CustomerManagement = z.infer<typeof CustomerManagementSchema>;

const CustomerManagementOutputSchema = z.object({
  action: CustomerManagementActionSchema,
  customer_raw: z.string(),
  new_name: z.string().nullable(),
  phone_raw: z.string().nullable(),
});

export const ExtractedIntentSchema = z.object({
  intent: IntentNameSchema,
  confidence: z.number().min(0).max(1),
  raw_text: z.string(),
  normalized_text: z.string(),
  language: z.enum(["vi", "mixed", "unknown"]).default("vi"),

  entities: z.object({
    customer_name: z.string().nullable(),
    supplier_name: z.string().nullable(),
    product_name: z.string().nullable(),
    product_management: ProductManagementSchema.nullable().default(null),
    customer_management: CustomerManagementSchema.nullable().default(null),
    items: z.array(ExtractedItemSchema).default([]),
    amount: z.number().nullable(),
    paid_amount: z.number().nullable().default(null),
    payment_status: PaymentStatusSchema.default("unknown"),
    payment_method: z.string().nullable(),
    payment_scope_raw: z.string().nullable().default(null),
    order_reference: z.string().nullable(),
    business_date: z.string().nullable(),
    time_range: TimeRangeSchema,
  }),

  missing_info: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  needs_confirmation: z.boolean(),
  next_stage_hint: z.enum([
    "resolve_entities",
    "ask_clarifying_question",
    "answer_small_talk",
    "reject",
  ]),
});

export const ExtractedIntentOutputSchema = z.object({
  intent: IntentNameSchema,
  confidence: z.number().min(0).max(1),
  raw_text: z.string(),
  normalized_text: z.string(),
  language: z.enum(["vi", "mixed", "unknown"]),

  entities: z.object({
    customer_name: z.string().nullable(),
    supplier_name: z.string().nullable(),
    product_name: z.string().nullable(),
    product_management: ProductManagementSchema.nullable(),
    customer_management: CustomerManagementOutputSchema.nullable(),
    items: z.array(ExtractedItemSchema),
    amount: z.number().nullable(),
    paid_amount: z.number().nullable(),
    payment_status: PaymentStatusSchema,
    payment_method: z.string().nullable(),
    payment_scope_raw: z.string().nullable(),
    order_reference: z.string().nullable(),
    business_date: z.string().nullable(),
    time_range: TimeRangeOutputSchema,
  }),

  missing_info: z.array(z.string()),
  warnings: z.array(z.string()),
  needs_confirmation: z.boolean(),
  next_stage_hint: z.enum([
    "resolve_entities",
    "ask_clarifying_question",
    "answer_small_talk",
    "reject",
  ]),
});

export type IntentName = z.infer<typeof IntentNameSchema>;
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type ProductManagement = z.infer<typeof ProductManagementSchema>;
export type ExtractedIntent = z.infer<typeof ExtractedIntentSchema>;
