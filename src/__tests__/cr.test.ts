import { describe, it, expect } from "vitest";
import { CRSchema } from "../schemas/cr.js";

describe("CRSchema", () => {
  it("validates a valid CR", () => {
    const result = CRSchema.safeParse({
      schema: "cr/v1",
      id: "CR-001",
      status: "proposed",
      domain: "billing",
      summary: "Test change request",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid ID format", () => {
    const result = CRSchema.safeParse({
      schema: "cr/v1",
      id: "INVALID",
      domain: "billing",
      summary: "Test",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("CR-XXX");
    }
  });

  it("rejects missing required fields", () => {
    const result = CRSchema.safeParse({
      schema: "cr/v1",
      id: "CR-001",
    });

    expect(result.success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    const statuses = [
      "proposed",
      "approved",
      "rejected",
      "planning",
      "implementing",
      "implemented",
      "archived",
    ];

    for (const status of statuses) {
      const result = CRSchema.safeParse({
        schema: "cr/v1",
        id: "CR-001",
        status,
        domain: "billing",
        summary: "Test",
      });

      expect(result.success).toBe(true);
    }
  });

  it("applies defaults correctly", () => {
    const result = CRSchema.safeParse({
      schema: "cr/v1",
      id: "CR-001",
      domain: "billing",
      summary: "Test",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("proposed");
      expect(result.data.affects.entities).toEqual([]);
      expect(result.data.constraints).toEqual([]);
    }
  });
});
