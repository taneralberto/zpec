import type Database from "better-sqlite3";
import type { ADR } from "../../schemas/adr.js";

/**
 * Inserta o actualiza un ADR en la base de datos
 */
export function indexDecision(db: Database.Database, adr: ADR): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO decisions (
      id, status, decided_at, summary, context, decision, json_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Usar el primer párrafo del context como summary si no hay title
  const summary = adr.context?.split("\n")[0]?.slice(0, 200) || "";

  insert.run(
    adr.id,
    adr.status,
    adr.decided_at || null,
    summary,
    adr.context || null,
    adr.decision || null,
    JSON.stringify(adr)
  );
}

/**
 * Obtiene un ADR por ID
 */
export function getDecision(db: Database.Database, id: string): ADR | null {
  const row = db.prepare("SELECT json_data FROM decisions WHERE id = ?").get(id) as
    | { json_data: string }
    | undefined;

  return row ? JSON.parse(row.json_data) : null;
}

/**
 * Obtiene todos los ADRs
 */
export function getAllDecisions(db: Database.Database): ADR[] {
  const rows = db.prepare("SELECT json_data FROM decisions ORDER BY decided_at DESC").all() as {
    json_data: string;
  }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene ADRs por status
 */
export function getDecisionsByStatus(db: Database.Database, status: string): ADR[] {
  const rows = db
    .prepare("SELECT json_data FROM decisions WHERE status = ? ORDER BY decided_at DESC")
    .all(status) as { json_data: string }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene ADRs que afectan un CR
 */
export function getDecisionsAffectingCR(db: Database.Database, crId: string): ADR[] {
  const rows = db
    .prepare(
      `
    SELECT d.json_data
    FROM decisions d, json_each(d.json_data, '$.relationships.affects_crs') as cr
    WHERE cr.value = ?
  `
    )
    .all(crId) as { json_data: string }[];

  return rows.map((row) => JSON.parse(row.json_data));
}
