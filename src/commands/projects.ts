import { findProjects } from "../utils/projects.js";
import { cwd } from "node:process";

/**
 * Comando projects - lista los proyectos con .project-spec en el workspace
 */
export async function listProjects(): Promise<void> {
  const projects = await findProjects();

  if (projects.length === 0) {
    console.log("\n  No se encontraron proyectos con .project-spec/.\n");
    console.log("  Ejecutá 'spec init' en un directorio de proyecto para comenzar.\n");
    return;
  }

  console.log("\n  Proyectos encontrados:\n");

  for (const project of projects) {
    const marker = project.isRoot ? "→" : " ";
    const location = project.isRoot ? "(CWD)" : project.relativePath;
    console.log(`  ${marker} ${project.name.padEnd(20)} ${location}`);
  }

  console.log(`\n  ${projects.length} proyecto(s)\n`);

  // Si hay más de un proyecto, dar tips de uso
  if (projects.length > 1) {
    console.log("  Tips:");
    console.log("  • Usá --project <path> para operar en un proyecto específico");
    console.log("  • Ejemplo: spec status --project frontend\n");
  }
}