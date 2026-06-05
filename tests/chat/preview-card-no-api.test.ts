import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("preview card API isolation", () => {
  it("does not call pipeline, non-validate api routes, inserts, or service-role helpers", () => {
    const source = readFileSync(
      "src/components/chat/preview-card/preview-card.tsx",
      "utf8",
    );
    const sourceWithoutAllowedValidateRoute = source.replaceAll(
      "/api/ai/validate-intent",
      "",
    );

    expect(source).not.toContain("processMessage");
    expect(sourceWithoutAllowedValidateRoute).not.toContain("/api/ai");
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("service_role");
  });
});
