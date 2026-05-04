import { describe, it, expect } from "vitest";
import { ADRSchema } from "../schemas/adr.js";
import { ConfigSchema, createDefaultConfig } from "../schemas/config.js";

describe("ADRSchema", () => {
  it("validates a valid ADR", () => {
    const result = ADRSchema.safeParse({
      schema: "adr/v1",
      id: "ADR-001",
      status: "active",
      context: "We need to decide on authentication",
      decision: "Use JWT tokens",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid ID format", () => {
    const result = ADRSchema.safeParse({
      schema: "adr/v1",
      id: "INVALID",
      context: "Test",
      decision: "Test",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("ADR-XXX");
    }
  });

  it("accepts all valid statuses", () => {
    const statuses = ["active", "superseded", "deprecated"];

    for (const status of statuses) {
      const result = ADRSchema.safeParse({
        schema: "adr/v1",
        id: "ADR-001",
        status,
        context: "Test",
        decision: "Test",
      });

      expect(result.success).toBe(true);
    }
  });

  it("applies defaults correctly", () => {
    const result = ADRSchema.safeParse({
      schema: "adr/v1",
      id: "ADR-001",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.authors).toEqual([]);
      expect(result.data.tags).toEqual([]);
    }
  });
});

describe("ConfigSchema", () => {
  it("validates a valid config", () => {
    const result = ConfigSchema.safeParse({
      schema: "config/v1",
      project: {
        name: "test-project",
        version: "1.0.0",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects config without project name", () => {
    const result = ConfigSchema.safeParse({
      schema: "config/v1",
      project: {
        version: "1.0.0",
      },
    });

    expect(result.success).toBe(false);
  });

  it("createDefaultConfig returns valid config", () => {
    const config = createDefaultConfig("my-project");

    expect(config.schema).toBe("config/v1");
    expect(config.project.name).toBe("my-project");
    expect(config.graph.max_domain_crs).toBe(50);

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});
