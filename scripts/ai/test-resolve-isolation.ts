import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { fetchOwnerEntities } from "@/src/lib/ai/resolve-entities";
import { createAdminClient } from "@/src/lib/supabase/admin";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = "Tip004-password-12345";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  assert(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required.");
  assert(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");

  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emailA = `tip004-a-${suffix}@example.test`;
  const emailB = `tip004-b-${suffix}@example.test`;
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

    const inserted = await admin.from("customers").insert([
      {
        owner_id: userAId,
        name: "C\u00f4 Lan",
        aliases: ["lan-a"],
      },
      {
        owner_id: userBId,
        name: "C\u00f4 Lan",
        aliases: ["lan-b"],
      },
    ]);

    if (inserted.error) {
      throw inserted.error;
    }

    const clientA = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const clientB = createClient(supabaseUrl, supabaseAnonKey, {
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

    const signedInB = await clientB.auth.signInWithPassword({
      email: emailB,
      password,
    });

    if (signedInB.error) {
      throw signedInB.error;
    }

    const rowsA = await fetchOwnerEntities(clientA, userAId);
    const rowsB = await fetchOwnerEntities(clientB, userBId);
    const crossRows = await fetchOwnerEntities(clientA, userBId);

    assert(rowsA.customers.length === 1, "User A should see one customer.");
    assert(rowsB.customers.length === 1, "User B should see one customer.");
    assert(
      rowsA.customers[0].aliases.includes("lan-a"),
      "User A should see only user A aliases.",
    );
    assert(
      rowsB.customers[0].aliases.includes("lan-b"),
      "User B should see only user B aliases.",
    );
    assert(
      crossRows.customers.length === 0,
      "User A must not see user B rows even when ownerId is user B.",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          userAVisibleIds: rowsA.customers.map((row) => row.id),
          userBVisibleIds: rowsB.customers.map((row) => row.id),
          crossVisibleCount: crossRows.customers.length,
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
