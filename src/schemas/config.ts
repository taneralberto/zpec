import { z } from "zod";

/**
 * Graph configuration
 */
export const GraphConfigSchema = z.object({
  max_domain_crs: z.number().default(50),
  archive_after_months: z.number().default(12),
  relevance_window: z.number().default(6),
});

/**
 * Relevance scoring configuration
 */
export const RelevanceConfigSchema = z.object({
  max_comparisons: z.number().default(20),
  domain_weight: z.number().default(10),
  entity_weight: z.number().default(5),
  recency_bonus_6m: z.number().default(5),
  recency_bonus_12m: z.number().default(2),
  min_score: z.number().default(5),
});

/**
 * AI configuration
 */
export const AIConfigSchema = z.object({
  provider: z.enum(["openrouter", "openai", "anthropic"]).default("openrouter"),
  model: z.string().default("anthropic/claude-3-sonnet"),
  api_key_env: z.string().default("OPENROUTER_API_KEY"),
});

/**
 * Lint configuration
 */
export const LintConfigSchema = z.object({
  enabled_rules: z
    .array(z.string())
    .default([
      "require_domain",
      "require_affects",
      "check_conflicts",
      "check_dependencies",
    ]),
  fail_on_warning: z.boolean().default(false),
});

/**
 * Hooks configuration
 */
export const HooksConfigSchema = z.object({
  post_merge: z.string().default("spec rebuild-index"),
  pre_commit: z.string().default("spec validate"),
});

/**
 * Project configuration
 */
export const ProjectConfigSchema = z.object({
  name: z.string().min(1, "Project name es requerido"),
  version: z.string().default("0.1.0"),
});

/**
 * Stack configuration
 */
export const StackConfigSchema = z.object({
  backend: z.string().optional(),
  frontend: z.string().optional(),
  database: z.string().optional(),
  runtime: z.string().optional(),
});

/**
 * Config Schema
 *
 * Configuración general del proyecto.
 */
export const ConfigSchema = z.object({
  schema: z.literal("config/v1"),

  project: ProjectConfigSchema,
  stack: StackConfigSchema.optional(),

  graph: GraphConfigSchema.optional(),
  relevance: RelevanceConfigSchema.optional(),
  ai: AIConfigSchema.optional(),
  lint: LintConfigSchema.optional(),
  hooks: HooksConfigSchema.optional(),
});

/**
 * Aplica valores por defecto a un config parcial
 */
export function createDefaultConfig(projectName: string): Config {
  return {
    schema: "config/v1",
    project: {
      name: projectName,
      version: "0.1.0",
    },
    graph: {
      max_domain_crs: 50,
      archive_after_months: 12,
      relevance_window: 6,
    },
    relevance: {
      max_comparisons: 20,
      domain_weight: 10,
      entity_weight: 5,
      recency_bonus_6m: 5,
      recency_bonus_12m: 2,
      min_score: 5,
    },
    ai: {
      provider: "openrouter",
      model: "anthropic/claude-3-sonnet",
      api_key_env: "OPENROUTER_API_KEY",
    },
    lint: {
      enabled_rules: [
        "require_domain",
        "require_affects",
        "check_conflicts",
        "check_dependencies",
      ],
      fail_on_warning: false,
    },
    hooks: {
      post_merge: "spec rebuild-index",
      pre_commit: "spec validate",
    },
  };
}

export type Config = z.infer<typeof ConfigSchema>;
