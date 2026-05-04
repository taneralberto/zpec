#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./commands/init.js";
import { install } from "./commands/install.js";
import { validate } from "./commands/validate.js";
import { rebuild } from "./commands/rebuild.js";
import { query, listChanges, listDecisions, showStatus } from "./commands/query.js";
import { graph } from "./commands/graph.js";
import { installHooks, uninstallHooks, checkHooks } from "./commands/hooks/index.js";

const program = new Command();

program
  .name("spec")
  .description("Sistema operativo AI-native para evolución de software")
  .version("0.1.0");

// Comando: spec install
program
  .command("install")
  .description("Instala el agente y skill de Ztructure para OpenCode")
  .option("-f, --force", "Sobrescribir si ya existe")
  .action(async (options) => {
    try {
      await install({ force: options.force });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`\n✗ Error: ${message}\n`);
      process.exit(1);
    }
  });

// Comando: spec init
program
  .command("init")
  .description("Inicializa la estructura .project-spec/ en el proyecto")
  .option("-d, --domain <name>", "Agregar un domain inicial (puede usarse múltiples veces)", (value, previous: string[]) => [...previous, value], [] as string[])
  .option("-f, --force", "Sobrescribir si ya existe")
  .action(async (options) => {
    try {
      await init({
        domain: options.domain.length > 0 ? options.domain : undefined,
        force: options.force,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`\n✗ Error: ${message}\n`);
      process.exit(1);
    }
  });

// Comando: spec add
const addCommand = program
  .command("add")
  .description("Agrega elementos al proyecto");

addCommand
  .command("domain <name>")
  .description("Agrega un nuevo domain (bounded context)")
  .option("-f, --force", "Sobrescribir si ya existe")
  .action(async (name, options) => {
    try {
      const { addDomain } = await import("./commands/add.js");
      await addDomain(name, { force: options.force });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`\n✗ Error: ${message}\n`);
      process.exit(1);
    }
  });

// Comando: spec validate
program
  .command("validate [target]")
  .description("Valida archivos YAML contra schemas")
  .option("-s, --strict", "Fallar en warnings, no solo errors")
  .action(async (target, options) => {
    await validate(target, { strict: options.strict });
  });

// Comando: spec rebuild
program
  .command("rebuild")
  .description("Reconstruye el índice SQLite desde los YAMLs")
  .option("-f, --force", "Reconstruir aunque no haya cambios")
  .option("-v, --verbose", "Mostrar progreso detallado")
  .action(async (options) => {
    await rebuild({
      force: options.force,
      verbose: options.verbose,
    });
  });

// Comando: spec query
program
  .command("query <query>")
  .description("Ejecuta queries sobre el grafo semántico")
  .option("-d, --domain <name>", "Limitar a domain específico")
  .option("-f, --format <type>", "Formato de salida: table, json, md", "table")
  .action(async (queryStr, options) => {
    await query(queryStr, {
      domain: options.domain,
      format: options.format,
    });
  });

// Comando: spec list
program
  .command("list [type]")
  .description("Lista CRs, ADRs o domains")
  .option("-d, --domain <name>", "Filtrar por domain")
  .action(async (type, options) => {
    switch (type) {
      case "crs":
      case "changes":
        await listChanges({ domain: options.domain });
        break;
      case "adrs":
      case "decisions":
        await listDecisions();
        break;
      case "domains":
        const { getAllDomains } = await import("./utils/indexers/index.js");
        const { getDatabase } = await import("./utils/database.js");
        const db = getDatabase();
        const domains = getAllDomains(db);
        console.log("\n  Domains:\n");
        for (const domain of domains) {
          console.log(`  ${domain.id.padEnd(20)} ${domain.name}`);
        }
        console.log(`\n  ${domains.length} domain(s)\n`);
        db.close();
        break;
      default:
        // List all
        await showStatus();
    }
  });

// Comando: spec status
program
  .command("status")
  .description("Muestra el estado actual del grafo semántico")
  .action(async () => {
    await showStatus();
  });

// Comando: spec graph
program
  .command("graph [target]")
  .description("Genera visualización del grafo en formato Mermaid o DOT")
  .option("-f, --format <type>", "Formato de salida: mermaid, dot", "mermaid")
  .option("-d, --domain <name>", "Filtrar por domain específico")
  .action(async (target, options) => {
    await graph(target, {
      format: options.format,
      domain: options.domain,
    });
  });

// Comando: spec hooks
const hooksCommand = program
  .command("hooks")
  .description("Gestiona los hooks de git");

hooksCommand
  .command("install")
  .description("Instala los hooks de git (post-merge, pre-commit)")
  .option("-f, --force", "Sobrescribir hooks existentes")
  .action(async (options) => {
    try {
      await installHooks({ force: options.force });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`\n✗ Error: ${message}\n`);
      process.exit(1);
    }
  });

hooksCommand
  .command("uninstall")
  .description("Desinstala los hooks de git")
  .action(async () => {
    try {
      await uninstallHooks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.error(`\n✗ Error: ${message}\n`);
      process.exit(1);
    }
  });

hooksCommand
  .command("status")
  .description("Verifica el estado de los hooks de git")
  .action(async () => {
    await checkHooks();
  });

// Comando: spec propose (placeholder para Fase 2)
program
  .command("propose <description>")
  .description("Inicia el proceso de propuesta de cambio con interview")
  .action(() => {
    console.log("\n  ⚠ Comando 'propose' aún no implementado\n");
    console.log("  Disponible en Fase 2: AI Layer\n");
  });

// Comando: spec approve (placeholder)
program
  .command("approve <cr-id>")
  .description("Marca un CR como aprobado")
  .action((crId) => {
    console.log(`\n  ⚠ Comando 'approve' aún no implementado\n`);
    console.log(`  CR: ${crId}\n`);
  });

// Comando: spec plan (placeholder)
program
  .command("plan <cr-id>")
  .description("Genera plan de implementación desde un CR aprobado")
  .action((crId) => {
    console.log(`\n  ⚠ Comando 'plan' aún no implementado\n`);
    console.log(`  CR: ${crId}\n`);
  });

// Comando: spec sync (placeholder)
program
  .command("sync <cr-id>")
  .description("Compara implementación contra spec (reconciliation)")
  .action((crId) => {
    console.log(`\n  ⚠ Comando 'sync' aún no implementado\n`);
    console.log(`  CR: ${crId}\n`);
  });

program.parse();
