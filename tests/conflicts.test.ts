import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initializeSchema } from "../src/utils/database.js";
import { indexChange } from "../src/utils/indexers/index.js";
import { detectConflicts } from "../src/utils/conflicts.js";
import type { CR } from "../src/schemas/cr.js";

describe("Conflict Detection", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
  });

  describe("detectConflicts", () => {
    it("should return empty conflicts for a CR with no overlap", () => {
      const cr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "billing",
        summary: "Add invoice entity",
        affects: {
          entities: ["Invoice"],
          files: ["src/billing/*"],
          apis: [],
        },
      };

      indexChange(db, cr);

      const result = detectConflicts(db, cr);

      expect(result.crId).toBe("CR-001");
      expect(result.conflicts).toHaveLength(0);
    });

    it("should detect entity overlap when 2+ entities match", () => {
      const existingCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "billing",
        summary: "Modify invoice calculation",
        affects: {
          entities: ["Invoice", "Tax", "Customer"],
          files: [],
          apis: [],
        },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "billing",
        summary: "Update tax rules",
        affects: {
          entities: ["Tax", "Invoice", "Product"],
          files: [],
          apis: [],
        },
      };

      indexChange(db, existingCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("overlap");
      expect(result.conflicts[0].relatedCr).toBe("CR-001");
      expect(result.conflicts[0].details[0]).toContain("Invoice");
      expect(result.conflicts[0].details[0]).toContain("Tax");
    });

    it("should NOT detect conflict when only 1 entity matches", () => {
      const existingCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "billing",
        summary: "Modify invoice",
        affects: {
          entities: ["Invoice", "Tax"],
          files: [],
          apis: [],
        },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "billing",
        summary: "Update product",
        affects: {
          entities: ["Product", "Invoice"], // Only 1 match
          files: [],
          apis: [],
        },
      };

      indexChange(db, existingCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      // No overlap conflict because only 1 entity matches (not significant)
      const overlapConflicts = result.conflicts.filter((c) => c.type === "overlap" && c.relatedCr === "CR-001");
      expect(overlapConflicts).toHaveLength(0);
    });

    it("should detect file overlap when 2+ file patterns match", () => {
      const existingCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "core",
        summary: "Refactor CLI",
        affects: {
          entities: [],
          files: ["src/cli/*", "src/utils/*", "src/schemas/*"],
          apis: [],
        },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "core",
        summary: "Add new commands",
        affects: {
          entities: [],
          files: ["src/cli/*", "src/schemas/*"],
          apis: [],
        },
      };

      indexChange(db, existingCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("overlap");
      expect(result.conflicts[0].relatedCr).toBe("CR-001");
    });

    it("should detect API overlap", () => {
      const existingCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "approved",
        domain: "api",
        summary: "Modify invoice API",
        affects: {
          entities: [],
          files: [],
          apis: ["/api/invoices", "/api/taxes"],
        },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "api",
        summary: "Update invoice endpoint",
        affects: {
          entities: [],
          files: [],
          apis: ["/api/invoices"],
        },
      };

      indexChange(db, existingCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("overlap");
      expect(result.conflicts[0].message).toContain("/api/invoices");
    });

    it("should detect invalid dependency status", () => {
      const depCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "core",
        summary: "Base infrastructure",
        affects: { entities: [], files: [], apis: [] },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "core",
        summary: "Build on top",
        affects: { entities: [], files: [], apis: [] },
        relationships: {
          depends_on: ["CR-001"],
        },
      };

      indexChange(db, depCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("dependency_status");
      expect(result.conflicts[0].relatedCr).toBe("CR-001");
      expect(result.conflicts[0].message).toContain("proposed");
    });

    it("should NOT detect conflict when dependency has valid status", () => {
      const depCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "approved",
        domain: "core",
        summary: "Base infrastructure",
        affects: { entities: [], files: [], apis: [] },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "core",
        summary: "Build on top",
        affects: { entities: [], files: [], apis: [] },
        relationships: {
          depends_on: ["CR-001"],
        },
      };

      indexChange(db, depCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      expect(result.conflicts).toHaveLength(0);
    });

    it("should detect non-existent dependency", () => {
      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "core",
        summary: "Build on top",
        affects: { entities: [], files: [], apis: [] },
        relationships: {
          depends_on: ["CR-999"], // Doesn't exist
        },
      };

      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe("dependency_status");
      expect(result.conflicts[0].message).toContain("no existe");
    });

    it("should not detect conflicts with completed CRs", () => {
      const doneCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "done",
        domain: "billing",
        summary: "Old invoice changes",
        affects: {
          entities: ["Invoice", "Tax"],
          files: ["src/billing/*"],
          apis: [],
        },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "billing",
        summary: "New invoice feature",
        affects: {
          entities: ["Invoice", "Tax"],
          files: ["src/billing/*"],
          apis: [],
        },
      };

      indexChange(db, doneCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      // No conflicts because CR-001 is done
      expect(result.conflicts).toHaveLength(0);
    });

    it("should detect multiple types of conflicts at once", () => {
      const existingCr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "billing",
        summary: "Modify billing",
        affects: {
          entities: ["Invoice", "Tax"],
          files: ["src/billing/*"],
          apis: ["/api/invoices"],
        },
      };

      const newCr: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "billing",
        summary: "Update billing",
        affects: {
          entities: ["Invoice", "Tax"],
          files: ["src/billing/*"],
          apis: ["/api/invoices"],
        },
        relationships: {
          depends_on: ["CR-001"],
        },
      };

      indexChange(db, existingCr);
      indexChange(db, newCr);

      const result = detectConflicts(db, newCr);

      expect(result.conflicts.length).toBeGreaterThan(1);
      
      const conflictTypes = result.conflicts.map((c) => c.type);
      expect(conflictTypes).toContain("overlap");
      expect(conflictTypes).toContain("dependency_status");
    });
  });
});
