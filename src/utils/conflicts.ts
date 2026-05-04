import type Database from "better-sqlite3";
import type { CR } from "../schemas/cr.js";
import { getChange } from "./indexers/change.js";

/**
 * Tipos de conflictos detectados
 */
export interface Conflict {
  type: "overlap" | "dependency_status";
  severity: "warning" | "error";
  relatedCr: string;
  message: string;
  details: string[];
}

/**
 * Resultado de validación con conflictos
 */
export interface ConflictValidationResult {
  crId: string;
  conflicts: Conflict[];
}

/**
 * Status válidos para dependencias
 * - approved, implementing, done: OK
 * - proposed, rejected, blocked: problema
 */
const VALID_DEPENDENCY_STATUS = ["approved", "implementing", "done"];
const INVALID_DEPENDENCY_STATUS = ["proposed", "rejected", "blocked"];

/**
 * Detecta overlap de entidades entre el CR y otros CRs existentes
 */
function detectEntityOverlap(
  db: Database.Database,
  cr: CR
): Conflict[] {
  const conflicts: Conflict[] = [];
  const entities = cr.affects?.entities || [];

  if (entities.length === 0) return conflicts;

  // Buscar otros CRs que afectan las mismas entidades
  const rows = db
    .prepare(
      `
    SELECT DISTINCT c.id, c.status, c.summary, a.entity
    FROM changes c
    JOIN change_affects a ON c.id = a.change_id
    WHERE a.entity IN (${entities.map(() => "?").join(",")})
      AND c.id != ?
      AND c.status IN ('proposed', 'approved', 'implementing')
  `
    )
    .bind(...entities, cr.id)
    .all() as { id: string; status: string; summary: string; entity: string }[];

  // Agrupar por CR
  const overlapMap = new Map<string, { entities: string[]; summary: string; status: string }>();

  for (const row of rows) {
    if (!overlapMap.has(row.id)) {
      overlapMap.set(row.id, { entities: [], summary: row.summary, status: row.status });
    }
    overlapMap.get(row.id)!.entities.push(row.entity);
  }

  // Solo reportar si hay overlap significativo (2+ entidades)
  for (const [relatedCrId, data] of overlapMap) {
    if (data.entities.length >= 2) {
      conflicts.push({
        type: "overlap",
        severity: "warning",
        relatedCr: relatedCrId,
        message: `Potencial conflicto con ${relatedCrId} (${data.status})`,
        details: [
          `Ambos CRs afectan: ${data.entities.join(", ")}`,
          `${relatedCrId}: "${data.summary}"`,
        ],
      });
    }
  }

  return conflicts;
}

/**
 * Detecta overlap de archivos entre el CR y otros CRs existentes
 */
function detectFileOverlap(
  db: Database.Database,
  cr: CR
): Conflict[] {
  const conflicts: Conflict[] = [];
  const files = cr.affects?.files || [];

  if (files.length === 0) return conflicts;

  // Buscar otros CRs que afectan archivos similares
  const rows = db
    .prepare(
      `
    SELECT DISTINCT cf.change_id, cf.file_pattern, c.status, c.summary
    FROM change_files cf
    JOIN changes c ON cf.change_id = c.id
    WHERE c.status IN ('proposed', 'approved', 'implementing')
      AND c.id != ?
  `
    )
    .all(cr.id) as { change_id: string; file_pattern: string; status: string; summary: string }[];

  // Verificar overlap de patterns
  const overlapMap = new Map<string, { patterns: string[]; summary: string; status: string }>();

  for (const row of rows) {
    for (const pattern of files) {
      // Overlap si los patterns son iguales o uno contiene al otro
      const hasOverlap =
        pattern === row.file_pattern ||
        pattern.includes(row.file_pattern.replace("*", "")) ||
        row.file_pattern.includes(pattern.replace("*", ""));

      if (hasOverlap) {
        if (!overlapMap.has(row.change_id)) {
          overlapMap.set(row.change_id, { patterns: [], summary: row.summary, status: row.status });
        }
        overlapMap.get(row.change_id)!.patterns.push(row.file_pattern);
      }
    }
  }

  // Reportar overlap significativo (2+ archivos)
  for (const [relatedCrId, data] of overlapMap) {
    if (data.patterns.length >= 2) {
      conflicts.push({
        type: "overlap",
        severity: "warning",
        relatedCr: relatedCrId,
        message: `Potencial conflicto de archivos con ${relatedCrId} (${data.status})`,
        details: [
          `Patrones superpuestos: ${[...new Set(data.patterns)].join(", ")}`,
          `${relatedCrId}: "${data.summary}"`,
        ],
      });
    }
  }

  return conflicts;
}

/**
 * Detecta overlap de APIs entre el CR y otros CRs existentes
 */
function detectApiOverlap(
  db: Database.Database,
  cr: CR
): Conflict[] {
  const conflicts: Conflict[] = [];
  const apis = cr.affects?.apis || [];

  if (apis.length === 0) return conflicts;

  for (const api of apis) {
    const rows = db
      .prepare(
        `
      SELECT c.id, c.status, c.summary
      FROM changes c
      JOIN change_apis ca ON c.id = ca.change_id
      WHERE ca.api = ?
        AND c.id != ?
        AND c.status IN ('proposed', 'approved', 'implementing')
    `
      )
      .all(api, cr.id) as { id: string; status: string; summary: string }[];

    for (const row of rows) {
      conflicts.push({
        type: "overlap",
        severity: "warning",
        relatedCr: row.id,
        message: `API ${api} también modificada por ${row.id} (${row.status})`,
        details: [
          `${row.id}: "${row.summary}"`,
          "Considerá coordinar los cambios",
        ],
      });
    }
  }

  return conflicts;
}

/**
 * Valida el status de las dependencias del CR
 */
function validateDependencyStatus(
  db: Database.Database,
  cr: CR
): Conflict[] {
  const conflicts: Conflict[] = [];
  const dependencies = cr.relationships?.depends_on || [];

  if (dependencies.length === 0) return conflicts;

  for (const depId of dependencies) {
    const depCr = getChange(db, depId);

    if (!depCr) {
      conflicts.push({
        type: "dependency_status",
        severity: "warning",
        relatedCr: depId,
        message: `Dependencia ${depId} no existe`,
        details: [
          "El CR referencia una dependencia que no está en el sistema",
        ],
      });
      continue;
    }

    if (INVALID_DEPENDENCY_STATUS.includes(depCr.status)) {
      conflicts.push({
        type: "dependency_status",
        severity: "warning",
        relatedCr: depId,
        message: `Dependencia ${depId} está en status '${depCr.status}'`,
        details: [
          `Status actual: ${depCr.status}`,
          `Resumen: "${depCr.summary}"`,
          "Este CR debería esperar a que la dependencia avance",
        ],
      });
    }
  }

  return conflicts;
}

/**
 * Detecta todos los conflictos potenciales para un CR
 */
export function detectConflicts(
  db: Database.Database,
  cr: CR
): ConflictValidationResult {
  const conflicts: Conflict[] = [
    ...detectEntityOverlap(db, cr),
    ...detectFileOverlap(db, cr),
    ...detectApiOverlap(db, cr),
    ...validateDependencyStatus(db, cr),
  ];

  // Ordenar por severidad
  conflicts.sort((a, b) => {
    if (a.severity === "error" && b.severity === "warning") return -1;
    if (a.severity === "warning" && b.severity === "error") return 1;
    return 0;
  });

  return {
    crId: cr.id,
    conflicts,
  };
}

/**
 * Formatea los conflictos para output en CLI
 */
export function formatConflicts(result: ConflictValidationResult): string {
  const lines: string[] = [];

  if (result.conflicts.length === 0) {
    return "";
  }

  lines.push(`  Conflictos detectados para ${result.crId}:`);
  lines.push("");

  for (const conflict of result.conflicts) {
    const icon = conflict.severity === "error" ? "✗" : "⚠";
    lines.push(`  ${icon} ${conflict.message}`);
    for (const detail of conflict.details) {
      lines.push(`      ${detail}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
