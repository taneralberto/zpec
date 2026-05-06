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
const SKILLS_PATH = join(OPENCODE_CONFIG, "skills");

// Skills a instalar (nombre del directorio, archivo fuente)
const SKILLS = [
  { name: "spec-cli", source: "spec-cli.md" },
  { name: "cr-adr-creation", source: "cr-adr-creation.md" },
];

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
 * Instala el agente y skills de Ztructure para OpenCode
 */
export async function install(options: InstallOptions): Promise<void> {
  console.log("\n  Instalando Ztructure para OpenCode...\n");

  // Verificar si ya existe el agente
  const agentExists = await exists(AGENT_PATH);

  if (!options.force && agentExists) {
    console.log("  [!] El agente ya existe en " + AGENT_PATH);
    console.log("    Usa --force para sobrescribir\n");
    console.log("  Instalacion cancelada. Usa 'spec install --force' para sobrescribir.\n");
    return;
  }

  // Crear directorios
  await mkdir(dirname(AGENT_PATH), { recursive: true });
  await mkdir(SKILLS_PATH, { recursive: true });

  // Instalar agente
  const agentTemplate = await readFile(getTemplatePath("agent.md"), "utf-8");
  await writeFile(AGENT_PATH, agentTemplate, "utf-8");
  console.log("  [OK] Agente instalado en:");
  console.log("    " + AGENT_PATH + "\n");

  // Instalar skills
  for (const skill of SKILLS) {
    const skillDir = join(SKILLS_PATH, skill.name);
    await mkdir(skillDir, { recursive: true });
    
    const skillTemplate = await readFile(getTemplatePath(skill.source), "utf-8");
    const skillPath = join(skillDir, "SKILL.md");
    await writeFile(skillPath, skillTemplate, "utf-8");
    console.log("  [OK] Skill instalada: " + skill.name);
  }

  console.log("");
  console.log("  ------------------------------------------\n");
  console.log("  Ztructure esta listo para usar.\n");
  console.log("  El agente se activara automaticamente cuando:");
  console.log("  - Propongas un cambio ('quiero agregar...')");
  console.log("  - Preguntes por decisiones ('por que usamos...?')");
  console.log("  - Menciones CRs o ADRs\n");
  console.log("  Para inicializar un proyecto: spec init\n");
}
