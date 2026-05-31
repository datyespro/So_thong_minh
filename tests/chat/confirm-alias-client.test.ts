import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmAliasInBackground } from "@/src/components/chat/preview-card/alias-client";

describe("confirmAliasInBackground", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the selected entity alias and does not throw on route failure", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: { aliases: ["Lan"] } }),
      } as Response);

    await confirmAliasInBackground("customer", "customer-lan", "Lan");

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/confirm-alias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_type: "customer",
        entity_id: "customer-lan",
        alias: "Lan",
      }),
    });

    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    } as Response);

    await expect(
      confirmAliasInBackground("customer", "customer-lan", "Lan"),
    ).resolves.toBeUndefined();
  });

  it("does not call the route for a blank alias", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await confirmAliasInBackground("customer", "customer-lan", "   ");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
