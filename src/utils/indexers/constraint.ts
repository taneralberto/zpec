import type Database from "better-sqlite3";
import type { Constraint } from "../../schemas/constraint.js";

/**
 * Inserta o actualiza un Constraint en la base de datos
 */
export function indexConstraint(db: Database.Database, constraint: Constraint): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO constraints (
      id, name, severity, description, json_data
    ) VALUES (?, ?, ?, ?, ?)
  `);

  insert.run(
    constraint.id,
    constraint.name,
    constraint.severity,
    constraint.description || null,
    JSON.stringify(constraint)
  );
}

/**
 * Obtiene un Constraint por ID
 */
export function getConstraint(db: Database.Database, id: string): Constraint | null {
  const row = db.prepare("SELECT json_data FROM constraints WHERE id = ?").get(id) as
    | { json_data: string }
    | undefined;

  return row ? JSON.parse(row.json_data) : null;
}

/**
 * Obtiene todos los Constraints
 */
export function getAllConstraints(db: Database.Database): Constraint[] {
  const rows = db.prepare("SELECT json_data FROM constraints ORDER BY name").all() as {
    json_data: string;
  }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene Constraints por severidad
 */
export function getConstraintsBySeverity(
  db: Database.Database,
  severity: "hard" | "soft"
): Constraint[] {
  const rows = db
    .prepare("SELECT json_data FROM constraints WHERE severity = ? ORDER BY name")
    .all(severity) as { json_data: string }[];

  return rows.map((row) => JSON.parse(row.json_data));
}
