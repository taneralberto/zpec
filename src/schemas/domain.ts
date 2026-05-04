import { z } from "zod";

/**
 * Domain Relation
 */
export const DomainRelationSchema = z.object({
  domain: z.string(),
  via: z.array(z.string()).default([]),
});

/**
 * Domain Schema
 *
 * Define un bounded context del sistema.
 */
export const DomainSchema = z.object({
  schema: z.literal("domain/v1"),
  id: z.string().regex(/^DOMAIN-/, "ID debe tener formato DOMAIN-xxx"),
  name: z.string().min(1, "Name es requerido"),
  bounded_context: z.string().min(1, "Bounded context es requerido"),

  description: z.string().default(""),

  entities: z.array(z.string()).default([]),

  relations: z.array(DomainRelationSchema).default([]),

  active_crs: z.array(z.string()).default([]),
  archived_crs: z.array(z.string()).default([]),

  owner: z.string().optional(),
  stakeholders: z.array(z.string()).default([]),
});

export type Domain = z.infer<typeof DomainSchema>;
