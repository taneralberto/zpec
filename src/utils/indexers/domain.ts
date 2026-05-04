import type Database from "better-sqlite3";
import type { Domain } from "../../schemas/domain.js";

/**
 * Inserta o actualiza un Domain en la base de datos
 */
export function indexDomain(db: Database.Database, domain: Domain): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO domains (
      id, name, bounded_context, description, json_data
    ) VALUES (?, ?, ?, ?, ?)
  `);

  insert.run(
    domain.id,
    domain.name,
    domain.bounded_context,
    domain.description || null,
    JSON.stringify(domain)
  );
}

/**
 * Obtiene un Domain por ID
 */
export function getDomain(db: Database.Database, id: string): Domain | null {
  const row = db.prepare("SELECT json_data FROM domains WHERE id = ?").get(id) as
    | { json_data: string }
    | undefined;

  return row ? JSON.parse(row.json_data) : null;
}

/**
 * Obtiene todos los Domains
 */
export function getAllDomains(db: Database.Database): Domain[] {
  const rows = db.prepare("SELECT json_data FROM domains ORDER BY name").all() as {
    json_data: string;
  }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene un Domain por bounded context
 */
export function getDomainByContext(db: Database.Database, context: string): Domain | null {
  const row = db
    .prepare("SELECT json_data FROM domains WHERE bounded_context = ?")
    .get(context) as { json_data: string } | undefined;

  return row ? JSON.parse(row.json_data) : null;
}
