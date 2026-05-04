# Especificación: Estructura de Archivos YAML

---

## Change Request (CR)

**Ubicación**: `.project-spec/changes/CR-XXX.yaml`

```yaml
# CR-104.yaml
schema: cr/v1
id: CR-104
status: proposed  # proposed | approved | rejected | planning | implementing | implemented | archived

# Metadata
proposed_at: 2025-05-02T10:30:00Z
approved_at: null
implemented_at: null
author: tano
reviewers: []

# Contexto
domain: billing
summary: "Agregar soporte para credit notes"
description: |
  Las credit notes permiten revertir facturas emitidas cuando hay 
  devoluciones, errores de facturación o ajustes posteriores.

# Impacto
affects:
  entities: [invoice, tax, credit_note]
  files: [src/billing/*, src/tax/*]
  apis: [POST /credit-notes, GET /invoices/:id/credit-notes]

# Relaciones
relationships:
  depends_on: [CR-98]  # Debit notes debe existir primero
  affects_decision: [ADR-12]  # Sistema de facturación
  conflicts_with: []  # Se detecta automáticamente
  supersedes: []  # CRs que reemplaza

# Constraints
constraints:
  - preserve_historical_integrity
  - audit_trail_required
  - tax_calculation_must_match

# Aceptación
acceptance_criteria:
  - "Credit note genera asiento contable reversible"
  - "Impuestos se recalculan automáticamente"
  - "Reportes históricos permanecen consistentes"
  - "Auditoría registra quién, cuándo, por qué"

# Tracking
implementation:
  branch: feature/credit-notes
  pr: null
  commits: []
  
# Notas adicionales
notes: |
  Discutido en reunión del 2025-05-01.
  María sugirió considerar credit notes parciales.
```

---

## Architecture Decision Record (ADR)

**Ubicación**: `.project-spec/decisions/ADR-XXX.yaml`

```yaml
# ADR-012.yaml
schema: adr/v1
id: ADR-012
status: active  # active | superseded | deprecated

# Metadata
decided_at: 2024-03-15
authors: [tano, maria]
drivers: [performance, security]

# Contexto
context: |
  Necesitamos un sistema de autenticación que:
  - Escale horizontalmente
  - Soporte múltiples clientes (web, mobile, API)
  - Permita revocación inmediata de tokens

# Decisión
decision: |
  Usaremos JWT con refresh tokens y rotación automática.
  
  - Access token: 15 minutos de vida
  - Refresh token: 7 días, rotado en cada uso
  - Blacklist en Redis para revocación inmediata

# Alternativas consideradas
alternatives:
  - name: "Session-based auth"
    rejected_because: "Requiere sticky sessions o shared store, no escala"
  - name: "Opaque tokens"
    rejected_because: "Cada request requiere DB lookup, más lento"

# Consecuencias
consequences:
  positive:
    - "Stateless para access tokens"
    - "Escalabilidad horizontal nativa"
  negative:
    - "Refresh tokens requieren storage"
    - "Revocación no inmediata para access tokens (15 min window)"

# Relaciones
relationships:
  affects_crs: [CR-45, CR-67, CR-87]
  related_adrs: [ADR-08, ADR-15]
  constraints: [jwt_must_be_hs256]

# Tags para búsqueda
tags: [auth, security, jwt, tokens]
```

---

## Constraint

**Ubicación**: `.project-spec/constraints/CONSTRAINT-XXX.yaml`

```yaml
# CONSTRAINT-001.yaml
schema: constraint/v1
id: CONSTRAINT-001
name: "preserve_historical_integrity"
severity: hard  # hard | soft

description: |
  Los registros históricos (facturas, transacciones, auditoría) 
  nunca pueden ser eliminados o modificados directamente.
  
  Solo se permiten reversaciones mediante credit notes que 
  preservan la trazabilidad completa.

scope:
  domains: [billing, accounting, audit]
  entities: [invoice, transaction, audit_log]

enforcement:
  - code_review: required
  - migration_check: required
  - ci_validation: required

origin:
  reason: "Requerimiento legal (Ley 24.760 - Factura Electrónica)"
  decided_in: ADR-003
```

---

## Domain

**Ubicación**: `.project-spec/domains/DOMAIN-XXX.yaml`

```yaml
# DOMAIN-billing.yaml
schema: domain/v1
id: DOMAIN-billing
name: "Billing"
bounded_context: billing

description: |
  Gestión de facturación, incluyendo facturas, credit notes, 
  debit notes y cálculo de impuestos.

entities:
  - invoice
  - credit_note
  - debit_note
  - tax_calculation

relations:
  - domain: accounting
    via: [invoice, credit_note]
  - domain: reporting
    via: [invoice]

active_crs: [CR-98, CR-104]
archived_crs: [CR-45, CR-67]

owner: @maria
stakeholders: [@tano, @pedro]
```

---

## Configuración del proyecto

**Ubicación**: `.project-spec/config.yaml`

```yaml
schema: config/v1
project:
  name: migtel-billing
  version: 2.4.0

stack:
  backend: nestjs
  frontend: angular
  database: postgresql
  
graph:
  max_domain_crs: 50
  archive_after_months: 12
  relevance_window: 6

relevance:
  max_comparisons: 20
  domain_weight: 10
  entity_weight: 5
  recency_bonus_6m: 5
  recency_bonus_12m: 2
  min_score: 5

ai:
  provider: openrouter  # openrouter | openai | anthropic
  model: anthropic/claude-3-sonnet
  api_key_env: OPENROUTER_API_KEY
  
lint:
  enabled_rules:
    - require_domain
    - require_affects
    - check_conflicts
    - check_dependencies
  fail_on_warning: false

hooks:
  post_merge: spec rebuild-index
  pre_commit: spec validate
```

---

## Saved Query

**Ubicación**: `.project-spec/queries/QUERY-XXX.yaml`

```yaml
# QUERY-billing-conflicts.yaml
schema: query/v1
id: QUERY-billing-conflicts
name: "Billing Conflicts"

description: "Detectar conflictos potenciales en billing domain"

sql: |
  SELECT 
    c1.id as change_id,
    c2.id as conflicting_id,
    'potential_conflict' as conflict_type,
    c1.summary as change_summary,
    c2.summary as conflicting_summary
  FROM changes c1
  JOIN changes c2 ON c1.domain = c2.domain
  WHERE c1.status = 'proposed'
    AND c2.status IN ('approved', 'implementing', 'implemented')
    AND array_intersect(c1.affects, c2.affects) != []
  ORDER BY c1.proposed_at DESC;

tags: [billing, conflicts, review]
```

---

## Índice SQLite (derivado)

**Ubicación**: `.project-spec/graph.db` (NO commitear)

```sql
-- Tablas principales
CREATE TABLE changes (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT,
  proposed_at TIMESTAMP,
  approved_at TIMESTAMP,
  implemented_at TIMESTAMP,
  author TEXT,
  json_data TEXT  -- Full YAML as JSON
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  decided_at TIMESTAMP,
  json_data TEXT
);

CREATE TABLE change_affects (
  change_id TEXT REFERENCES changes(id),
  entity TEXT NOT NULL,
  PRIMARY KEY (change_id, entity)
);

CREATE TABLE change_relationships (
  from_id TEXT REFERENCES changes(id),
  relationship_type TEXT,  -- depends_on, conflicts_with, supersedes
  to_id TEXT,
  PRIMARY KEY (from_id, relationship_type, to_id)
);

-- Índices
CREATE INDEX idx_changes_domain ON changes(domain);
CREATE INDEX idx_changes_status ON changes(status);
CREATE INDEX idx_changes_proposed ON changes(proposed_at DESC);
CREATE INDEX idx_affects_entity ON change_affects(entity);

-- FTS para búsqueda
CREATE VIRTUAL TABLE changes_fts USING fts5(id, summary, description, domain);
```

---

## .gitignore

```gitignore
# .project-spec/.gitignore

# Índice derivado - cada dev tiene el suyo
graph.db
graph.db-wal
graph.db-shm

# Markdown generado (no canonical)
*.md
!README.md

# Cache
.cache/
```
