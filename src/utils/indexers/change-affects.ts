import type Database from "better-sqlite3";
import type { CR } from "../../schemas/cr.js";

/**
 * Tabla para archivos afectados por un CR
 */
export function createChangeFilesTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_files (
      change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
      file_pattern TEXT NOT NULL,
      PRIMARY KEY (change_id, file_pattern)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_change_files_pattern ON change_files(file_pattern);
  `);
}

/**
 * Tabla para APIs afectadas por un CR
 */
export function createChangeApisTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_apis (
      change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
      api TEXT NOT NULL,
      PRIMARY KEY (change_id, api)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_change_apis_api ON change_apis(api);
  `);
}

/**
 * Inserta archivos afectados por un CR
 */
export function indexChangeFiles(db: Database.Database, cr: CR): void {
  const insertFile = db.prepare(`
    INSERT OR IGNORE INTO change_files (change_id, file_pattern)
    VALUES (?, ?)
  `);

  const files = cr.affects?.files || [];
  for (const file of files) {
    insertFile.run(cr.id, file);
  }
}

/**
 * Inserta APIs afectadas por un CR
 */
export function indexChangeApis(db: Database.Database, cr: CR): void {
  const insertApi = db.prepare(`
    INSERT OR IGNORE INTO change_apis (change_id, api)
    VALUES (?, ?)
  `);

  const apis = cr.affects?.apis || [];
  for (const api of apis) {
    insertApi.run(cr.id, api);
  }
}

/**
 * Obtiene CRs que afectan un archivo (pattern matching básico)
 */
export function getChangesAffectingFile(
  db: Database.Database,
  filePattern: string
): { crId: string; pattern: string }[] {
  const rows = db
    .prepare(
      `
    SELECT change_id, file_pattern
    FROM change_files
    WHERE file_pattern = ? 
       OR ? LIKE REPLACE(file_pattern, '*', '%')
       OR file_pattern LIKE REPLACE(?, '*', '%')
  `
    )
    .all(filePattern, filePattern, filePattern) as {
    change_id: string;
    file_pattern: string;
  }[];

  return rows.map((row) => ({ crId: row.change_id, pattern: row.file_pattern }));
}

/**
 * Obtiene CRs que afectan una API
 */
export function getChangesAffectingApi(db: Database.Database, api: string): string[] {
  const rows = db
    .prepare("SELECT change_id FROM change_apis WHERE api = ?")
    .all(api) as { change_id: string }[];

  return rows.map((row) => row.change_id);
}
