import { z } from "zod";

/**
 * Constraint Severity
 */
export const ConstraintSeveritySchema = z.enum(["hard", "soft"]);

/**
 * Constraint Scope
 */
export const ConstraintScopeSchema = z.object({
  domains: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
});

/**
 * Constraint Enforcement
 */
export const EnforcementSchema = z.object({
  code_review: z.enum(["required", "optional"]).optional(),
  migration_check: z.boolean().optional(),
  ci_validation: z.boolean().optional(),
  database_constraint: z.boolean().optional(),
});

/**
 * Constraint Origin
 */
export const ConstraintOriginSchema = z.object({
  reason: z.string().default(""),
  decided_in: z.string().optional(),
  date: z.string().optional(),
});

/**
 * Constraint Schema
 *
 * Define un límite o regla que los cambios deben respetar.
 */
export const ConstraintSchema = z.object({
  schema: z.literal("constraint/v1"),
  id: z
    .string()
    .regex(/^CONSTRAINT-\d+$/, "ID debe tener formato CONSTRAINT-XXX"),
  name: z.string().min(1, "Name es requerido"),
  severity: ConstraintSeveritySchema.default("hard"),

  description: z.string().default(""),

  scope: ConstraintScopeSchema.default({ domains: [], entities: [] }),

  enforcement: EnforcementSchema.optional(),

  origin: ConstraintOriginSchema.optional(),
});

export type Constraint = z.infer<typeof ConstraintSchema>;
export type ConstraintSeverity = z.infer<typeof ConstraintSeveritySchema>;
