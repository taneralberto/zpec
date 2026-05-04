import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { initializeSchema } from "../src/utils/database.js";
import { indexChange } from "../src/utils/indexers/index.js";
import { indexDecision } from "../src/utils/indexers/decision.js";
import { indexDomain } from "../src/utils/indexers/domain.js";
import type { CR } from "../src/schemas/cr.js";
import type { ADR } from "../src/schemas/adr.js";
import type { Domain } from "../src/schemas/domain.js";

// Import internal functions for testing
import { getNodes, getEdges, formatMermaid, formatDot } from "../src/commands/graph.js";

describe("Graph Command", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
  });

  describe("getNodes", () => {
    it("should return empty array when no data", () => {
      const nodes = getNodes(db);
      expect(nodes).toHaveLength(0);
    });

    it("should return CRs as nodes", () => {
      const cr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "billing",
        summary: "Add invoice feature",
        affects: { entities: [], files: [], apis: [] },
      };

      indexChange(db, cr);
      const nodes = getNodes(db);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe("CR-001");
      expect(nodes[0].type).toBe("cr");
    });

    it("should filter nodes by domain", () => {
      const cr1: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "billing",
        summary: "Billing feature",
        affects: { entities: [], files: [], apis: [] },
      };

      const cr2: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "auth",
        summary: "Auth feature",
        affects: { entities: [], files: [], apis: [] },
      };

      indexChange(db, cr1);
      indexChange(db, cr2);

      const nodes = getNodes(db, "billing");
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe("CR-001");
    });

    it("should include ADRs as nodes", () => {
      const adr: ADR = {
        schema: "adr/v1",
        id: "ADR-001",
        status: "active",
        decided_at: "2025-01-01",
        context: "Decision context",
        decision: "Use TypeScript",
      };

      indexDecision(db, adr);
      const nodes = getNodes(db);

      const adrNode = nodes.find(n => n.type === "adr");
      expect(adrNode).toBeDefined();
      expect(adrNode?.id).toBe("ADR-001");
    });
  });

  describe("getEdges", () => {
    it("should return empty array when no relationships", () => {
      const cr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "core",
        summary: "Feature",
        affects: { entities: [], files: [], apis: [] },
      };

      indexChange(db, cr);
      const edges = getEdges(db);

      expect(edges).toHaveLength(0);
    });

    it("should detect depends_on relationships", () => {
      const cr1: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "approved",
        domain: "core",
        summary: "Base feature",
        affects: { entities: [], files: [], apis: [] },
      };

      const cr2: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "core",
        summary: "Dependent feature",
        affects: { entities: [], files: [], apis: [] },
        relationships: {
          depends_on: ["CR-001"],
        },
      };

      indexChange(db, cr1);
      indexChange(db, cr2);

      const edges = getEdges(db);

      expect(edges).toHaveLength(1);
      expect(edges[0].from).toBe("CR-002");
      expect(edges[0].to).toBe("CR-001");
      expect(edges[0].type).toBe("depends_on");
    });

    it("should detect affects_decision relationships", () => {
      const cr: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "core",
        summary: "Feature",
        affects: { entities: [], files: [], apis: [] },
        relationships: {
          affects_decision: ["ADR-001"],
        },
      };

      indexChange(db, cr);
      const edges = getEdges(db);

      expect(edges).toHaveLength(1);
      expect(edges[0].type).toBe("affects_decision");
    });

    it("should detect conflicts_with relationships", () => {
      const cr1: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "proposed",
        domain: "core",
        summary: "Feature A",
        affects: { entities: [], files: [], apis: [] },
      };

      const cr2: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "core",
        summary: "Feature B",
        affects: { entities: [], files: [], apis: [] },
        relationships: {
          conflicts_with: ["CR-001"],
        },
      };

      indexChange(db, cr1);
      indexChange(db, cr2);

      const edges = getEdges(db);

      expect(edges).toHaveLength(1);
      expect(edges[0].type).toBe("conflicts_with");
    });

    it("should filter edges by domain", () => {
      const cr1: CR = {
        schema: "cr/v1",
        id: "CR-001",
        status: "approved",
        domain: "billing",
        summary: "Billing base",
        affects: { entities: [], files: [], apis: [] },
      };

      const cr2: CR = {
        schema: "cr/v1",
        id: "CR-002",
        status: "proposed",
        domain: "billing",
        summary: "Billing feature",
        affects: { entities: [], files: [], apis: [] },
        relationships: {
          depends_on: ["CR-001"],
        },
      };

      const cr3: CR = {
        schema: "cr/v1",
        id: "CR-003",
        status: "proposed",
        domain: "auth",
        summary: "Auth feature",
        affects: { entities: [], files: [], apis: [] },
      };

      indexChange(db, cr1);
      indexChange(db, cr2);
      indexChange(db, cr3);

      const edges = getEdges(db, "billing");
      expect(edges).toHaveLength(1);
    });
  });

  describe("formatMermaid", () => {
    it("should generate valid mermaid syntax", () => {
      const nodes = [
        { id: "CR-001", type: "cr" as const, label: "CR-001: Feature" },
      ];
      const edges = [
        { from: "CR-001", to: "CR-002", type: "depends_on" as const },
      ];

      const output = formatMermaid(nodes, edges);

      expect(output).toContain("```mermaid");
      expect(output).toContain("graph TD");
      expect(output).toContain("CR-001");
      expect(output).toContain("depends_on");
      expect(output).toContain("```");
    });

    it("should include styles for node types", () => {
      const nodes = [
        { id: "CR-001", type: "cr" as const, label: "CR" },
        { id: "ADR-001", type: "adr" as const, label: "ADR" },
      ];
      const edges: never[] = [];

      const output = formatMermaid(nodes, edges);

      expect(output).toContain("classDef cr");
      expect(output).toContain("classDef adr");
    });

    it("should use subgraphs when no domain filter", () => {
      const nodes = [
        { id: "CR-001", type: "cr" as const, label: "CR", domain: "billing" },
      ];
      const edges: never[] = [];

      const output = formatMermaid(nodes, edges);

      expect(output).toContain("subgraph billing");
    });
  });

  describe("formatDot", () => {
    it("should generate valid DOT syntax", () => {
      const nodes = [
        { id: "CR-001", type: "cr" as const, label: "Feature" },
      ];
      const edges = [
        { from: "CR-001", to: "CR-002", type: "depends_on" as const },
      ];

      const output = formatDot(nodes, edges);

      expect(output).toContain("digraph G");
      expect(output).toContain("CR-001");
      expect(output).toContain("->");
    });

    it("should use different arrow styles for relationship types", () => {
      const nodes = [
        { id: "CR-001", type: "cr" as const, label: "A" },
        { id: "CR-002", type: "cr" as const, label: "B" },
      ];
      const edges = [
        { from: "CR-001", to: "CR-002", type: "conflicts_with" as const },
      ];

      const output = formatDot(nodes, edges);

      expect(output).toContain("style=dashed");
      expect(output).toContain("color=red");
    });
  });
});
