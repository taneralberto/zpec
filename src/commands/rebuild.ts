import { readdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { readYAML, SPEC_PATHS, fileExists } from "../utils/yaml.js";
import { resolveProjectPath } from "../utils/projects.js";
import { getDatabase, initializeSchema, clearAllTables } from "../utils/database.js";
import { indexChange, indexDecision, indexConstraint, indexDomain } from "../utils/indexers/index.js";
import type { CR } from "../schemas/cr.js";
import type { ADR } from "../schemas/adr.js";
import type { Constraint } from "../schemas/constraint.js";
import type { Domain } from "../schemas/domain.js";

export interface RebuildOptions {
  force?: boolean;
  verbose?: boolean;
  project?: string;
}

interface RebuildStats {
  changes: number;
  decisions: number;
  constraints: number;
  domains: number;
  errors: { file: string; error: string }[];
}

/**
 * Lee todos los archivos YAML de un directorio
 */
async function readYAMLFiles<T>(
  dirPath: string
): Promise<{ items: T[]; errors: { file: string; error: string }[] }> {
  const items: T[] = [];
  const errors: { file: string; error: string }[] = [];

  if (!(await fileExists(dirPath))) {
    return { items, errors };
  }

  const files = await readdir(dirPath);
  const yamlFiles = files.filter((f) => extname(f) === ".yaml");

  for (const file of yamlFiles) {
    const filePath = join(dirPath, file);
    try {
      const data = await readYAML<T>(filePath);
      items.push(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ file: filePath, error: message });
    }
  }

  return { items, errors };
}

/**
 * Comando rebuild - reconstruye el índice SQLite desde los YAMLs
 */
export async function rebuild(options: RebuildOptions): Promise<void> {
  const projectPath = await resolveProjectPath(options.project);
  const stats: RebuildStats = {
    changes: 0,
    decisions: 0,
    constraints: 0,
    domains: 0,
    errors: [],
  };

  console.log("\n  Reconstruyendo índice...\n");

  // Leer todos los archivos primero
  const changesResult = await readYAMLFiles<CR>(join(projectPath, SPEC_PATHS.changes));
  const decisionsResult = await readYAMLFiles<ADR>(join(projectPath, SPEC_PATHS.decisions));
  const constraintsResult = await readYAMLFiles<Constraint>(join(projectPath, SPEC_PATHS.constraints));
  const domainsResult = await readYAMLFiles<Domain>(join(projectPath, SPEC_PATHS.domains));

  // Filtrar solo los que tienen schema correcto
  const validChanges = changesResult.items.filter((cr) => cr.schema === "cr/v1" && cr.id);
  const validDecisions = decisionsResult.items.filter((adr) => adr.schema === "adr/v1" && adr.id);
  const validConstraints = constraintsResult.items.filter((c) => c.schema === "constraint/v1" && c.id);
  const validDomains = domainsResult.items.filter((d) => d.schema === "domain/v1" && d.id);

  // Inicializar base de datos
  const db = getDatabase(projectPath);

  // Crear schema si no existe
  initializeSchema(db);

  // Limpiar tablas existentes
  clearAllTables(db);

  // Usar transacción para rendimiento
  const insertAll = db.transaction(() => {
    // Indexar Changes
    for (const cr of validChanges) {
      indexChange(db, cr);
      stats.changes++;
      if (options.verbose) {
        console.log(`  ✓ Indexado: ${cr.id}`);
      }
    }

    // Indexar Decisions
    for (const adr of validDecisions) {
      indexDecision(db, adr);
      stats.decisions++;
      if (options.verbose) {
        console.log(`  ✓ Indexado: ${adr.id}`);
      }
    }

    // Indexar Constraints
    for (const constraint of validConstraints) {
      indexConstraint(db, constraint);
      stats.constraints++;
      if (options.verbose) {
        console.log(`  ✓ Indexado: ${constraint.id}`);
      }
    }

    // Indexar Domains
    for (const domain of validDomains) {
      indexDomain(db, domain);
      stats.domains++;
      if (options.verbose) {
        console.log(`  ✓ Indexado: ${domain.id}`);
      }
    }
  });

  // Ejecutar transacción
  insertAll();

  // Recopilar errores
  stats.errors.push(...changesResult.errors);
  stats.errors.push(...decisionsResult.errors);
  stats.errors.push(...constraintsResult.errors);
  stats.errors.push(...domainsResult.errors);

  // Reportar errores
  if (stats.errors.length > 0) {
    console.log("  Errores:\n");
    for (const error of stats.errors) {
      console.log(`    ✗ ${error.file}`);
      console.log(`      ${error.error}\n`);
    }
  }

  // Resumen
  const total = stats.changes + stats.decisions + stats.constraints + stats.domains;

  console.log(`\n  ✓ Índice reconstruido:\n`);
  console.log(`    Changes:     ${stats.changes}`);
  console.log(`    Decisions:   ${stats.decisions}`);
  console.log(`    Constraints: ${stats.constraints}`);
  console.log(`    Domains:     ${stats.domains}`);
  console.log(`    ─────────────`);
  console.log(`    Total:       ${total}\n`);

  if (stats.errors.length > 0) {
    console.log(`  ⚠ ${stats.errors.length} archivo(s) con errores\n`);
  }

  db.close();
}
