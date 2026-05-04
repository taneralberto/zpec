import { mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { cwd } from "node:process";
import { writeYAML, fileExists, SPEC_DIR, SPEC_PATHS } from "../utils/yaml.js";
import { createDefaultConfig, type Config } from "../schemas/index.js";

export interface InitOptions {
  domain?: string[];
  force?: boolean;
}

/**
 * Crea la estructura .project-spec/ en el proyecto
 */
export async function init(options: InitOptions): Promise<void> {
  const projectPath = cwd();
  const specPath = join(projectPath, SPEC_DIR);

  // Verificar si ya existe
  if (!options.force && await fileExists(specPath)) {
    throw new Error(
      `${SPEC_DIR} ya existe. Usá --force para sobrescribir.`
    );
  }

  // Crear directorios
  const directories = [
    SPEC_PATHS.changes,
    SPEC_PATHS.decisions,
    SPEC_PATHS.constraints,
    SPEC_PATHS.domains,
    SPEC_PATHS.queries,
  ];

  for (const dir of directories) {
    await mkdir(join(projectPath, dir), { recursive: true });
  }

  // Crear config.yaml base
  const projectName = basename(projectPath);
  const config: Config = createDefaultConfig(projectName);

  await writeYAML(join(projectPath, SPEC_PATHS.config), config);

  // Crear domains iniciales si se especificaron
  if (options.domain && options.domain.length > 0) {
    for (const domainName of options.domain) {
      const domainFile = join(
        projectPath,
        SPEC_PATHS.domains,
        `DOMAIN-${domainName}.yaml`
      );
      await writeYAML(domainFile, {
        schema: "domain/v1",
        id: `DOMAIN-${domainName}`,
        name: domainName.charAt(0).toUpperCase() + domainName.slice(1),
        bounded_context: domainName,
        description: `Bounded context: ${domainName}`,
        entities: [],
        relations: [],
        active_crs: [],
        archived_crs: [],
      });
    }
  }

  // Crear .gitignore para el índice
  const gitignore = `# Índice derivado - cada dev tiene el suyo
graph.db
graph.db-wal
graph.db-shm

# Cache
.cache/
`;
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(specPath, ".gitignore"), gitignore, "utf-8");

  console.log(`\n✓ Estructura creada en ${SPEC_DIR}/`);
  console.log(`✓ config.yaml generado`);
  
  if (options.domain && options.domain.length > 0) {
    console.log(`✓ Domains creados: ${options.domain.join(", ")}`);
  }
  
  console.log(`\n  Próximo paso: git add ${SPEC_DIR}/ && git commit -m "spec: init"\n`);
}
