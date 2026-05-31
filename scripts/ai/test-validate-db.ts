import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { validateIntent } from "@/src/lib/ai/validate-intent";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type { ResolvedEntity, ResolvedIntent } from "@/src/lib/ai/resolve-schema";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = "Tip005a-password-12345";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function customer(id: string): ResolvedEntity {
  return {
    raw: "c\u00f4 Lan",
    entity_type: "customer",
    status: "resolved",
    resolved_id: id,
    resolved_name: "C\u00f4 Lan",
    confidence: 1,
    candidates: [
      {
        id,
        name: "C\u00f4 Lan",
        score: 1,
        matched_on: "name_exact",
        matched_value: "C\u00f4 Lan",
      },
    ],
  };
}

function productItem(productId: string, name: string) {
  return {
    raw: `5 bao ${name}`,
    product_name: name,
    quantity: 5,
    unit: "bao",
    unit_price: null,
    line_total: null,
    confidence: 0.95,
    resolution: {
      raw: name,
      entity_type: "product" as const,
      status: "resolved" as const,
      resolved_id: productId,
      resolved_name: name,
      confidence: 1,
      candidates: [
        {
          id: productId,
          name,
          score: 1,
          matched_on: "name_exact" as const,
          matched_value: name,
        },
      ],
    },
  };
}

function resolvedOrder(
  customerId: string,
  productIds: {
    priced: string;
    noPrice: string;
    foreign: string;
  },
): ResolvedIntent {
  return {
    intent: "create_order",
    raw_text: "Ban cho co Lan xi mang va gach",
    amount: null,
    payment_status: "paid",
    payment_method: "cash",
    customer: customer(customerId),
    supplier: {
      raw: null,
      entity_type: "supplier",
      status: "not_found",
      resolved_id: null,
      resolved_name: null,
      confidence: 0,
      candidates: [],
    },
    items: [
      productItem(productIds.priced, "Xi m\u0103ng"),
      productItem(productIds.noPrice, "G\u1ea1ch ch\u01b0a gi\u00e1"),
      productItem(productIds.foreign, "Th\u00e9p user B"),
    ],
    overall_status: "all_resolved",
    needs_confirmation: false,
  };
}

function hasItemIssue(
  validated: Awaited<ReturnType<typeof validateIntent>>,
  itemIndex: number,
  code: string,
) {
  return validated.items[itemIndex]?.issues.some((issue) => issue.code === code);
}

async function main() {
  assert(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required.");
  assert(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");

  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emailA = `tip005a-a-${suffix}@example.test`;
  const emailB = `tip005a-b-${suffix}@example.test`;
  let userAId: string | null = null;
  let userBId: string | null = null;

  try {
    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });

    if (createdA.error || !createdA.data.user) {
      throw createdA.error ?? new Error("Could not create user A.");
    }

    userAId = createdA.data.user.id;

    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });

    if (createdB.error || !createdB.data.user) {
      throw createdB.error ?? new Error("Could not create user B.");
    }

    userBId = createdB.data.user.id;

    const insertedCustomer = await admin
      .from("customers")
      .insert({
        owner_id: userAId,
        name: "C\u00f4 Lan",
        debt_total: 100000,
      })
      .select("id")
      .single();

    if (insertedCustomer.error || !insertedCustomer.data) {
      throw insertedCustomer.error ?? new Error("Could not create customer.");
    }

    const insertedProducts = await admin
      .from("products")
      .insert([
        {
          owner_id: userAId,
          name: "Xi m\u0103ng",
          unit: "bao",
          sell_price: 85000,
          cost_price: 78000,
        },
        {
          owner_id: userAId,
          name: "G\u1ea1ch ch\u01b0a gi\u00e1",
          unit: "bao",
          sell_price: null,
          cost_price: null,
        },
        {
          owner_id: userBId,
          name: "Th\u00e9p user B",
          unit: "bao",
          sell_price: 99000,
          cost_price: 90000,
        },
      ])
      .select("id,name,owner_id");

    if (insertedProducts.error || !insertedProducts.data) {
      throw insertedProducts.error ?? new Error("Could not create products.");
    }

    const priced = insertedProducts.data.find((row) => row.name === "Xi m\u0103ng");
    const noPrice = insertedProducts.data.find(
      (row) => row.name === "G\u1ea1ch ch\u01b0a gi\u00e1",
    );
    const foreign = insertedProducts.data.find(
      (row) => row.name === "Th\u00e9p user B",
    );

    assert(priced, "Priced product was not created.");
    assert(noPrice, "No-price product was not created.");
    assert(foreign, "Foreign product was not created.");

    const clientA = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const signedInA = await clientA.auth.signInWithPassword({
      email: emailA,
      password,
    });

    if (signedInA.error) {
      throw signedInA.error;
    }

    const validated = await validateIntent({
      resolved: resolvedOrder(insertedCustomer.data.id, {
        priced: priced.id,
        noPrice: noPrice.id,
        foreign: foreign.id,
      }),
      ownerId: userAId,
      supabase: clientA,
    });

    assert(
      hasItemIssue(validated, 0, "price_autofilled"),
      "Priced product should be autofilled.",
    );
    assert(
      validated.items[0]?.effective_unit_price === 85000,
      "Autofilled sell price should be 85000.",
    );
    assert(
      hasItemIssue(validated, 1, "missing_price"),
      "Product with null master price should block.",
    );
    assert(
      hasItemIssue(validated, 2, "missing_price"),
      "Foreign owner product must not be read or autofilled.",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          autofill_from_master: true,
          missing_price_from_null_master: true,
          owner_isolation: true,
          item_results: validated.items.map((item) => ({
            name: item.resolution.resolved_name,
            effective_unit_price: item.effective_unit_price,
            issues: item.issues.map((issue) => issue.code),
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    for (const ownerId of [userAId, userBId]) {
      if (ownerId) {
        await admin.from("customers").delete().eq("owner_id", ownerId);
        await admin.from("products").delete().eq("owner_id", ownerId);
        await admin.from("suppliers").delete().eq("owner_id", ownerId);
      }
    }

    if (userAId) {
      await admin.auth.admin.deleteUser(userAId);
    }

    if (userBId) {
      await admin.auth.admin.deleteUser(userBId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
