import type Database from "better-sqlite3";
import type { CR } from "../../schemas/cr.js";
import { indexChangeFiles, indexChangeApis } from "./change-affects.js";

/**
 * Inserta o actualiza un CR en la base de datos
 */
export function indexChange(db: Database.Database, cr: CR): void {
  // Insertar el CR
  const insertChange = db.prepare(`
    INSERT OR REPLACE INTO changes (
      id, domain, status, summary, description,
      proposed_at, approved_at, implemented_at, author, json_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertChange.run(
    cr.id,
    cr.domain,
    cr.status,
    cr.summary,
    cr.description || null,
    cr.proposed_at || null,
    cr.approved_at || null,
    cr.implemented_at || null,
    cr.author || null,
    JSON.stringify(cr)
  );

  // Insertar entities afectadas
  const insertAffects = db.prepare(`
    INSERT OR IGNORE INTO change_affects (change_id, entity)
    VALUES (?, ?)
  `);

  const entities = cr.affects?.entities || [];
  for (const entity of entities) {
    insertAffects.run(cr.id, entity);
  }

  // Insertar files afectadas
  indexChangeFiles(db, cr);

  // Insertar apis afectadas
  indexChangeApis(db, cr);

  // Insertar relaciones
  const insertRelation = db.prepare(`
    INSERT OR IGNORE INTO change_relationships (from_id, relationship_type, to_id)
    VALUES (?, ?, ?)
  `);

  const relationships = cr.relationships || {};

  const dependsOn = relationships.depends_on || [];
  for (const dep of dependsOn) {
    insertRelation.run(cr.id, "depends_on", dep);
  }

  const affectsDecision = relationships.affects_decision || [];
  for (const affects of affectsDecision) {
    insertRelation.run(cr.id, "affects_decision", affects);
  }

  const conflictsWith = relationships.conflicts_with || [];
  for (const conflict of conflictsWith) {
    insertRelation.run(cr.id, "conflicts_with", conflict);
  }

  const supersedes = relationships.supersedes || [];
  for (const sup of supersedes) {
    insertRelation.run(cr.id, "supersedes", sup);
  }
}

/**
 * Obtiene un CR por ID
 */
export function getChange(db: Database.Database, id: string): CR | null {
  const row = db.prepare("SELECT json_data FROM changes WHERE id = ?").get(id) as
    | { json_data: string }
    | undefined;

  return row ? JSON.parse(row.json_data) : null;
}

/**
 * Obtiene todos los CRs
 */
export function getAllChanges(db: Database.Database): CR[] {
  const rows = db.prepare("SELECT json_data FROM changes ORDER BY proposed_at DESC").all() as {
    json_data: string;
  }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene CRs por domain
 */
export function getChangesByDomain(db: Database.Database, domain: string): CR[] {
  const rows = db
    .prepare("SELECT json_data FROM changes WHERE domain = ? ORDER BY proposed_at DESC")
    .all(domain) as { json_data: string }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene CRs por status
 */
export function getChangesByStatus(db: Database.Database, status: string): CR[] {
  const rows = db
    .prepare("SELECT json_data FROM changes WHERE status = ? ORDER BY proposed_at DESC")
    .all(status) as { json_data: string }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene CRs que afectan una entidad
 */
export function getChangesAffectingEntity(db: Database.Database, entity: string): CR[] {
  const rows = db
    .prepare(
      `
    SELECT c.json_data 
    FROM changes c
    JOIN change_affects a ON c.id = a.change_id
    WHERE a.entity = ?
    ORDER BY c.proposed_at DESC
  `
    )
    .all(entity) as { json_data: string }[];

  return rows.map((row) => JSON.parse(row.json_data));
}

/**
 * Obtiene CRs relacionados con otro CR
 */
export function getRelatedChanges(db: Database.Database, crId: string): {
  relationship: string;
  cr: CR;
}[] {
  const rows = db
    .prepare(
      `
    SELECT r.relationship_type, c.json_data
    FROM change_relationships r
    JOIN changes c ON r.to_id = c.id
    WHERE r.from_id = ?
  `
    )
    .all(crId) as { relationship_type: string; json_data: string }[];

  return rows.map((row) => ({
    relationship: row.relationship_type,
    cr: JSON.parse(row.json_data),
  }));
}
