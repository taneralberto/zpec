import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { init } from "../commands/init.js";
import { validate } from "../commands/validate.js";
import { rebuild } from "../commands/rebuild.js";
import { showStatus, listChanges, listDecisions, query } from "../commands/query.js";
import { writeYAML, SPEC_PATHS, readYAML } from "../utils/yaml.js";
import { getDatabase, initializeSchema } from "../utils/database.js";
import {
  getAllChanges,
  getAllDecisions,
  getAllDomains,
  getAllConstraints,
  getChange,
  getDecision,
  indexChange,
  indexDecision,
  indexDomain,
  indexConstraint,
} from "../utils/indexers/index.js";
import { CRSchema } from "../schemas/cr.js";
import { ADRSchema } from "../schemas/adr.js";
import { ConstraintSchema } from "../schemas/constraint.js";
import { DomainSchema } from "../schemas/domain.js";
import { createDefaultConfig } from "../schemas/config.js";
import { join } from "node:path";
import { cwd } from "node:process";
import { mkdir, access, rm } from "node:fs/promises";

// Create MCP server
const server = new McpServer({
  name: "ztructure",
  version: "0.1.0",
});

// ============================================
// Tool: spec_init
// ============================================
server.tool(
  "spec_init",
  "Initialize .project-spec/ structure in the project. Use this when starting a new project or when .project-spec doesn't exist.",
  {
    domains: z.array(z.string()).optional().describe("Initial domains to create (e.g., ['billing', 'auth'])"),
    force: z.boolean().optional().describe("Overwrite if exists"),
  },
  async ({ domains, force }) => {
    try {
      await init({ domain: domains, force });
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ .project-spec/ initialized successfully.\n\nStructure created:\n- .project-spec/config.yaml\n- .project-spec/changes/\n- .project-spec/decisions/\n- .project-spec/constraints/\n- .project-spec/domains/\n- .project-spec/queries/\n\nNext: Run 'spec_rebuild' to create the SQLite index.`,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_validate
// ============================================
server.tool(
  "spec_validate",
  "Validate YAML files against schemas. Checks CRs, ADRs, constraints, domains, and config for schema compliance.",
  {
    target: z.string().optional().describe("Specific file to validate (optional, validates all if not provided)"),
    strict: z.boolean().optional().describe("Fail on warnings"),
  },
  async ({ target, strict }) => {
    try {
      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));
      
      await validate(target, { strict });
      
      console.log = originalLog;
      
      return {
        content: [{
          type: "text" as const,
          text: logs.join("\n"),
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Validation failed: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_rebuild
// ============================================
server.tool(
  "spec_rebuild",
  "Rebuild SQLite index from YAML files. Run this after creating/modifying CRs, ADRs, or other specs, and after git pull.",
  {
    verbose: z.boolean().optional().describe("Show detailed progress"),
  },
  async ({ verbose }) => {
    try {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));
      
      await rebuild({ verbose });
      
      console.log = originalLog;
      
      return {
        content: [{
          type: "text" as const,
          text: logs.join("\n"),
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Rebuild failed: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_status
// ============================================
server.tool(
  "spec_status",
  "Get current status of the semantic graph. Shows counts of CRs, ADRs, constraints, domains, and CRs by status.",
  {},
  async () => {
    try {
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      
      try {
        await access(dbPath);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "⚠ Index not found. Run 'spec_rebuild' first.",
          }],
        };
      }
      
      const db = getDatabase();
      
      const changes = db.prepare("SELECT COUNT(*) as count FROM changes").get() as { count: number };
      const decisions = db.prepare("SELECT COUNT(*) as count FROM decisions").get() as { count: number };
      const constraints = db.prepare("SELECT COUNT(*) as count FROM constraints").get() as { count: number };
      const domains = db.prepare("SELECT COUNT(*) as count FROM domains").get() as { count: number };
      
      const byStatus = db
        .prepare("SELECT status, COUNT(*) as count FROM changes GROUP BY status")
        .all() as { status: string; count: number }[];
      
      db.close();
      
      let text = "## Semantic Graph Status\n\n";
      text += `| Type | Count |\n|------|-------|\n`;
      text += `| Changes | ${changes.count} |\n`;
      text += `| Decisions | ${decisions.count} |\n`;
      text += `| Constraints | ${constraints.count} |\n`;
      text += `| Domains | ${domains.count} |\n\n`;
      text += `### CRs by Status\n`;
      for (const row of byStatus) {
        text += `- ${row.status}: ${row.count}\n`;
      }
      
      return {
        content: [{
          type: "text" as const,
          text,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_list_changes
// ============================================
server.tool(
  "spec_list_changes",
  "List all Change Requests (CRs) in the project. Optionally filter by domain or status.",
  {
    domain: z.string().optional().describe("Filter by domain"),
    status: z.string().optional().describe("Filter by status (proposed, approved, implementing, etc.)"),
  },
  async ({ domain, status }) => {
    try {
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      
      try {
        await access(dbPath);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "⚠ Index not found. Run 'spec_rebuild' first.",
          }],
        };
      }
      
      const db = getDatabase();
      
      let crs;
      if (domain) {
        crs = getAllChanges(db).filter(cr => cr.domain === domain);
      } else {
        crs = getAllChanges(db);
      }
      
      if (status) {
        crs = crs.filter(cr => cr.status === status);
      }
      
      db.close();
      
      if (crs.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No CRs found.",
          }],
        };
      }
      
      let text = `## Change Requests (${crs.length})\n\n`;
      text += "| ID | Status | Domain | Summary |\n|-----|--------|--------|----------|\n";
      
      for (const cr of crs) {
        text += `| ${cr.id} | ${cr.status} | ${cr.domain} | ${cr.summary.slice(0, 60)} |\n`;
      }
      
      return {
        content: [{
          type: "text" as const,
          text,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_list_decisions
// ============================================
server.tool(
  "spec_list_decisions",
  "List all Architecture Decision Records (ADRs) in the project.",
  {
    status: z.string().optional().describe("Filter by status (active, superseded, deprecated)"),
  },
  async ({ status }) => {
    try {
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      
      try {
        await access(dbPath);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "⚠ Index not found. Run 'spec_rebuild' first.",
          }],
        };
      }
      
      const db = getDatabase();
      
      let adrs = getAllDecisions(db);
      
      if (status) {
        adrs = adrs.filter(adr => adr.status === status);
      }
      
      db.close();
      
      if (adrs.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No ADRs found.",
          }],
        };
      }
      
      let text = `## Architecture Decision Records (${adrs.length})\n\n`;
      text += "| ID | Status | Tags |\n|-----|--------|------|\n";
      
      for (const adr of adrs) {
        text += `| ${adr.id} | ${adr.status} | ${(adr.tags || []).join(", ")} |\n`;
      }
      
      return {
        content: [{
          type: "text" as const,
          text,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_get_cr
// ============================================
server.tool(
  "spec_get_cr",
  "Get detailed information about a specific Change Request by ID.",
  {
    id: z.string().describe("CR ID (e.g., CR-001)"),
  },
  async ({ id }) => {
    try {
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      
      try {
        await access(dbPath);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "⚠ Index not found. Run 'spec_rebuild' first.",
          }],
        };
      }
      
      const db = getDatabase();
      const cr = getChange(db, id);
      db.close();
      
      if (!cr) {
        return {
          content: [{
            type: "text" as const,
            text: `✗ CR ${id} not found.`,
          }],
          isError: true,
        };
      }
      
      let text = `## ${cr.id}: ${cr.summary}\n\n`;
      text += `**Status:** ${cr.status}\n`;
      text += `**Domain:** ${cr.domain}\n`;
      text += `**Author:** ${cr.author || "N/A"}\n\n`;
      
      if (cr.description) {
        text += `### Description\n${cr.description}\n\n`;
      }
      
      if (cr.affects?.entities?.length > 0) {
        text += `### Affects\n- Entities: ${cr.affects.entities.join(", ")}\n`;
        if (cr.affects.files?.length > 0) {
          text += `- Files: ${cr.affects.files.join(", ")}\n`;
        }
        if (cr.affects.apis?.length > 0) {
          text += `- APIs: ${cr.affects.apis.join(", ")}\n`;
        }
        text += "\n";
      }
      
      if (cr.acceptance_criteria?.length > 0) {
        text += `### Acceptance Criteria\n`;
        for (const criteria of cr.acceptance_criteria) {
          text += `- [ ] ${criteria}\n`;
        }
        text += "\n";
      }
      
      if (cr.relationships?.depends_on?.length > 0) {
        text += `### Dependencies\n${cr.relationships.depends_on.join(", ")}\n\n`;
      }
      
      return {
        content: [{
          type: "text" as const,
          text,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_query
// ============================================
server.tool(
  "spec_query",
  "Search the semantic graph using natural language queries. Supports FTS5 full-text search.",
  {
    query: z.string().describe("Search query (e.g., 'billing conflicts', 'authentication', 'CR-001 dependencies')"),
  },
  async ({ query: queryStr }) => {
    try {
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      
      try {
        await access(dbPath);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "⚠ Index not found. Run 'spec_rebuild' first.",
          }],
        };
      }
      
      const db = getDatabase();
      
      // FTS5 search
      const results = db
        .prepare(
          `SELECT c.id, c.summary, c.status, c.domain
           FROM changes_fts fts
           JOIN changes c ON fts.id = c.id
           WHERE changes_fts MATCH ?
           ORDER BY rank
           LIMIT 20`
        )
        .all(queryStr) as { id: string; summary: string; status: string; domain: string }[];
      
      db.close();
      
      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No results found for "${queryStr}"`,
          }],
        };
      }
      
      let text = `## Search Results for "${queryStr}" (${results.length})\n\n`;
      text += "| ID | Status | Domain | Summary |\n|-----|--------|--------|----------|\n";
      
      for (const cr of results) {
        text += `| ${cr.id} | ${cr.status} | ${cr.domain} | ${cr.summary.slice(0, 50)} |\n`;
      }
      
      return {
        content: [{
          type: "text" as const,
          text,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_create_cr
// ============================================
server.tool(
  "spec_create_cr",
  "Create a new Change Request (CR). Use this after gathering requirements from the user.",
  {
    domain: z.string().describe("Domain this CR belongs to (e.g., 'billing', 'auth', 'core')"),
    summary: z.string().describe("Brief summary of the change"),
    description: z.string().optional().describe("Detailed description of the change"),
    entities: z.array(z.string()).optional().describe("Entities affected by this change"),
    files: z.array(z.string()).optional().describe("Files that will be modified"),
    apis: z.array(z.string()).optional().describe("APIs affected"),
    acceptance_criteria: z.array(z.string()).optional().describe("Acceptance criteria"),
    depends_on: z.array(z.string()).optional().describe("CR IDs this depends on"),
    affects_decision: z.array(z.string()).optional().describe("ADR IDs this affects"),
    constraints: z.array(z.string()).optional().describe("Constraint IDs that apply"),
    author: z.string().optional().describe("Author name"),
  },
  async (params) => {
    try {
      // Get next CR number
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      let nextNum = 1;
      
      try {
        await access(dbPath);
        const db = getDatabase();
        const result = db.prepare("SELECT id FROM changes ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined;
        if (result) {
          const match = result.id.match(/CR-(\d+)/);
          if (match) {
            nextNum = parseInt(match[1]) + 1;
          }
        }
        db.close();
      } catch {
        // DB doesn't exist, start at 1
      }
      
      const crId = `CR-${String(nextNum).padStart(3, "0")}`;
      
      const cr = CRSchema.parse({
        schema: "cr/v1",
        id: crId,
        status: "proposed",
        proposed_at: new Date().toISOString(),
        author: params.author || "agent",
        domain: params.domain,
        summary: params.summary,
        description: params.description || "",
        affects: {
          entities: params.entities || [],
          files: params.files || [],
          apis: params.apis || [],
        },
        relationships: {
          depends_on: params.depends_on || [],
          affects_decision: params.affects_decision || [],
          conflicts_with: [],
          supersedes: [],
        },
        constraints: params.constraints || [],
        acceptance_criteria: params.acceptance_criteria || [],
      });
      
      // Write YAML file
      const filePath = join(cwd(), SPEC_PATHS.changes, `${crId}.yaml`);
      await writeYAML(filePath, cr);
      
      // Rebuild index
      await rebuild({});
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ Created ${crId}\n\nFile: ${filePath}\n\nSummary: ${cr.summary}\n\nNext steps:\n1. Review the CR file\n2. Run 'spec_validate ${crId}' to check for issues\n3. Update status with 'spec_update_cr_status' when ready`,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error creating CR: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_create_adr
// ============================================
server.tool(
  "spec_create_adr",
  "Create a new Architecture Decision Record (ADR). Use this to document important architectural decisions.",
  {
    context: z.string().describe("The context and problem being addressed"),
    decision: z.string().describe("The decision made"),
    consequences_positive: z.array(z.string()).optional().describe("Positive consequences"),
    consequences_negative: z.array(z.string()).optional().describe("Negative consequences"),
    alternatives: z.array(z.object({
      name: z.string(),
      rejected_because: z.string(),
    })).optional().describe("Alternatives considered and why they were rejected"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    authors: z.array(z.string()).optional().describe("Authors of this decision"),
  },
  async (params) => {
    try {
      // Get next ADR number
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      let nextNum = 1;
      
      try {
        await access(dbPath);
        const db = getDatabase();
        const result = db.prepare("SELECT id FROM decisions ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined;
        if (result) {
          const match = result.id.match(/ADR-(\d+)/);
          if (match) {
            nextNum = parseInt(match[1]) + 1;
          }
        }
        db.close();
      } catch {
        // DB doesn't exist, start at 1
      }
      
      const adrId = `ADR-${String(nextNum).padStart(3, "0")}`;
      
      const adr = ADRSchema.parse({
        schema: "adr/v1",
        id: adrId,
        status: "active",
        decided_at: new Date().toISOString().split("T")[0],
        authors: params.authors || ["agent"],
        context: params.context,
        decision: params.decision,
        alternatives: params.alternatives || [],
        consequences: {
          positive: params.consequences_positive || [],
          negative: params.consequences_negative || [],
        },
        tags: params.tags || [],
      });
      
      // Write YAML file
      const filePath = join(cwd(), SPEC_PATHS.decisions, `${adrId}.yaml`);
      await writeYAML(filePath, adr);
      
      // Rebuild index
      await rebuild({});
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ Created ${adrId}\n\nFile: ${filePath}\n\nDecision: ${adr.decision.slice(0, 100)}...\n\nNext: Review the ADR file and add any additional context.`,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error creating ADR: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_update_cr_status
// ============================================
server.tool(
  "spec_update_cr_status",
  "Update the status of a Change Request. Valid transitions follow the CR lifecycle.",
  {
    id: z.string().describe("CR ID to update"),
    status: z.enum(["proposed", "approved", "rejected", "planning", "implementing", "implemented", "archived"]).describe("New status"),
    notes: z.string().optional().describe("Optional notes about the status change"),
  },
  async ({ id, status, notes }) => {
    try {
      const filePath = join(cwd(), SPEC_PATHS.changes, `${id}.yaml`);
      
      try {
        await access(filePath);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: `✗ CR ${id} not found.`,
          }],
          isError: true,
        };
      }
      
      // Read existing CR
      const cr = await readYAML<Record<string, unknown>>(filePath);
      
      // Update status and timestamps
      cr.status = status;
      
      if (status === "approved") {
        cr.approved_at = new Date().toISOString();
      } else if (status === "implemented") {
        cr.implemented_at = new Date().toISOString();
      }
      
      if (notes) {
        cr.notes = (cr.notes as string || "") + `\n\n[${new Date().toISOString()}] Status → ${status}: ${notes}`;
      }
      
      // Write back
      await writeYAML(filePath, cr);
      
      // Rebuild index
      await rebuild({});
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ Updated ${id} status to "${status}"`,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error updating CR: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_create_domain
// ============================================
server.tool(
  "spec_create_domain",
  "Create a new domain (bounded context) in the project.",
  {
    name: z.string().describe("Human-readable domain name (e.g., 'Billing')"),
    bounded_context: z.string().describe("Bounded context identifier (e.g., 'billing')"),
    description: z.string().optional().describe("Domain description"),
    entities: z.array(z.string()).optional().describe("Entities in this domain"),
    owner: z.string().optional().describe("Domain owner"),
  },
  async (params) => {
    try {
      const domainId = `DOMAIN-${params.bounded_context}`;
      const filePath = join(cwd(), SPEC_PATHS.domains, `${domainId}.yaml`);
      
      // Check if exists
      try {
        await access(filePath);
        return {
          content: [{
            type: "text" as const,
            text: `✗ Domain ${domainId} already exists.`,
          }],
          isError: true,
        };
      } catch {
        // Doesn't exist, continue
      }
      
      const domain = DomainSchema.parse({
        schema: "domain/v1",
        id: domainId,
        name: params.name,
        bounded_context: params.bounded_context,
        description: params.description || "",
        entities: params.entities || [],
        relations: [],
        active_crs: [],
        archived_crs: [],
        owner: params.owner,
      });
      
      await writeYAML(filePath, domain);
      await rebuild({});
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ Created domain ${domainId}\n\nName: ${params.name}\nEntities: ${(params.entities || []).join(", ") || "none"}`,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error creating domain: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// ============================================
// Tool: spec_list_domains
// ============================================
server.tool(
  "spec_list_domains",
  "List all domains (bounded contexts) in the project.",
  {},
  async () => {
    try {
      const dbPath = join(cwd(), SPEC_PATHS.graph);
      
      try {
        await access(dbPath);
      } catch {
        return {
          content: [{
            type: "text" as const,
            text: "⚠ Index not found. Run 'spec_rebuild' first.",
          }],
        };
      }
      
      const db = getDatabase();
      const domains = getAllDomains(db);
      db.close();
      
      if (domains.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No domains found. Create one with 'spec_create_domain'.",
          }],
        };
      }
      
      let text = `## Domains (${domains.length})\n\n`;
      text += "| ID | Name | Bounded Context | Entities |\n|-----|------|-----------------|----------|\n";
      
      for (const domain of domains) {
        text += `| ${domain.id} | ${domain.name} | ${domain.bounded_context} | ${(domain.entities || []).join(", ") || "-"} |\n`;
      }
      
      return {
        content: [{
          type: "text" as const,
          text,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{
          type: "text" as const,
          text: `✗ Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Ztructure MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
