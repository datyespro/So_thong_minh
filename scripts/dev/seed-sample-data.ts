import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type MasterTable = "customers" | "products" | "suppliers";

type MasterRow = {
  id: string;
  name: string;
};

type SeedResult = {
  table: MasterTable;
  name: string;
  action: "inserted" | "updated";
};

type SeedSummaryRow = {
  name: string;
  aliases: string[] | null;
};

type ProductSummaryRow = SeedSummaryRow & {
  unit: string;
  sell_price: number | string | null;
};

const DEFAULT_OWNER_EMAIL = "dat@test.com";
const SEED_NOTE = "TIP-SEED sample data";

const customers = [
  {
    name: "anh Hùng",
    aliases: ["hùng", "anh hung"],
  },
  {
    name: "anh Tuấn",
    aliases: ["tuấn"],
  },
  {
    name: "chị Lan",
    aliases: ["lan"],
  },
  {
    name: "anh Đạt",
    aliases: ["đạt"],
  },
] as const;

const products = [
  {
    name: "xi măng",
    unit: "bao",
    sell_price: 100000,
    aliases: ["xi măng hoàng thạch", "ximang", "xi mang"],
  },
  {
    name: "cát",
    unit: "khối",
    sell_price: 350000,
    aliases: ["cát vàng", "cat"],
  },
  {
    name: "gạch",
    unit: "viên",
    sell_price: 1500,
    aliases: ["gạch ống", "gach"],
  },
  {
    name: "thép phi 6",
    unit: "cây",
    sell_price: 95000,
    aliases: ["thép 6", "sat phi 6"],
  },
] as const;

const suppliers = [
  {
    name: "Đại lý Minh Phát",
    aliases: ["minh phát", "minh phat"],
  },
  {
    name: "Vật liệu Sông Hồng",
    aliases: ["sông hồng"],
  },
] as const;

class SeedAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedAbort";
  }
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase("vi-VN");
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function assertLocalSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    throw new SeedAbort(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL. Refusing to seed.",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SeedAbort(`Invalid Supabase URL: ${rawUrl}`);
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!localHosts.has(parsed.hostname)) {
    throw new SeedAbort(
      `Refusing to seed non-local Supabase URL (${rawUrl}). Use localhost/127.0.0.1 only.`,
    );
  }

  return rawUrl;
}

async function findOwnerId(
  supabase: SupabaseClient,
  ownerEmail: string,
): Promise<string> {
  const normalizedEmail = ownerEmail.trim().toLocaleLowerCase("en-US");
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (item) => item.email?.toLocaleLowerCase("en-US") === normalizedEmail,
    );

    if (user) {
      return user.id;
    }

    if (data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  throw new SeedAbort(
    `Local auth user ${ownerEmail} was not found. Create/login that user first, then rerun seed:sample.`,
  );
}

async function fetchExistingRows(
  supabase: SupabaseClient,
  table: MasterTable,
  ownerId: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select("id,name")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as MasterRow[]).map((row) => [
      normalizeName(row.name),
      row,
    ]),
  );
}

async function upsertMasterRow(
  supabase: SupabaseClient,
  table: MasterTable,
  ownerId: string,
  payload: Record<string, unknown>,
) {
  const rows = await fetchExistingRows(supabase, table, ownerId);
  const name = String(payload.name);
  const existing = rows.get(normalizeName(name));

  if (existing) {
    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw error;
    }

    return "updated" as const;
  }

  const { error } = await supabase.from(table).insert({
    owner_id: ownerId,
    ...payload,
  });

  if (error) {
    throw error;
  }

  return "inserted" as const;
}

async function seedCustomers(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const customer of customers) {
    const action = await upsertMasterRow(supabase, "customers", ownerId, {
      name: customer.name,
      aliases: [...customer.aliases],
      note: SEED_NOTE,
      is_active: true,
      deleted_at: null,
    });

    results.push({
      table: "customers",
      name: customer.name,
      action,
    });
  }

  return results;
}

async function seedProducts(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const product of products) {
    const action = await upsertMasterRow(supabase, "products", ownerId, {
      name: product.name,
      unit: product.unit,
      sell_price: product.sell_price,
      aliases: [...product.aliases],
      note: SEED_NOTE,
      is_active: true,
      deleted_at: null,
    });

    results.push({
      table: "products",
      name: product.name,
      action,
    });
  }

  return results;
}

async function seedSuppliers(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const supplier of suppliers) {
    const action = await upsertMasterRow(supabase, "suppliers", ownerId, {
      name: supplier.name,
      aliases: [...supplier.aliases],
      note: SEED_NOTE,
      is_active: true,
      deleted_at: null,
    });

    results.push({
      table: "suppliers",
      name: supplier.name,
      action,
    });
  }

  return results;
}

async function listSeededRows(
  supabase: SupabaseClient,
  ownerId: string,
  table: MasterTable,
  names: readonly string[],
) {
  const { data, error } = await supabase
    .from(table)
    .select(
      table === "products"
        ? "name,aliases,unit,sell_price"
        : "name,aliases",
    )
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("name", [...names])
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as Array<SeedSummaryRow | ProductSummaryRow>;
}

async function main() {
  loadEnvConfig(process.cwd());

  const supabaseUrl = assertLocalSupabaseUrl(getSupabaseUrl());
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new SeedAbort(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Local seed needs service-role after localhost guard passes.",
    );
  }

  const ownerEmail = process.env.SEED_SAMPLE_OWNER_EMAIL ?? DEFAULT_OWNER_EMAIL;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const ownerId = await findOwnerId(supabase, ownerEmail);
  const results = [
    ...(await seedCustomers(supabase, ownerId)),
    ...(await seedProducts(supabase, ownerId)),
    ...(await seedSuppliers(supabase, ownerId)),
  ];

  console.log(`TIP-SEED owner: ${ownerEmail} (${ownerId})`);
  console.log(
    `TIP-SEED writes: ${results
      .map((result) => `${result.table}:${result.name}:${result.action}`)
      .join(", ")}`,
  );
  console.log(
    "TIP-SEED customers:",
    await listSeededRows(
      supabase,
      ownerId,
      "customers",
      customers.map((item) => item.name),
    ),
  );
  console.log(
    "TIP-SEED products:",
    await listSeededRows(
      supabase,
      ownerId,
      "products",
      products.map((item) => item.name),
    ),
  );
  console.log(
    "TIP-SEED suppliers:",
    await listSeededRows(
      supabase,
      ownerId,
      "suppliers",
      suppliers.map((item) => item.name),
    ),
  );
}

main().catch((error: unknown) => {
  if (error instanceof SeedAbort) {
    console.error(`TIP-SEED aborted: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.error("TIP-SEED failed:", error);
  process.exitCode = 1;
});
