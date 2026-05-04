import { z } from "zod";

/**
 * ADR Status
 */
export const ADRStatusSchema = z.enum(["active", "superseded", "deprecated"]);

/**
 * Alternative considerada
 */
export const AlternativeSchema = z.object({
  name: z.string(),
  rejected_because: z.string(),
});

/**
 * Consecuencias (positivas y negativas)
 */
export const ConsequencesSchema = z.object({
  positive: z.array(z.string()).default([]),
  negative: z.array(z.string()).default([]),
});

/**
 * Relationships
 */
export const ADRRelationshipsSchema = z.object({
  affects_crs: z.array(z.string()).default([]),
  related_adrs: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
});

/**
 * Architecture Decision Record (ADR)
 *
 * Registra una decisión arquitectónica importante con su contexto y consecuencias.
 */
export const ADRSchema = z.object({
  schema: z.literal("adr/v1"),
  id: z.string().regex(/^ADR-\d+$/, "ID debe tener formato ADR-XXX"),
  status: ADRStatusSchema.default("active"),

  // Metadata
  decided_at: z.string().nullable().default(null),
  authors: z.array(z.string()).default([]),
  drivers: z.array(z.string()).default([]),

  // Contexto
  context: z.string().default(""),

  // Decisión
  decision: z.string().default(""),

  // Alternativas
  alternatives: z.array(AlternativeSchema).default([]),

  // Consecuencias
  consequences: ConsequencesSchema.default({ positive: [], negative: [] }),

  // Relaciones
  relationships: ADRRelationshipsSchema.default({
    affects_crs: [],
    related_adrs: [],
    constraints: [],
  }),

  // Tags
  tags: z.array(z.string()).default([]),
});

export type ADR = z.infer<typeof ADRSchema>;
export type ADRStatus = z.infer<typeof ADRStatusSchema>;
