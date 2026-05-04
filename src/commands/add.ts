import { join } from "node:path";
import { cwd } from "node:process";
import { writeYAML, fileExists, SPEC_PATHS } from "../utils/yaml.js";
import type { Domain } from "../schemas/domain.js";

export interface AddDomainOptions {
  force?: boolean;
}

/**
 * Agrega un nuevo domain al proyecto
 */
export async function addDomain(name: string, options: AddDomainOptions): Promise<void> {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const domainId = `DOMAIN-${normalizedName}`;
  const domainFile = join(cwd(), SPEC_PATHS.domains, `${domainId}.yaml`);

  // Verificar si ya existe el archivo
  if (!options.force && await fileExists(domainFile)) {
    console.log(`\n  ✗ El domain '${domainId}' ya existe.`);
    console.log(`    Usá --force para sobrescribir.\n`);
    return;
  }

  // Crear el domain
  const domain: Domain = {
    schema: "domain/v1",
    id: domainId,
    name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
    bounded_context: normalizedName,
    description: `Bounded context: ${normalizedName}`,
    entities: [],
    relations: [],
    active_crs: [],
    archived_crs: [],
    stakeholders: [],
  };

  await writeYAML(domainFile, domain);

  console.log(`\n  ✓ Domain creado: ${domainId}`);
  console.log(`    Archivo: .project-spec/domains/${domainId}.yaml\n`);
  console.log(`  Editá el archivo para agregar entidades y relaciones.`);
  console.log(`  Luego ejecutá: spec rebuild\n`);
}
