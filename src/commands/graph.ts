import { fileExists, SPEC_PATHS } from "../utils/yaml.js";
import { resolveProjectPath } from "../utils/projects.js";
import { getDatabase } from "../utils/database.js";
import { getAllChanges, getChange } from "../utils/indexers/change.js";
import { getAllDecisions } from "../utils/indexers/decision.js";
import { getAllDomains } from "../utils/indexers/domain.js";
import { checkIndexStatus, formatStaleWarning } from "../utils/index-status.js";
import type { CR } from "../schemas/cr.js";
import type { ADR } from "../schemas/adr.js";

export interface GraphOptions {
  format?: "mermaid" | "dot";
  domain?: string;
  output?: string;
  project?: string;
}

interface GraphNode {
  id: string;
  type: "cr" | "adr" | "domain";
  label: string;
  domain?: string;
  status?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type: "depends_on" | "affects_decision" | "conflicts_with" | "supersedes";
}

/**
 * Colores para Mermaid
 */
const MERMAID_COLORS = {
  cr: "#3B82F6",      // Azul
  adr: "#10B981",     // Verde
  domain: "#F59E0B",  // Amarillo
};

/**
 * Colores para DOT
 */
const DOT_COLORS = {
  cr: "blue",
  adr: "green",
  domain: "yellow",
};

/**
 * Símbolos de flecha para DOT
 */
const DOT_ARROWS: Record<string, string> = {
  depends_on: "arrowhead=normal",
  affects_decision: "arrowhead=diamond",
  conflicts_with: "arrowhead=none, style=dashed, color=red",
  supersedes: "arrowhead=empty",
};

/**
 * Obtiene todos los nodos del grafo
 */
export function getNodes(db: ReturnType<typeof getDatabase>, domainFilter?: string): GraphNode[] {
  const nodes: GraphNode[] = [];

  // CRs
  const crs = domainFilter 
    ? getAllChanges(db).filter(cr => cr.domain === domainFilter)
    : getAllChanges(db);
  
  for (const cr of crs) {
    nodes.push({
      id: cr.id,
      type: "cr",
      label: `${cr.id}: ${cr.summary.slice(0, 30)}${cr.summary.length > 30 ? "..." : ""}`,
      domain: cr.domain,
      status: cr.status,
    });
  }

  // ADRs
  const adrs = getAllDecisions(db);
  for (const adr of adrs) {
    nodes.push({
      id: adr.id,
      type: "adr",
      label: `${adr.id}`,
    });
  }

  // Domains (solo si no hay filtro)
  if (!domainFilter) {
    const domains = getAllDomains(db);
    for (const domain of domains) {
      nodes.push({
        id: `domain-${domain.id}`,
        type: "domain",
        label: domain.name,
      });
    }
  }

  return nodes;
}

/**
 * Obtiene todas las relaciones del grafo
 */
export function getEdges(db: ReturnType<typeof getDatabase>, domainFilter?: string): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const crs = domainFilter 
    ? getAllChanges(db).filter(cr => cr.domain === domainFilter)
    : getAllChanges(db);

  for (const cr of crs) {
    const relationships = cr.relationships || {};

    // depends_on
    for (const dep of relationships.depends_on || []) {
      edges.push({ from: cr.id, to: dep, type: "depends_on" });
    }

    // affects_decision
    for (const adr of relationships.affects_decision || []) {
      edges.push({ from: cr.id, to: adr, type: "affects_decision" });
    }

    // conflicts_with
    for (const conflict of relationships.conflicts_with || []) {
      edges.push({ from: cr.id, to: conflict, type: "conflicts_with" });
    }

    // supersedes
    for (const sup of relationships.supersedes || []) {
      edges.push({ from: cr.id, to: sup, type: "supersedes" });
    }
  }

  return edges;
}

/**
 * Agrupa nodos por domain
 */
function groupNodesByDomain(nodes: GraphNode[]): Map<string, GraphNode[]> {
  const groups = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    if (node.type === "cr" && node.domain) {
      if (!groups.has(node.domain)) {
        groups.set(node.domain, []);
      }
      groups.get(node.domain)!.push(node);
    } else if (node.type === "adr") {
      if (!groups.has("decisions")) {
        groups.set("decisions", []);
      }
      groups.get("decisions")!.push(node);
    }
  }

  return groups;
}

/**
 * Genera output en formato Mermaid
 */
export function formatMermaid(nodes: GraphNode[], edges: GraphEdge[], domainFilter?: string): string {
  const lines: string[] = [];
  lines.push("```mermaid");
  lines.push("graph TD");

  // Agrupar por domain si no hay filtro
  if (!domainFilter) {
    const groups = groupNodesByDomain(nodes);
    
    for (const [domain, domainNodes] of groups) {
      lines.push(`    subgraph ${domain}`);
      for (const node of domainNodes) {
        const color = MERMAID_COLORS[node.type];
        lines.push(`        ${node.id}["${node.label}"]:::${node.type}`);
      }
      lines.push("    end");
    }

    // Nodos que no están en ningún subgraph
    const groupedIds = new Set([...groups.values()].flat().map(n => n.id));
    for (const node of nodes) {
      if (!groupedIds.has(node.id)) {
        lines.push(`    ${node.id}["${node.label}"]:::${node.type}`);
      }
    }
  } else {
    // Sin subgraphs si hay filtro
    for (const node of nodes) {
      lines.push(`    ${node.id}["${node.label}"]:::${node.type}`);
    }
  }

  lines.push("");

  // Estilos
  lines.push("    classDef cr fill:#3B82F6,stroke:#1D4ED8,color:#fff");
  lines.push("    classDef adr fill:#10B981,stroke:#059669,color:#fff");
  lines.push("    classDef domain fill:#F59E0B,stroke:#D97706,color:#fff");
  lines.push("");

  // Relaciones
  for (const edge of edges) {
    let arrow = "-->";
    let label = "";

    switch (edge.type) {
      case "depends_on":
        arrow = "-->";
        label = "depends_on";
        break;
      case "affects_decision":
        arrow = "-.->";
        label = "affects";
        break;
      case "conflicts_with":
        arrow = "-.-x";
        label = "conflicts";
        break;
      case "supersedes":
        arrow = "==>";
        label = "supersedes";
        break;
    }

    if (label) {
      lines.push(`    ${edge.from} ${arrow}|${label}| ${edge.to}`);
    } else {
      lines.push(`    ${edge.from} ${arrow} ${edge.to}`);
    }
  }

  lines.push("```");
  return lines.join("\n");
}

/**
 * Genera output en formato DOT (Graphviz)
 */
export function formatDot(nodes: GraphNode[], edges: GraphEdge[], domainFilter?: string): string {
  const lines: string[] = [];
  lines.push("digraph G {");
  lines.push("    rankdir=TD;");
  lines.push("    node [shape=box];");
  lines.push("");

  // Nodos
  for (const node of nodes) {
    const color = DOT_COLORS[node.type];
    lines.push(`    "${node.id}" [label="${node.label}", style=filled, fillcolor=${color}];`);
  }

  lines.push("");

  // Relaciones
  for (const edge of edges) {
    const style = DOT_ARROWS[edge.type];
    lines.push(`    "${edge.from}" -> "${edge.to}" [${style}];`);
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Genera grafo para un CR específico
 */
function generateCRGraph(db: ReturnType<typeof getDatabase>, crId: string, format: "mermaid" | "dot"): string {
  const cr = getChange(db, crId);
  if (!cr) {
    return `\n  ✗ CR ${crId} no encontrado.\n`;
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Nodo principal
  nodes.push({
    id: cr.id,
    type: "cr",
    label: `${cr.id}: ${cr.summary.slice(0, 30)}`,
    domain: cr.domain,
    status: cr.status,
  });

  // Dependencias
  const relationships = cr.relationships || {};

  for (const dep of relationships.depends_on || []) {
    const depCr = getChange(db, dep);
    if (depCr) {
      nodes.push({
        id: depCr.id,
        type: "cr",
        label: `${depCr.id}: ${depCr.summary.slice(0, 30)}`,
        domain: depCr.domain,
        status: depCr.status,
      });
      edges.push({ from: cr.id, to: depCr.id, type: "depends_on" });
    }
  }

  for (const adrId of relationships.affects_decision || []) {
    nodes.push({
      id: adrId,
      type: "adr",
      label: adrId,
    });
    edges.push({ from: cr.id, to: adrId, type: "affects_decision" });
  }

  for (const conflict of relationships.conflicts_with || []) {
    const conflictCr = getChange(db, conflict);
    if (conflictCr) {
      nodes.push({
        id: conflictCr.id,
        type: "cr",
        label: `${conflictCr.id}: ${conflictCr.summary.slice(0, 30)}`,
        domain: conflictCr.domain,
        status: conflictCr.status,
      });
      edges.push({ from: cr.id, to: conflictCr.id, type: "conflicts_with" });
    }
  }

  return format === "mermaid" 
    ? formatMermaid(nodes, edges)
    : formatDot(nodes, edges);
}

/**
 * Comando graph - genera visualización del grafo
 */
export async function graph(target?: string, options?: GraphOptions): Promise<void> {
  const projectPath = await resolveProjectPath(options?.project);
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
  const format = options?.format || "mermaid";

  try {
    // Si es un CR específico
    if (target?.startsWith("CR-")) {
      const output = generateCRGraph(db, target, format);
      console.log("\n" + output + "\n");
      return;
    }

    // Grafo general (opcionalmente filtrado por domain)
    const domainFilter = target || options?.domain;
    const nodes = getNodes(db, domainFilter);
    const edges = getEdges(db, domainFilter);

    if (nodes.length === 0) {
      console.log("\n  No hay nodos para mostrar.\n");
      return;
    }

    const output = format === "mermaid" 
      ? formatMermaid(nodes, edges, domainFilter)
      : formatDot(nodes, edges);

    console.log("\n" + output + "\n");

    // Stats
    const crCount = nodes.filter(n => n.type === "cr").length;
    const adrCount = nodes.filter(n => n.type === "adr").length;
    const edgeCount = edges.length;
    console.log(`  ${crCount} CRs, ${adrCount} ADRs, ${edgeCount} relaciones\n`);

  } finally {
    db.close();
  }
}
