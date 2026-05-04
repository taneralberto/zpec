import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { cwd } from "node:process";
import { fileExists, SPEC_PATHS } from "./yaml.js";

/**
 * Información sobre el estado del índice
 */
export interface IndexStatus {
  exists: boolean;
  stale: boolean;
  dbTimestamp: number | null;
  newestYamlTimestamp: number | null;
  unindexedFiles: string[];
}

/**
 * Obtiene el timestamp más reciente de archivos YAML en un directorio
 */
async function getNewestYamlTimestamp(dirPath: string): Promise<number> {
  if (!(await fileExists(dirPath))) {
    return 0;
  }

  const files = await readdir(dirPath);
  const yamlFiles = files.filter((f: string) => extname(f) === ".yaml");

  if (yamlFiles.length === 0) {
    return 0;
  }

  let newest = 0;
  for (const file of yamlFiles) {
    const filePath = join(dirPath, file);
    const fileStat = await stat(filePath);
    if (fileStat.mtimeMs > newest) {
      newest = fileStat.mtimeMs;
    }
  }

  return newest;
}

/**
 * Obtiene el timestamp de la base de datos
 */
async function getDbTimestamp(dbPath: string): Promise<number | null> {
  if (!(await fileExists(dbPath))) {
    return null;
  }

  const dbStat = await stat(dbPath);
  return dbStat.mtimeMs;
}

/**
 * Obtiene todos los archivos YAML más nuevos que el índice
 */
async function getUnindexedFiles(dbPath: string): Promise<string[]> {
  const dbTimestamp = await getDbTimestamp(dbPath);
  
  if (dbTimestamp === null) {
    // Si no hay DB, todos los archivos están sin indexar
    const allFiles: string[] = [];
    const dirs = [
      SPEC_PATHS.changes,
      SPEC_PATHS.decisions,
      SPEC_PATHS.constraints,
      SPEC_PATHS.domains,
    ];
    
    for (const dir of dirs) {
      const dirPath = join(cwd(), dir);
      if (await fileExists(dirPath)) {
        const files = await readdir(dirPath);
        const yamlFiles = files.filter((f: string) => extname(f) === ".yaml");
        for (const f of yamlFiles) {
          allFiles.push(join(dir, f));
        }
      }
    }
    
    return allFiles;
  }

  // Si hay DB, buscar archivos más nuevos
  const unindexed: string[] = [];
  const dirs = [
    SPEC_PATHS.changes,
    SPEC_PATHS.decisions,
    SPEC_PATHS.constraints,
    SPEC_PATHS.domains,
  ];

  for (const dir of dirs) {
    const dirPath = join(cwd(), dir);
    if (!(await fileExists(dirPath))) {
      continue;
    }

    const files = await readdir(dirPath);
    const yamlFiles = files.filter((f: string) => extname(f) === ".yaml");

    for (const file of yamlFiles) {
      const filePath = join(dirPath, file);
      const fileStat = await stat(filePath);
      if (fileStat.mtimeMs > dbTimestamp) {
        unindexed.push(join(dir, file));
      }
    }
  }

  return unindexed;
}

/**
 * Verifica si el índice está desactualizado
 */
export async function checkIndexStatus(): Promise<IndexStatus> {
  const dbPath = join(cwd(), SPEC_PATHS.graph);
  const dbTimestamp = await getDbTimestamp(dbPath);

  // Obtener timestamps de todos los directorios YAML
  const dirs = [
    SPEC_PATHS.changes,
    SPEC_PATHS.decisions,
    SPEC_PATHS.constraints,
    SPEC_PATHS.domains,
  ];

  let newestYaml = 0;
  for (const dir of dirs) {
    const dirPath = join(cwd(), dir);
    const ts = await getNewestYamlTimestamp(dirPath);
    if (ts > newestYaml) {
      newestYaml = ts;
    }
  }

  const exists = dbTimestamp !== null;
  const stale = exists && newestYaml > dbTimestamp;

  // Obtener archivos sin indexar si está stale
  let unindexedFiles: string[] = [];
  if (stale || !exists) {
    unindexedFiles = await getUnindexedFiles(dbPath);
  }

  return {
    exists,
    stale,
    dbTimestamp,
    newestYamlTimestamp: newestYaml,
    unindexedFiles,
  };
}

/**
 * Formatea el mensaje de warning para índice desactualizado
 */
export function formatStaleWarning(status: IndexStatus): string {
  if (!status.stale && status.exists) {
    return "";
  }

  const lines: string[] = [];
  lines.push("");
  lines.push("  ⚠ El índice está desactualizado");
  
  if (status.unindexedFiles.length > 0) {
    lines.push(`  ${status.unindexedFiles.length} archivo(s) sin indexar:`);
    for (const file of status.unindexedFiles.slice(0, 5)) {
      lines.push(`    - ${file}`);
    }
    if (status.unindexedFiles.length > 5) {
      lines.push(`    ... y ${status.unindexedFiles.length - 5} más`);
    }
  }
  
  lines.push("");
  lines.push("  Ejecutá 'spec rebuild' para actualizar el índice");
  lines.push("");

  return lines.join("\n");
}
