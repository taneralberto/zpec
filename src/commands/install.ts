import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export interface InstallOptions {
  force?: boolean;
}

// Paths destino
const OPENCODE_CONFIG = join(homedir(), ".config", "opencode");
const AGENT_PATH = join(OPENCODE_CONFIG, "agents", "ztructure.md");

/**
 * Obtiene el path al template
 */
function getTemplatePath(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageRoot = dirname(currentDir);
  return join(packageRoot, "templates", filename);
}

/**
 * Verifica si un archivo existe
 */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Instala el agente de Ztructure para OpenCode
 */
export async function install(options: InstallOptions): Promise<void> {
  console.log("\n  Instalando Ztructure para OpenCode...\n");

  // Leer template
  const agentTemplate = await readFile(getTemplatePath("agent.md"), "utf-8");

  // Verificar si ya existe
  const agentExists = await exists(AGENT_PATH);

  if (!options.force && agentExists) {
    console.log(`  ⚠ El agente ya existe en ${AGENT_PATH}`);
    console.log("    Usá --force para sobrescribir\n");
    console.log("  Instalación cancelada. Usá 'spec install --force' para sobrescribir.\n");
    return;
  }

  // Crear directorio
  await mkdir(dirname(AGENT_PATH), { recursive: true });

  // Escribir archivo
  await writeFile(AGENT_PATH, agentTemplate, "utf-8");

  console.log("  ✓ Agente instalado en:");
  console.log(`    ${AGENT_PATH}\n`);

  console.log("  ─────────────────────────────────────────\n");
  console.log("  Ztructure está listo para usar.\n");
  console.log("  El agente se activará automáticamente cuando:");
  console.log("  - Propongas un cambio ('quiero agregar...')");
  console.log("  - Preguntes por decisiones ('¿por qué usamos...?')");
  console.log("  - Menciones CRs o ADRs\n");
  console.log("  Para inicializar un proyecto: spec init\n");
}
