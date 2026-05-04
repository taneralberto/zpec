import { parse, stringify } from "yaml";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { z } from "zod";

/**
 * Lee un archivo YAML y lo parsea a objeto
 */
export async function readYAML<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return parse(content) as T;
}

/**
 * Escribe un objeto a un archivo YAML
 */
export async function writeYAML<T extends Record<string, unknown>>(
  filePath: string,
  data: T,
): Promise<void> {
  // Asegurar que el directorio existe
  await mkdir(dirname(filePath), { recursive: true });

  const content = stringify(data, {
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
    lineWidth: 0, // No wrap
  });

  await writeFile(filePath, content, "utf-8");
}

/**
 * Valida datos contra un schema Zod
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `${path}: ${issue.message}`;
  });

  return { success: false, errors };
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lee y valida un archivo YAML contra un schema
 */
export async function readAndValidateYAML<T>(
  filePath: string,
  schema: z.ZodSchema<T>,
): Promise<{ success: true; data: T } | { success: false; errors: string[] }> {
  try {
    const data = await readYAML<unknown>(filePath);
    return validateSchema(schema, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      errors: [`Failed to read ${filePath}: ${message}`],
    };
  }
}

/**
 * Constantes de paths
 */
export const SPEC_DIR = ".project-spec";

export const SPEC_PATHS = {
  config: join(SPEC_DIR, "config.yaml"),
  changes: join(SPEC_DIR, "changes"),
  decisions: join(SPEC_DIR, "decisions"),
  constraints: join(SPEC_DIR, "constraints"),
  domains: join(SPEC_DIR, "domains"),
  queries: join(SPEC_DIR, "queries"),
  graph: join(SPEC_DIR, "graph.db"),
} as const;
