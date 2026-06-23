import { describe, expect, it } from "vitest";
import {
  ExtractedIntentSchema,
  ExtractedIntentOutputSchema,
  IntentNameSchema,
  type ExtractedIntent,
} from "@/src/lib/ai/intent-schema";

function baseIntent(
  overrides: Partial<ExtractedIntent> = {},
): ExtractedIntent {
  return {
    intent: "create_order",
    confidence: 0.92,
    raw_text: "Bán cho cô Lan 10 bao xi măng 85k, nợ",
    normalized_text: "bán cho cô Lan 10 bao xi măng 85000, nợ",
    language: "vi",
    entities: {
      customer_name: "cô Lan",
      supplier_name: null,
      product_name: "xi măng",
      product_management: null,
      customer_management: null,
      items: [
        {
          raw: "10 bao xi măng 85k",
          product_name: "xi măng",
          quantity: 10,
          unit: "bao",
          unit_price: 85000,
          line_total: null,
          confidence: 0.9,
        },
      ],
      amount: null,
      paid_amount: null,
      payment_status: "debt",
      payment_method: null,
      payment_scope_raw: null,
      order_reference: null,
      business_date: null,
      time_range: {
        raw: null,
        kind: "unknown",
        start_date: null,
        end_date: null,
      },
    },
    missing_info: [],
    warnings: [],
    needs_confirmation: true,
    next_stage_hint: "resolve_entities",
    ...overrides,
  };
}

describe("IntentNameSchema", () => {
  it("contains every required intent", () => {
    expect(IntentNameSchema.options).toEqual([
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
  });
});

describe("ExtractedIntentSchema", () => {
  it("accepts a valid create_order output", () => {
    expect(ExtractedIntentSchema.parse(baseIntent()).intent).toBe(
      "create_order",
    );
  });

  it("accepts a valid record_payment output", () => {
    const parsed = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "record_payment",
        raw_text: "Cô Lan trả 500k",
        normalized_text: "cô Lan trả 500000",
        entities: {
          ...baseIntent().entities,
          product_name: null,
          items: [],
          amount: 500000,
          payment_status: "paid",
        },
      }),
    );

    expect(parsed.entities.amount).toBe(500000);
  });

  it("accepts a valid query_inventory output", () => {
    const parsed = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "query_inventory",
        raw_text: "Còn bao nhiêu xi măng?",
        normalized_text: "còn bao nhiêu xi măng?",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(parsed.intent).toBe("query_inventory");
  });

  it("accepts manage_product set_unit, set_price, and create outputs", () => {
    const setUnit = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "manage_product",
        raw_text: "đổi đơn vị thép phi 12 thành cây",
        normalized_text: "đổi đơn vị thép phi 12 thành cây",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          product_name: "thép phi 12",
          product_management: {
            action: "set_unit",
            product_raw: "thép phi 12",
            unit: "cây",
            sell_price: null,
          },
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(setUnit.entities.product_management).toEqual({
      action: "set_unit",
      product_raw: "thép phi 12",
      unit: "cây",
      sell_price: null,
    });

    const setPrice = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "manage_product",
        raw_text: "đặt giá xi măng 80k",
        normalized_text: "đặt giá xi măng 80000",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          product_name: "xi măng",
          product_management: {
            action: "set_price",
            product_raw: "xi măng",
            unit: null,
            sell_price: 80000,
          },
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(setPrice.entities.product_management?.sell_price).toBe(80000);

    const create = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "manage_product",
        raw_text: "thêm hàng cát vàng",
        normalized_text: "thêm hàng cát vàng",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          product_name: "cát vàng",
          product_management: {
            action: "create",
            product_raw: "cát vàng",
            unit: null,
            sell_price: null,
          },
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(create.entities.product_management?.action).toBe("create");

  });

  it("accepts a manage_product delete output with nullable fields", () => {
    const deleteProduct = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "manage_product",
        raw_text: "xóa sản phẩm fff",
        normalized_text: "xóa sản phẩm fff",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          product_name: "fff",
          product_management: {
            action: "delete",
            product_raw: "fff",
            unit: null,
            sell_price: null,
          },
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(deleteProduct.entities.product_management).toEqual({
      action: "delete",
      product_raw: "fff",
      unit: null,
      sell_price: null,
    });
  });

  it("accepts a manage_customer rename output with nullable new_name", () => {
    const rename = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "manage_customer",
        raw_text: "đổi tên chị lan thành Lan xóm Nghè",
        normalized_text: "đổi tên chị lan thành Lan xóm Nghè",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          product_name: null,
          product_management: null,
          customer_management: {
            action: "rename",
            customer_raw: "chị lan",
            new_name: "Lan xóm Nghè",
            phone_raw: null,
          },
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(rename.entities.customer_management).toEqual({
      action: "rename",
      customer_raw: "chị lan",
      new_name: "Lan xóm Nghè",
      phone_raw: null,
    });

    const missingNewName = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "manage_customer",
        raw_text: "đổi tên chị lan",
        normalized_text: "đổi tên chị lan",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          product_name: null,
          product_management: null,
          customer_management: {
            action: "rename",
            customer_raw: "chị lan",
            new_name: null,
            phone_raw: null,
          },
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(missingNewName.entities.customer_management?.new_name).toBeNull();
  });

  it("defaults missing internal product_management to null", () => {
    const withoutProductManagement = {
      ...baseIntent(),
      entities: {
        ...baseIntent().entities,
      } as Partial<ExtractedIntent["entities"]>,
    };
    delete withoutProductManagement.entities.product_management;

    const parsed = ExtractedIntentSchema.parse(withoutProductManagement);

    expect(parsed.entities.product_management).toBeNull();
  });

  it("defaults missing internal customer_management to null", () => {
    const withoutCustomerManagement = {
      ...baseIntent(),
      entities: {
        ...baseIntent().entities,
      } as Partial<ExtractedIntent["entities"]>,
    };
    delete withoutCustomerManagement.entities.customer_management;

    const parsed = ExtractedIntentSchema.parse(withoutCustomerManagement);

    expect(parsed.entities.customer_management).toBeNull();
  });

  it("requires output management entities to be explicitly null or populated", () => {
    const output = {
      ...baseIntent(),
      entities: {
        ...baseIntent().entities,
        product_management: null,
        customer_management: null,
        items: baseIntent().entities.items,
        payment_status: "debt",
        time_range: {
          raw: null,
          kind: "unknown",
          start_date: null,
          end_date: null,
        },
      },
    };

    expect(ExtractedIntentOutputSchema.parse(output).entities.product_management).toBeNull();
    expect(ExtractedIntentOutputSchema.parse(output).entities.customer_management).toBeNull();

    const missingOutput = {
      ...output,
      entities: {
        ...output.entities,
      },
    };
    delete (missingOutput.entities as Partial<typeof output.entities>)
      .product_management;

    expect(() => ExtractedIntentOutputSchema.parse(missingOutput)).toThrow();

    const missingCustomerOutput = {
      ...output,
      entities: {
        ...output.entities,
      },
    };
    delete (missingCustomerOutput.entities as Partial<typeof output.entities>)
      .customer_management;

    expect(() =>
      ExtractedIntentOutputSchema.parse(missingCustomerOutput),
    ).toThrow();
  });

  it("rejects confidence below 0", () => {
    expect(() =>
      ExtractedIntentSchema.parse(baseIntent({ confidence: -0.1 })),
    ).toThrow();
  });

  it("rejects confidence above 1", () => {
    expect(() =>
      ExtractedIntentSchema.parse(baseIntent({ confidence: 1.5 })),
    ).toThrow();
  });

  it("rejects invalid intent", () => {
    expect(() =>
      ExtractedIntentSchema.parse({
        ...baseIntent(),
        intent: "delete_everything",
      }),
    ).toThrow();
  });

  it("allows item quantity to be null", () => {
    const parsed = ExtractedIntentSchema.parse(
      baseIntent({
        entities: {
          ...baseIntent().entities,
          items: [
            {
              ...baseIntent().entities.items[0],
              quantity: null,
            },
          ],
        },
      }),
    );

    expect(parsed.entities.items[0].quantity).toBeNull();
  });

  it("defaults missing_info to an empty array", () => {
    const withoutMissingInfo = baseIntent() as Partial<ExtractedIntent>;
    delete withoutMissingInfo.missing_info;
    const parsed = ExtractedIntentSchema.parse(withoutMissingInfo);

    expect(parsed.missing_info).toEqual([]);
  });
});
