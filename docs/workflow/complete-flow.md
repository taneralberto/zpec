# Workflow: Flujo Completo de un Cambio

---

## Fase 0: Inicialización

```bash
$ cd /path/to/project
$ spec init --domain billing --domain auth --domain reporting

✓ Estructura creada en .project-spec/
✓ config.yaml generado
✓ Índice SQLite inicializado

Proximo paso: git add .project-spec/ && git commit -m "spec: init"
```

---

## Fase 1: Propuesta

### Input del usuario (natural language)

```bash
$ spec propose "necesito agregar credit notes para reversar facturas"

→ Analizando propuesta con AI...
→ Detectado domain: billing
→ Detectado entidades: invoice, tax, credit_note
→ Nivel de ambigüedad: ALTO
→ Iniciando interview...
```

### Requirement Interview

```txt
INTERVIEW: Credit Notes

[P] Las credit notes revierten impuestos automáticamente?
    (a) Sí, recalcula todo
    (b) No, se manejan por separado
    (c) Depende del tipo de reversión
    
Tu respuesta: a

[P] ¿Afectan el inventario de productos?
    (a) Sí, devuelven stock
    (b) No, solo contabilidad
    (c) Parcialmente, según configuración
    
Tu respuesta: b

[P] ¿Se pueden emitir credit notes parciales?
    (a) Sí, monto parcial permitido
    (b) No, siempre el total de la factura
    (c) Solo con aprobación especial
    
Tu respuesta: a

[P] ¿Qué pasa con los reportes históricos?
    (a) Se recalculan automáticamente
    (b) Se mantienen como estaban
    (c) Se generan ajustes en reportes nuevos
    
Tu respuesta: c

[P] ¿Necesitan aprobación antes de emitirse?
    (a) Sí, siempre
    (b) No, nunca
    (c) Solo arriba de cierto monto
    
Tu respuesta: c
    → ¿Cuál es el monto límite? $5000

→ Interview completado
→ Generando CR-104.yaml...
```

### Output: CR generado

```yaml
# .project-spec/changes/CR-104.yaml
schema: cr/v1
id: CR-104
status: proposed
proposed_at: 2025-05-02T10:30:00Z
author: tano

domain: billing
summary: "Agregar credit notes para reversión parcial/total de facturas"
description: |
  Sistema de credit notes que permite revertir facturas emitidas.
  Soporta reversión parcial y total, con recalculo automático de impuestos.
  Los reportes históricos permanecen intactos, se generan ajustes nuevos.

affects:
  entities: [invoice, tax_calculation, credit_note, report_adjustment]
  files: [src/billing/*, src/tax/*, src/reporting/*]
  apis:
    - POST /credit-notes
    - GET /invoices/:id/credit-notes
    - POST /credit-notes/:id/approve

constraints:
  - preserve_historical_integrity
  - audit_trail_required
  - approval_above_5000_usd

acceptance_criteria:
  - "Credit note genera ajuste contable reversible"
  - "Impuestos se recalculan automáticamente"
  - "Reportes históricos permanecen sin cambios"
  - "Auditoría registra quién, cuándo, por qué, monto"
  - "Credit notes > $5000 requieren aprobación"
  - "Soporta reversión parcial y total"

relationships:
  depends_on: [CR-98]  # debit notes
  affects_decision: [ADR-12]  # billing system architecture
```

---

## Fase 2: Validación

```bash
$ spec validate CR-104

Validando CR-104...

✓ Schema válido
✓ Domain existe (billing)
✓ Entidades válidas
✓ Constraints referenciadas existen

Análisis de conflictos:
  ⚠ Potencial conflicto con CR-87 (tax calculation)
    CR-87 modificó el cálculo de impuestos en 2024-11
    CR-104 asume el algoritmo anterior
    
  ⚠ Dependencia CR-98 está en status 'implementing'
    CR-104 no puede empezar hasta que CR-98 termine

Warnings:
  ⚠ ADR-12 (billing architecture) mencionado pero no detallado impacto
  ⚠ Constraint 'approval_above_5000_usd' no tiene definición formal

Errors: 0
Warnings: 4

¿Continuar con aprobación a pesar de warnings? [y/N] n
```

### Iteración: resolver warnings

```bash
$ spec edit CR-104

# Usuario edita el YAML o:
$ spec propose --refine CR-104

→ Refinando CR-104...
→ Agregando detalle sobre ADR-12 impacto...
→ Definiendo constraint approval_above_5000_usd...
→ Ajustando asunciones de tax calculation...

✓ CR-104 actualizado
```

---

## Fase 3: Aprobación

```bash
$ spec approve CR-104 --reviewers maria,pedro --notes "Aprobado con revisiones menores"

→ Actualizando CR-104.yaml
  status: proposed → approved
  approved_at: 2025-05-02T15:00:00Z
  reviewers: [maria, pedro]
  
→ Actualizando grafo de dependencias...

✓ CR-104 aprobado

Commit sugerido:
  git add .project-spec/changes/CR-104.yaml
  git commit -m "spec: approve CR-104 (credit notes for invoice reversal)"
```

---

## Fase 4: Planning

```bash
$ spec plan CR-104

Analizando CR-104 y dependencias...

Dependencias:
  → CR-98 (debit notes): status=implementing, 80% completo
    Estimado: 2 días
  
Plan de implementación:

Fase 1: Entidades (después de CR-98)
  □ Crear entidad CreditNote
  □ Migración: tabla credit_notes
  □ Migración: relación invoice ↔ credit_notes
  
Fase 2: Lógica de negocio
  □ CreditNoteService.create()
  □ TaxCalculationService.recalculate()
  □ ApprovalService.checkLimit()
  □ AuditService.log()
  
Fase 3: API REST
  □ POST /credit-notes
  □ GET /invoices/:id/credit-notes  
  □ POST /credit-notes/:id/approve
  □ Tests de integración
  
Fase 4: Reportes
  □ ReportAdjustmentService.create()
  □ Actualizar reportes mensuales
  □ Tests E2E

Estimación: 8-10 días hábiles (dependiendo de CR-98)

→ Generando CR-104-plan.md
✓ Plan guardado
```

---

## Fase 5: Implementación

```bash
$ spec implement CR-104 --branch feature/credit-notes

→ Creando branch: feature/credit-notes
→ Actualizando CR-104.yaml: status → implementing
→ Seteando implementation.branch

✓ Listo para implementar

Referencia:
  - Plan: CR-104-plan.md
  - Spec: CR-104.yaml
  - Dependencias: CR-98 (verificar status)

Proximo paso: implementar según plan
```

### Durante implementación

```bash
$ spec status CR-104

CR-104: Credit Notes
Status: implementing (30% según plan)
Branch: feature/credit-notes
  
Progress:
  Fase 1: ████████████████████ 100% ✓
    ✓ Entidad CreditNote creada
    ✓ Migraciones aplicadas
    
  Fase 2: ████████░░░░░░░░░░░░  40%
    ✓ CreditNoteService.create()
    □ TaxCalculationService.recalculate()
    □ ApprovalService.checkLimit()
    
  Fase 3: ░░░░░░░░░░░░░░░░░░░░   0%
  Fase 4: ░░░░░░░░░░░░░░░░░░░░   0%

Blockers:
  ⚠ TaxCalculationService necesita refactor (ver ADR-15)
```

---

## Fase 6: Reconciliación

```bash
$ spec sync CR-104 --diff

Sincronizando CR-104...

Comparando spec vs implementación...

Spec dice:
  ✓ Entidad CreditNote creada
  ✓ API POST /credit-notes implementada
  ✓ Aprobación arriba de $5000 funciona
  
Diferencias:
  ⚠ Spec: "recalculo automático de impuestos"
    Code: implementado pero solo para IVA, no para otros impuestos
    
  ⚠ Spec: "reportes históricos sin cambios"
    Code: correcto, pero agregaron endpoint GET /credit-notes/search
    → ¿Era parte del scope o scope creep?
    
  ✗ Spec: "auditoría registra quién, cuándo, por qué"
    Code: falta campo 'reason' en audit_log
    
Extra en código (no en spec):
  + Validación de límite de crédito diario ($50k/día)
  + Endpoint de búsqueda avanzada

Acciones:
  1. Completar auditoría con campo 'reason'
  2. Agregar soporte para todos los impuestos
  3. Decidir si validación de $50k/día va a spec
  4. Documentar GET /credit-notes/search en spec

¿Abrir CR de ajuste para items 1-2? [Y/n]
¿Actualizar spec con items 3-4? [Y/n]
```

---

## Fase 7: Completado

```bash
$ spec complete CR-104 --pr 234

→ Verificando reconciliación...
  ✓ Todos los items de spec implementados
  ✓ CR de ajuste CR-106 completado
  
→ Actualizando CR-104.yaml:
  status: implemented
  implemented_at: 2025-05-15
  pr: 234
  commits: [a1b2c3d, e4f5g6h]
  
→ Actualizando dependientes...
  CR-107 (reporting) ahora puede iniciar

✓ CR-104 marcado como implementado

Commit:
  git add .project-spec/changes/CR-104.yaml
  git commit -m "spec: complete CR-104 (credit notes)"
```

---

## Fase 8: Archivado (automático)

```yaml
# .project-spec/config.yaml
graph:
  archive_after_months: 12
```

Después de 12 meses:

```bash
$ spec archive --auto

→ CR-104 tiene 14 meses implementado
  Archivando...

→ CR-104.yaml movido a .project-spec/archive/
→ Referencias actualizadas en grafo
→ Eliminado de queries activas

✓ CR-104 archivado
```

---

## Diagrama del flujo completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ZTRUCTURE WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────┘

 Usuario dice: "necesito credit notes"
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 1: PROPOSE                                                     │
│  ─────────────────────                                              │
│  spec propose → Interview → CR-104.yaml                             │
│                                                                      │
│  AI: Parsea, detecta ambigüedad, hace preguntas, genera spec         │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 2: VALIDATE                                                    │
│  ─────────────────────                                              │
│  spec validate CR-104                                               │
│                                                                      │
│  Sistema: Check schema, conflicts, dependencies, constraints        │
│  Output: Warnings/errors con sugerencias                           │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 3: APPROVE                                                     │
│  ─────────────────────                                              │
│  spec approve CR-104 --reviewers ...                                │
│                                                                      │
│  Snapshot semántico, estado: approved                                │
│  Git commit del approval                                             │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 4: PLAN                                                        │
│  ─────────────────────                                              │
│  spec plan CR-104 → CR-104-plan.md                                  │
│                                                                      │
│  Sistema: Genera checklist, fases, dependencias, estimaciones       │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 5: IMPLEMENT                                                   │
│  ─────────────────────                                              │
│  spec implement CR-104 → branch, tracking                           │
│                                                                      │
│  Dev: Implementa según plan y spec                                  │
│  Sistema: Trackea progreso                                          │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 6: SYNC (Reconciliación)                                      │
│  ─────────────────────                                              │
│  spec sync CR-104 --diff                                            │
│                                                                      │
│  Sistema: Compara spec vs código                                    │
│  Detecta: gaps, scope creep, extra features                         │
│  Sugerencias: ajustar spec o ajustar código                        │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 7: COMPLETE                                                    │
│  ─────────────────────                                              │
│  spec complete CR-104 --pr 234                                      │
│                                                                      │
│  estado: implemented                                                │
│  Actualiza dependientes                                             │
│  Git commit                                                          │
└─────────────────────────────────────────────────────────────────────┘
              │
              │ (12+ meses)
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FASE 8: ARCHIVE                                                     │
│  ─────────────────────                                              │
│  spec archive CR-104                                                │
│                                                                      │
│  Movido a archive/                                                   │
│  Eliminado de queries activas                                       │
│  Histórico preservado                                               │
└─────────────────────────────────────────────────────────────────────┘
```
