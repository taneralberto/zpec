import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { mkdir, access } from "node:fs/promises";
import { SPEC_PATHS } from "./yaml.js";
import { createChangeFilesTable, createChangeApisTable } from "./indexers/change-affects.js";

/**
 * Inicializa la conexión a la base de datos
 * @param projectPath - Path al directorio del proyecto (default: CWD)
 */
export function getDatabase(projectPath?: string): Database.Database {
  const basePath = projectPath || process.cwd();
  const dbPath = join(basePath, SPEC_PATHS.graph);
  
  // Asegurar que el directorio existe
  const db = new Database(dbPath);
  
  // Habilitar WAL mode para mejor performance
  db.pragma("journal_mode = WAL");
  
  return db;
}

/**
 * Crea el schema de la base de datos
 */
export function initializeSchema(db: Database.Database): void {
  // Tabla de changes (CRs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS changes (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT,
      description TEXT,
      proposed_at TEXT,
      approved_at TEXT,
      implemented_at TEXT,
      author TEXT,
      json_data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabla de decisions (ADRs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      decided_at TEXT,
      summary TEXT,
      context TEXT,
      decision TEXT,
      json_data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabla de constraints
  db.exec(`
    CREATE TABLE IF NOT EXISTS constraints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      json_data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabla de domains
  db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bounded_context TEXT NOT NULL,
      description TEXT,
      json_data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabla de relaciones: change afecta entities
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_affects (
      change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
      entity TEXT NOT NULL,
      PRIMARY KEY (change_id, entity)
    );
  `);

  // Tabla de relaciones entre changes
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_relationships (
      from_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      PRIMARY KEY (from_id, relationship_type, to_id)
    );
  `);

  // Índices para performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_changes_domain ON changes(domain);
    CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status);
    CREATE INDEX IF NOT EXISTS idx_changes_proposed ON changes(proposed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_affects_entity ON change_affects(entity);
    CREATE INDEX IF NOT EXISTS idx_relationships_from ON change_relationships(from_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_to ON change_relationships(to_id);
  `);

  // Tablas adicionales para files y apis afectadas
  createChangeFilesTable(db);
  createChangeApisTable(db);

  // FTS5 para búsqueda full-text en changes
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS changes_fts USING fts5(
      id,
      summary,
      description,
      domain,
      content='changes',
      content_rowid='rowid'
    );
  `);

  // FTS5 para búsqueda full-text en decisions
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
      id,
      context,
      decision,
      content='decisions',
      content_rowid='rowid'
    );
  `);

  // Triggers para mantener FTS sincronizado en changes
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS changes_fts_insert AFTER INSERT ON changes BEGIN
      INSERT INTO changes_fts(rowid, id, summary, description, domain)
      VALUES (NEW.rowid, NEW.id, NEW.summary, NEW.description, NEW.domain);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS changes_fts_delete AFTER DELETE ON changes BEGIN
      INSERT INTO changes_fts(changes_fts, rowid, id, summary, description, domain)
      VALUES('delete', OLD.rowid, OLD.id, OLD.summary, OLD.description, OLD.domain);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS changes_fts_update AFTER UPDATE ON changes BEGIN
      INSERT INTO changes_fts(changes_fts, rowid, id, summary, description, domain)
      VALUES('delete', OLD.rowid, OLD.id, OLD.summary, OLD.description, OLD.domain);
      INSERT INTO changes_fts(rowid, id, summary, description, domain)
      VALUES (NEW.rowid, NEW.id, NEW.summary, NEW.description, NEW.domain);
    END;
  `);

  // Triggers para mantener FTS sincronizado en decisions
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS decisions_fts_insert AFTER INSERT ON decisions BEGIN
      INSERT INTO decisions_fts(rowid, id, context, decision)
      VALUES (NEW.rowid, NEW.id, NEW.context, NEW.decision);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS decisions_fts_delete AFTER DELETE ON decisions BEGIN
      INSERT INTO decisions_fts(decisions_fts, rowid, id, context, decision)
      VALUES('delete', OLD.rowid, OLD.id, OLD.context, OLD.decision);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS decisions_fts_update AFTER UPDATE ON decisions BEGIN
      INSERT INTO decisions_fts(decisions_fts, rowid, id, context, decision)
      VALUES('delete', OLD.rowid, OLD.id, OLD.context, OLD.decision);
      INSERT INTO decisions_fts(rowid, id, context, decision)
      VALUES (NEW.rowid, NEW.id, NEW.context, NEW.decision);
    END;
  `);
}

/**
 * Limpia todas las tablas (para rebuild)
 */
export function clearAllTables(db: Database.Database): void {
  db.exec(`
    DELETE FROM change_files;
    DELETE FROM change_apis;
    DELETE FROM change_relationships;
    DELETE FROM change_affects;
    DELETE FROM changes;
    DELETE FROM decisions;
    DELETE FROM constraints;
    DELETE FROM domains;
  `);
}

/**
 * Verifica si la base de datos existe
 * @param projectPath - Path al directorio del proyecto (default: CWD)
 */
export async function databaseExists(projectPath?: string): Promise<boolean> {
  const basePath = projectPath || process.cwd();
  const dbPath = join(basePath, SPEC_PATHS.graph);
  try {
    await access(dbPath);
    return true;
  } catch {
    return false;
  }
}
