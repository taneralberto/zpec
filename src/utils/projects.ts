import { readdir, stat, access } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { cwd } from "node:process";

/**
 * Información sobre un proyecto encontrado
 */
export interface ProjectInfo {
  /** Nombre del proyecto (nombre del directorio o projectName del config) */
  name: string;
  /** Path absoluto al directorio del proyecto */
  path: string;
  /** Path relativo al directorio del proyecto desde el CWD */
  relativePath: string;
  /** Si el proyecto está en el CWD (raíz) */
  isRoot: boolean;
}

const SPEC_DIR = ".project-spec";

/**
 * Verifica si un directorio contiene un .project-spec
 */
async function hasProjectSpec(dirPath: string): Promise<boolean> {
  try {
    await access(join(dirPath, SPEC_DIR));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lee el nombre del proyecto desde config.yaml si existe
 */
async function getProjectName(projectPath: string): Promise<string> {
  try {
    const { readYAML } = await import("./yaml.js");
    const config = await readYAML<{ project?: { name?: string } }>(
      join(projectPath, SPEC_DIR, "config.yaml")
    );
    return config?.project?.name || basename(projectPath);
  } catch {
    return basename(projectPath);
  }
}

/**
 * Busca recursivamente directorios con .project-spec
 * No busca en node_modules ni directorios ocultos (excepto .project-spec)
 * 
 * @param rootPath - Directorio raíz para escanear
 * @param maxDepth - Profundidad máxima de búsqueda
 * @param currentDepth - Profundidad actual (interno)
 * @param checkSelf - Si debe verificar si el root mismo tiene .project-spec (solo primero)
 */
async function findProjectSpecDirs(
  rootPath: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
  checkSelf: boolean = true
): Promise<string[]> {
  if (currentDepth > maxDepth) {
    return [];
  }

  const results: string[] = [];

  // Solo verificar el root mismo en la primera llamada
  if (checkSelf && await hasProjectSpec(rootPath)) {
    results.push(rootPath);
  }

  // Escanear subdirectorios
  try {
    const entries = await readdir(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirName = entry.name;

      // Skip node_modules y directorios ocultos (excepto el que buscamos)
      if (dirName === "node_modules" || dirName === ".git") continue;
      if (dirName.startsWith(".") && dirName !== SPEC_DIR) continue;

      const subPath = join(rootPath, dirName);

      // Verificar si este subdirectorio tiene .project-spec
      if (await hasProjectSpec(subPath)) {
        results.push(subPath);
        // No seguir escaneando dentro de un proyecto ya encontrado
        // (para evitar duplicados)
        continue;
      }

      // Buscar recursivamente en subdirectorios que NO son proyectos
      const deeper = await findProjectSpecDirs(subPath, maxDepth, currentDepth + 1, false);
      results.push(...deeper);
    }
  } catch {
    // Permission denied o no existe, ignoramos
  }

  return results;
}

/**
 * Encuentra todos los proyectos con .project-spec en el workspace
 * 
 * Escanea el CWD y sus subdirectorios buscando directorios con .project-spec/
 * Retorna una lista de ProjectInfo con nombre, path y metadata.
 */
export async function findProjects(): Promise<ProjectInfo[]> {
  const currentDir = cwd();
  const projectPaths = await findProjectSpecDirs(currentDir);
  const projects: ProjectInfo[] = [];

  for (const projectPath of projectPaths) {
    const name = await getProjectName(projectPath);
    const relativePath = projectPath === currentDir ? "." : projectPath.replace(currentDir + "/", "");

    projects.push({
      name,
      path: projectPath,
      relativePath,
      isRoot: projectPath === currentDir,
    });
  }

  return projects;
}

/**
 * Resuelve el path al proyecto sobre el que operar.
 * 
 * Orden de resolución:
 * 1. Si se pasa projectPath explícito, usar ese
 * 2. Si el CWD tiene .project-spec, usar CWD
 * 3. Si no, buscar .project-spec en subdirectorios:
 *    - Si hay exactamente 1, usar ese
 *    - Si hay múltiples, error (ambigüedad)
 *    - Si no hay ninguno, error (no encontrado)
 */
export async function resolveProjectPath(explicitPath?: string): Promise<string> {
  // 1. Path explícito
  if (explicitPath) {
    const absolute = resolve(explicitPath);
    if (!(await hasProjectSpec(absolute))) {
      throw new Error(
        `No se encontró ${SPEC_DIR} en '${explicitPath}'.\n` +
        `  Ejecutá 'spec init' en ese directorio primero.`
      );
    }
    return absolute;
  }

  // 2. CWD tiene .project-spec
  const currentDir = cwd();
  if (await hasProjectSpec(currentDir)) {
    return currentDir;
  }

  // 3. Buscar en subdirectorios
  const projectPaths = await findProjectSpecDirs(currentDir, 1);

  if (projectPaths.length === 0) {
    throw new Error(
      `No se encontró ningún proyecto con ${SPEC_DIR}.\n` +
      `  Opciones:\n` +
      `  1. Ejecutá 'spec init' en el directorio del proyecto\n` +
      `  2. Usá --project <path> para especificar el proyecto`
    );
  }

  if (projectPaths.length === 1) {
    return projectPaths[0];
  }

  // Múltiples proyectos — ambigüedad
  const projectNames = await Promise.all(
    projectPaths.map(async (p) => {
      const name = await getProjectName(p);
      const rel = p.replace(currentDir + "/", "");
      return `  - ${rel} (--project ${rel})`;
    })
  );

  throw new Error(
    `Se encontraron múltiples proyectos con ${SPEC_DIR}.\n` +
    `  Usá --project para especificar cuál:\n` +
    projectNames.join("\n") +
    `\n\n  Ejemplo: spec status --project ${projectPaths[0].replace(currentDir + "/", "")}`
  );
}