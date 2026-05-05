import { fileExists, SPEC_PATHS } from "../utils/yaml.js";
import { getDatabase } from "../utils/database.js";
import { resolveProjectPath } from "../utils/projects.js";
import {
  getAllChanges,
  getChangesByDomain,
  getChangesByStatus,
  getChangesAffectingEntity,
  getRelatedChanges,
} from "../utils/indexers/change.js";
import {
  getAllDecisions,
  getDecisionsByStatus,
} from "../utils/indexers/decision.js";
import { getAllDomains } from "../utils/indexers/domain.js";
import { checkIndexStatus, formatStaleWarning } from "../utils/index-status.js";
import type { CR } from "../schemas/cr.js";
import type { ADR } from "../schemas/adr.js";

export interface QueryOptions {
  domain?: string;
  status?: string;
  format?: "table" | "json" | "md";
  project?: string;
}

export interface SearchResult {
  id: string;
  type: "cr" | "adr";
  summary: string;
  status: string;
  date: string | null;
}

/**
 * Formatea una fecha para display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formatea output como tabla
 */
function formatTable(items: SearchResult[]): string {
  const lines: string[] = [];
  
  for (const item of items) {
    const type = item.type === "adr" ? "[ADR]" : "[CR] ";
    const status = item.status.padEnd(12);
    const date = formatDate(item.date).padStart(12);
    lines.push(`  ${type} ${item.id.padEnd(12)} ${status} ${date}  ${item.summary.slice(0, 40)}`);
  }
  
  return lines.join("\n");
}

/**
 * Sanitiza una query para FTS5 (remueve caracteres especiales)
 * FTS5 interpreta ?, *, ^, -, ., :, etc. como operadores
 */
function sanitizeFTS5Query(query: string): string {
  // Remover caracteres especiales de FTS5
  // Solo dejamos letras, números, espacios y guiones bajos
  const sanitized = query.replace(/[^\p{L}\p{N}\s_]/gu, " ");
  
  // Colapsar múltiples espacios en uno
  return sanitized.replace(/\s+/g, " ").trim();
}

/**
 * Búsqueda full-text con FTS5 (busca en CRs y ADRs)
 */
function searchFullText(
  db: ReturnType<typeof getDatabase>,
  query: string
): SearchResult[] {
  const sanitizedQuery = sanitizeFTS5Query(query);

  if (!sanitizedQuery) {
    return [];
  }

  // Buscar en changes
  const changes = db
    .prepare(
      `
    SELECT c.json_data, 'cr' as type
    FROM changes_fts fts
    JOIN changes c ON fts.id = c.id
    WHERE changes_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `
    )
    .all(sanitizedQuery) as { json_data: string; type: string }[];

  // Buscar en decisions
  const decisions = db
    .prepare(
      `
    SELECT d.json_data, 'adr' as type
    FROM decisions_fts fts
    JOIN decisions d ON fts.id = d.id
    WHERE decisions_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `
    )
    .all(sanitizedQuery) as { json_data: string; type: string }[];

  // Combinar y mapear resultados
  const allResults = [...changes, ...decisions];

  return allResults.map((r) => {
    const data = JSON.parse(r.json_data);
    if (r.type === "adr") {
      return {
        id: data.id,
        type: "adr" as const,
        summary: data.decision?.split("\n")[0]?.slice(0, 50) || data.id,
        status: data.status,
        date: data.decided_at,
      };
    }
    return {
      id: data.id,
      type: "cr" as const,
      summary: data.summary,
      status: data.status,
      date: data.proposed_at,
    };
  });
}

/**
 * Parsea la query en lenguaje natural
 */
function parseQuery(query: string): {
  type: "search" | "domain" | "status" | "entity" | "related";
  value: string;
} {
  const lowerQuery = query.toLowerCase();

  // "billing conflicts" -> domain: billing
  if (lowerQuery.includes("conflicts") || lowerQuery.includes("conflictos")) {
    const words = query.split(/\s+/);
    const domainWord = words.find((w) => w.toLowerCase() !== "conflicts" && w.toLowerCase() !== "conflictos");
    if (domainWord) {
      return { type: "domain", value: domainWord.toLowerCase() };
    }
  }

  // "what affects invoices?" -> entity: invoices
  const affectsMatch = lowerQuery.match(/what affects (\w+)/);
  if (affectsMatch) {
    return { type: "entity", value: affectsMatch[1] };
  }

  // "proposed CRs" -> status: proposed
  const statusMatch = lowerQuery.match(/(proposed|approved|rejected|implementing|implemented|archived)/);
  if (statusMatch) {
    return { type: "status", value: statusMatch[1] };
  }

  // "CR-104 dependencies" -> related: CR-104
  const relatedMatch = query.match(/(CR-\d+).*(?:dependencies|related|relaciones)/i);
  if (relatedMatch) {
    return { type: "related", value: relatedMatch[1] };
  }

  // Default: full-text search
  return { type: "search", value: query };
}

/**
 * Comando query - ejecuta queries sobre el grafo semántico
 */
export async function query(queryStr: string, options: QueryOptions): Promise<void> {
  const projectPath = await resolveProjectPath(options.project);
  const dbPath = projectPath + "/" + SPEC_PATHS.graph;

  if (!(await fileExists(dbPath))) {
    console.log("\n  ✗ Índice no encontrado. Ejecutá 'spec rebuild' primero.\n");
    return;
  }

  // Verificar si el índice está desactualizado
  const indexStatus = await checkIndexStatus(projectPath);
  if (indexStatus.stale) {
    console.log(formatStaleWarning(indexStatus));
  }

  const db = getDatabase(projectPath);

  try {
    const parsed = parseQuery(queryStr);
    let results: SearchResult[] = [];

    switch (parsed.type) {
      case "domain": {
        const crs = getChangesByDomain(db, parsed.value);
        results = crs.map((cr) => ({
          id: cr.id,
          type: "cr" as const,
          summary: cr.summary,
          status: cr.status,
          date: cr.proposed_at,
        }));
        console.log(`\n  CRs en domain '${parsed.value}':\n`);
        break;
      }

      case "status": {
        const crs = getChangesByStatus(db, parsed.value);
        results = crs.map((cr) => ({
          id: cr.id,
          type: "cr" as const,
          summary: cr.summary,
          status: cr.status,
          date: cr.proposed_at,
        }));
        console.log(`\n  CRs con status '${parsed.value}':\n`);
        break;
      }

      case "entity": {
        const crs = getChangesAffectingEntity(db, parsed.value);
        results = crs.map((cr) => ({
          id: cr.id,
          type: "cr" as const,
          summary: cr.summary,
          status: cr.status,
          date: cr.proposed_at,
        }));
        console.log(`\n  CRs que afectan '${parsed.value}':\n`);
        break;
      }

      case "related": {
        const related = getRelatedChanges(db, parsed.value);
        console.log(`\n  Relaciones de ${parsed.value}:\n`);
        for (const item of related) {
          console.log(`  ${item.relationship.padEnd(15)} → ${item.cr.id}: ${item.cr.summary}`);
        }
        console.log();
        db.close();
        return;
      }

      case "search":
      default: {
        results = searchFullText(db, parsed.value);
        console.log(`\n  Resultados para '${queryStr}':\n`);
      }
    }

    if (results.length === 0) {
      console.log("  No se encontraron resultados.\n");
    } else {
      console.log(formatTable(results));
      console.log(`\n  ${results.length} resultado(s)\n`);
    }

    if (options.format === "json") {
      console.log(JSON.stringify(results, null, 2));
    }
  } finally {
    db.close();
  }
}

/**
 * Lista todos los CRs
 */
export async function listChanges(options: QueryOptions): Promise<void> {
  const projectPath = await resolveProjectPath(options.project);
  const dbPath = projectPath + "/" + SPEC_PATHS.graph;

  if (!(await fileExists(dbPath))) {
    console.log("\n  ✗ Índice no encontrado. Ejecutá 'spec rebuild' primero.\n");
    return;
  }

  const db = getDatabase(projectPath);

  try {
    const crs = options.domain
      ? getChangesByDomain(db, options.domain)
      : getAllChanges(db);

    console.log("\n  Change Requests:\n");

    for (const cr of crs) {
      const status = cr.status.padEnd(12);
      const date = formatDate(cr.proposed_at).padStart(12);
      console.log(`  ${cr.id.padEnd(12)} ${status} ${date}  ${cr.summary.slice(0, 50)}`);
    }

    console.log(`\n  ${crs.length} CR(s)\n`);
  } finally {
    db.close();
  }
}

/**
 * Lista todos los ADRs
 */
export async function listDecisions(options?: QueryOptions): Promise<void> {
  const projectPath = await resolveProjectPath(options?.project);
  const dbPath = projectPath + "/" + SPEC_PATHS.graph;

  if (!(await fileExists(dbPath))) {
    console.log("\n  ✗ Índice no encontrado. Ejecutá 'spec rebuild' primero.\n");
    return;
  }

  const db = getDatabase(projectPath);

  try {
    const adrs = getAllDecisions(db);

    console.log("\n  Architecture Decision Records:\n");

    for (const adr of adrs) {
      const status = adr.status.padEnd(10);
      const date = formatDate(adr.decided_at).padStart(12);
      const summary = adr.context?.split("\n")[0]?.slice(0, 40) || "";
      console.log(`  ${adr.id.padEnd(12)} ${status} ${date}  ${summary}`);
    }

    console.log(`\n  ${adrs.length} ADR(s)\n`);
  } finally {
    db.close();
  }
}

/**
 * Muestra el estado del grafo
 */
export async function showStatus(projectPath?: string): Promise<void> {
  const resolvedPath = await resolveProjectPath(projectPath);
  const dbPath = resolvedPath + "/" + SPEC_PATHS.graph;

  if (!(await fileExists(dbPath))) {
    console.log("\n  ✗ Índice no encontrado. Ejecutá 'spec rebuild' primero.\n");
    return;
  }

  // Verificar si el índice está desactualizado
  const indexStatus = await checkIndexStatus(resolvedPath);
  if (indexStatus.stale) {
    console.log(formatStaleWarning(indexStatus));
  }

  const db = getDatabase(resolvedPath);

  try {
    const changes = db.prepare("SELECT COUNT(*) as count FROM changes").get() as { count: number };
    const decisions = db.prepare("SELECT COUNT(*) as count FROM decisions").get() as { count: number };
    const constraints = db.prepare("SELECT COUNT(*) as count FROM constraints").get() as { count: number };
    const domains = db.prepare("SELECT COUNT(*) as count FROM domains").get() as { count: number };

    // CRs por status
    const byStatus = db
      .prepare("SELECT status, COUNT(*) as count FROM changes GROUP BY status")
      .all() as { status: string; count: number }[];

    console.log("\n  Estado del grafo:\n");
    console.log(`  Changes:     ${changes.count}`);
    console.log(`  Decisions:   ${decisions.count}`);
    console.log(`  Constraints: ${constraints.count}`);
    console.log(`  Domains:     ${domains.count}`);
    console.log();
    console.log("  CRs por status:");
    for (const row of byStatus) {
      console.log(`    ${row.status.padEnd(14)} ${row.count}`);
    }
    console.log();
  } finally {
    db.close();
  }
}
