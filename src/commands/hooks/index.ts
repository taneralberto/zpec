import { join, dirname } from "node:path";
import { access, mkdir, writeFile, readFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface InstallHooksOptions {
  force?: boolean;
  project?: string;
}

const POST_MERGE_HOOK = `#!/bin/bash
# Ztructure post-merge hook
# Reconstruye el índice después de hacer pull

echo "Reconstruyendo índice de cambios..."
spec rebuild

if [ $? -eq 0 ]; then
    echo "✓ Índice actualizado"
else
    echo "⚠ Error al reconstruir índice"
fi
`;

const PRE_COMMIT_HOOK = `#!/bin/bash
# Ztructure pre-commit hook
# Valida archivos YAML antes de commit

echo "Validando archivos .project-spec/..."

# Verificar si hay cambios en .project-spec
if git diff --cached --name-only | grep -q "^\\.project-spec/"; then
    spec validate --strict
    
    if [ $? -ne 0 ]; then
        echo "✗ Validación falló. Corregí los errores antes de commit."
        exit 1
    fi
    
    echo "✓ Validación exitosa"
fi

exit 0
`;

/**
 * Verifica si estamos en un repositorio git
 */
export async function isGitRepository(projectPath?: string): Promise<boolean> {
  const basePath = projectPath || process.cwd();
  const gitDir = join(basePath, ".git");
  return existsSync(gitDir);
}

/**
 * Obtiene la ruta al directorio de hooks
 */
export function getHooksDir(projectPath?: string): string {
  const basePath = projectPath || process.cwd();
  return join(basePath, ".git", "hooks");
}

/**
 * Instala los hooks de git
 */
export async function installHooks(options: InstallHooksOptions): Promise<void> {
  const projectPath = options.project || process.cwd();
  
  if (!(await isGitRepository(projectPath))) {
    throw new Error("No es un repositorio git. Inicializá git primero con 'git init'");
  }

  const hooksDir = getHooksDir(projectPath);

  // Asegurar que el directorio de hooks existe
  if (!existsSync(hooksDir)) {
    await mkdir(hooksDir, { recursive: true });
  }

  // Instalar post-merge
  await installHook(
    join(hooksDir, "post-merge"),
    POST_MERGE_HOOK,
    "post-merge",
    options.force
  );

  // Instalar pre-commit
  await installHook(
    join(hooksDir, "pre-commit"),
    PRE_COMMIT_HOOK,
    "pre-commit",
    options.force
  );

  console.log("\n  ✓ Hooks instalados:\n");
  console.log("    post-merge   → Ejecuta 'spec rebuild' después de git pull");
  console.log("    pre-commit   → Ejecuta 'spec validate' antes de cada commit\n");
  console.log("  Los hooks están en .git/hooks/\n");
}

async function installHook(
  hookPath: string,
  content: string,
  name: string,
  force: boolean = false
): Promise<void> {
  // Verificar si ya existe
  try {
    await access(hookPath);
    if (!force) {
      // Leer contenido existente
      const existing = await readFile(hookPath, "utf-8");
      
      // Si ya tiene nuestra marca, lo sobrescribimos
      if (!existing.includes("Ztructure")) {
        console.log(`  ⚠ Hook ${name} ya existe. Usá --force para sobrescribir.`);
        return;
      }
    }
  } catch {
    // No existe, continuamos
  }

  // Escribir el hook
  await writeFile(hookPath, content, { mode: 0o755 });
  
  // Asegurar permisos de ejecución
  await chmod(hookPath, 0o755);
}

/**
 * Desinstala los hooks de git
 */
export async function uninstallHooks(projectPath?: string): Promise<void> {
  if (!(await isGitRepository(projectPath))) {
    throw new Error("No es un repositorio git");
  }

  const resolvedPath = projectPath || process.cwd();
  const hooksDir = getHooksDir(resolvedPath);
  const hooks = ["post-merge", "pre-commit"];

  for (const hook of hooks) {
    const hookPath = join(hooksDir, hook);
    try {
      const content = await readFile(hookPath, "utf-8");
      
      // Solo borrar si es nuestro hook
      if (content.includes("Ztructure")) {
        await writeFile(hookPath, "", { mode: 0o644 });
        console.log(`  ✓ Hook ${hook} eliminado`);
      }
    } catch {
      // No existe, ignoramos
    }
  }

  console.log("\n  ✓ Hooks desinstalados\n");
}

/**
 * Verifica el estado de los hooks
 */
export async function checkHooks(projectPath?: string): Promise<void> {
  if (!(await isGitRepository(projectPath))) {
    console.log("\n  ⚠ No es un repositorio git\n");
    return;
  }

  const resolvedPath = projectPath || process.cwd();
  const hooksDir = getHooksDir(resolvedPath);
  const hooks = [
    { name: "post-merge", desc: "Rebuild del índice después de pull" },
    { name: "pre-commit", desc: "Validación antes de commit" },
  ];

  console.log("\n  Estado de hooks:\n");

  for (const hook of hooks) {
    const hookPath = join(hooksDir, hook.name);
    try {
      const content = await readFile(hookPath, "utf-8");
      
      if (content.includes("Ztructure")) {
        console.log(`  ✓ ${hook.name.padEnd(15)} Instalado (${hook.desc})`);
      } else {
        console.log(`  ○ ${hook.name.padEnd(15)} Existe pero no es de Ztructure`);
      }
    } catch {
      console.log(`  ✗ ${hook.name.padEnd(15)} No instalado`);
    }
  }

  console.log();
}
