import { readdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { cwd } from "node:process";
import { readAndValidateYAML, SPEC_PATHS, fileExists } from "../utils/yaml.js";
import {
  CRSchema,
  ADRSchema,
  ConstraintSchema,
  DomainSchema,
  ConfigSchema,
} from "../schemas/index.js";
import type { ZodSchema } from "zod";
import { getDatabase } from "../utils/database.js";
import { getChange } from "../utils/indexers/index.js";
import { detectConflicts, formatConflicts } from "../utils/conflicts.js";

export interface ValidateOptions {
  strict?: boolean;
}

export interface ValidationResult {
  file: string;
  type: "cr" | "adr" | "constraint" | "domain" | "config" | "unknown";
  valid: boolean;
  errors: string[];
}

/**
 * Detecta el tipo de schema basado en el nombre del archivo
 */
function detectSchemaType(filename: string): ValidationResult["type"] {
  const base = basename(filename, ".yaml");

  if (base.startsWith("CR-")) return "cr";
  if (base.startsWith("ADR-")) return "adr";
  if (base.startsWith("CONSTRAINT-")) return "constraint";
  if (base.startsWith("DOMAIN-")) return "domain";
  if (base === "config") return "config";

  return "unknown";
}

/**
 * Obtiene el schema según el tipo
 */
function getSchemaForType(
  type: ValidationResult["type"],
): ZodSchema<unknown> | null {
  switch (type) {
    case "cr":
      return CRSchema;
    case "adr":
      return ADRSchema;
    case "constraint":
      return ConstraintSchema;
    case "domain":
      return DomainSchema;
    case "config":
      return ConfigSchema;
    default:
      return null;
  }
}

/**
 * Valida un único archivo YAML
 */
async function validateFile(filePath: string): Promise<ValidationResult> {
  const filename = basename(filePath);
  const type = detectSchemaType(filename);
  const schema = getSchemaForType(type);

  if (!schema) {
    return {
      file: filePath,
      type: "unknown",
      valid: false,
      errors: [`Tipo de archivo desconocido: ${filename}`],
    };
  }

  const result = await readAndValidateYAML(filePath, schema);

  return {
    file: filePath,
    type,
    valid: result.success,
    errors: result.success ? [] : result.errors,
  };
}

/**
 * Valida todos los archivos YAML en un directorio
 */
async function validateDirectory(dirPath: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  if (!(await fileExists(dirPath))) {
    return results;
  }

  const files = await readdir(dirPath);
  const yamlFiles = files.filter((f: string) => extname(f) === ".yaml");

  for (const file of yamlFiles) {
    const result = await validateFile(join(dirPath, file));
    results.push(result);
  }

  return results;
}

/**
 * Resuelve el path correcto para un ID o archivo
 */
function resolveTargetPath(target: string): string {
  const projectPath = cwd();
  const upperTarget = target.toUpperCase();
  
  // Si es un ID, resolver al path correcto
  if (upperTarget.startsWith("CR-")) {
    return join(projectPath, SPEC_PATHS.changes, `${upperTarget}.yaml`);
  }
  if (upperTarget.startsWith("ADR-")) {
    return join(projectPath, SPEC_PATHS.decisions, `${upperTarget}.yaml`);
  }
  if (upperTarget.startsWith("DOMAIN-")) {
    return join(projectPath, SPEC_PATHS.domains, `${upperTarget}.yaml`);
  }
  if (upperTarget.startsWith("CONSTRAINT-")) {
    return join(projectPath, SPEC_PATHS.constraints, `${upperTarget}.yaml`);
  }
  
  // Si ya tiene extensión .yaml, es un path relativo
  if (target.endsWith(".yaml")) {
    return join(projectPath, target);
  }
  
  // Si no, asumir que es un path relativo
  return join(projectPath, target);
}

/**
 * Detecta si el target es un ID de CR
 */
function isCRId(target: string): boolean {
  const upperTarget = target.toUpperCase();
  return upperTarget.startsWith("CR-") && !upperTarget.includes("/");
}

/**
 * Comando validate - valida archivos YAML contra schemas
 */
export async function validate(
  target?: string,
  options?: ValidateOptions,
): Promise<void> {
  const projectPath = cwd();
  const results: ValidationResult[] = [];

  // Si se especifica un archivo específico
  if (target) {
    const filePath = resolveTargetPath(target);
    const result = await validateFile(filePath);
    results.push(result);

    // Si es un CR válido, detectar conflictos
    if (result.valid && result.type === "cr" && isCRId(target)) {
      await detectAndReportConflicts(target.toUpperCase());
    }
  } else {
    // Validar todos los archivos
    const configPath = join(projectPath, SPEC_PATHS.config);
    if (await fileExists(configPath)) {
      results.push(await validateFile(configPath));
    }

    const dirs = [
      SPEC_PATHS.changes,
      SPEC_PATHS.decisions,
      SPEC_PATHS.constraints,
      SPEC_PATHS.domains,
    ];

    for (const dir of dirs) {
      const dirResults = await validateDirectory(join(projectPath, dir));
      results.push(...dirResults);
    }
  }

  // Reportar resultados
  let totalErrors = 0;
  let totalWarnings = 0;

  console.log("\n");

  for (const result of results) {
    if (result.valid) {
      console.log(`  ✓ ${result.file}`);
    } else {
      console.log(`  ✗ ${result.file}`);
      for (const error of result.errors) {
        console.log(`      ${error}`);
        totalErrors++;
      }
    }
  }

  console.log("\n");

  // Resumen
  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.filter((r) => !r.valid).length;

  if (invalidCount === 0) {
    console.log(`✓ Todos los archivos válidos (${validCount} archivos)\n`);
  } else {
    console.log(
      `✗ Validación falló: ${invalidCount} archivo(s) con errores, ${totalErrors} error(es) total\n`,
    );

    if (options?.strict && totalWarnings > 0) {
      console.log(`⚠ ${totalWarnings} warning(s) en modo estricto\n`);
    }

    process.exit(1);
  }
}

/**
 * Detecta y reporta conflictos para un CR específico
 */
async function detectAndReportConflicts(target: string): Promise<void> {
  // Extraer el ID del CR del target (ej: ".project-spec/changes/CR-001.yaml" -> "CR-001")
  const crId = basename(target, ".yaml");

  // Verificar que el índice existe
  const dbPath = join(cwd(), SPEC_PATHS.graph);
  if (!(await fileExists(dbPath))) {
    console.log("  ⚠ Índice no encontrado. Ejecutá 'spec rebuild' primero.\n");
    return;
  }

  const db = getDatabase();
  const cr = getChange(db, crId);

  if (!cr) {
    console.log(`  ⚠ CR ${crId} no encontrado en el índice. Ejecutá 'spec rebuild'.\n`);
    return;
  }

  const conflictResult = detectConflicts(db, cr);

  if (conflictResult.conflicts.length > 0) {
    console.log(formatConflicts(conflictResult));
    console.log(`  Total: ${conflictResult.conflicts.length} conflicto(s) detectado(s)\n`);
  } else {
    console.log("  ✓ Sin conflictos detectados\n");
  }
}
