import { z } from "zod";

/**
 * CR Status - estados del lifecycle de un Change Request
 */
export const CRStatusSchema = z.enum([
  "proposed",
  "approved",
  "rejected",
  "planning",
  "implementing",
  "implemented",
  "archived",
]);

/**
 * Affects - qué entidades/archivos/APIs afecta el cambio
 */
export const AffectsSchema = z.object({
  entities: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  apis: z.array(z.string()).default([]),
});

/**
 * Relationships - relaciones con otros CRs y ADRs
 */
export const RelationshipsSchema = z.object({
  depends_on: z.array(z.string()).default([]),
  affects_decision: z.array(z.string()).default([]),
  conflicts_with: z.array(z.string()).default([]),
  supersedes: z.array(z.string()).default([]),
});

/**
 * Implementation tracking
 */
export const ImplementationSchema = z.object({
  branch: z.string().nullable().default(null),
  pr: z.number().nullable().default(null),
  commits: z.array(z.string()).default([]),
});

/**
 * Change Request Schema (CR)
 *
 * Unidad semántica pequeña y atómica que representa un cambio en el sistema.
 */
export const CRSchema = z.object({
  schema: z.literal("cr/v1"),
  id: z.string().regex(/^CR-\d+$/, "ID debe tener formato CR-XXX"),
  status: CRStatusSchema.default("proposed"),

  // Metadata temporal
  proposed_at: z.string().datetime().or(z.string()).nullable().default(null),
  approved_at: z.string().datetime().or(z.string()).nullable().default(null),
  implemented_at: z.string().datetime().or(z.string()).nullable().default(null),
  author: z.string().default(""),
  reviewers: z.array(z.string()).default([]),

  // Contexto
  domain: z.string().min(1, "Domain es requerido"),
  summary: z.string().min(1, "Summary es requerido"),
  description: z.string().default(""),

  // Impacto
  affects: AffectsSchema.default({ entities: [], files: [], apis: [] }),

  // Relaciones
  relationships: RelationshipsSchema.default({
    depends_on: [],
    affects_decision: [],
    conflicts_with: [],
    supersedes: [],
  }),

  // Constraints
  constraints: z.array(z.string()).default([]),

  // Aceptación
  acceptance_criteria: z.array(z.string()).default([]),

  // Tracking
  implementation: ImplementationSchema.default({
    branch: null,
    pr: null,
    commits: [],
  }),

  // Notas
  notes: z.string().optional(),
});

export type CR = z.infer<typeof CRSchema>;
export type CRStatus = z.infer<typeof CRStatusSchema>;
