---
name: ztructure
description: >
  Sistema operativo AI-native para evolución de software.
  Gestiona Change Requests (CRs), Architecture Decision Records (ADRs),
  constraints y domains usando el CLI `spec`.
  Trigger: Cuando el usuario menciona CR, ADR, spec, change request,
  architectural decision, proponer cambio, "quiero agregar", "necesito implementar".
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Usuario propone un cambio (feature, refactor, fix, removal)
- Usuario pregunta por decisiones arquitectónicas pasadas
- Usuario dice "decidimos X" o "vamos a usar X"
- Necesitas crear, leer o modificar CRs o ADRs
- Al comenzar trabajo en el proyecto

---

## Critical Patterns

### FLUJO OBLIGATORIO para crear CRs

```
1. ENTENDER → ¿Qué pide realmente?
2. CONTEXTO → spec status, spec query
3. INTERVIEW → Reducir ambigüedad
4. VALIDAR → ¿Conflicta con existente?
5. CREAR → Recién ahí el CR
```

**NUNCA crear CR sin interview si hay ambigüedad.**

### Siempre empezar con contexto

```bash
spec status
spec rebuild  # si el índice no existe
spec query "<términos relacionados>"
spec list adrs  # ver decisiones previas
```

---

## Interview: Reducir ambigüedad

### Detección de ambigüedad

| Usuario dice | Falta preguntar |
|--------------|-----------------|
| "agregar X" | ¿Parcial/total? ¿Afecta qué? ¿Depende de? |
| "mejorar X" | ¿Por qué? ¿Cuánto? ¿Trade-offs? |
| "refactorizar X" | ¿Qué está mal? ¿Alternativas? |
| "implementar X" | ¿Flujo completo? ¿Casos borde? |

### Preguntas por tipo de cambio

**Entidades**: ¿Qué se crea/modifica? ¿Relaciones? ¿Datos existentes?

**APIs**: ¿Nueva o modifica? ¿Consumidores? ¿Breaking changes?

**Arquitectura**: ¿Problema? ¿Alternativas? ¿Trade-offs? ¿Escala?

**Negocio**: ¿Flujo completo? ¿Errores? ¿Permisos? ¿Límites?

**Universal**: ¿Dependencias? ¿ADRs afectados? ¿Constraints? ¿Criterio de aceptación?

---

## Commands

```bash
# Estado
spec status

# Contexto
spec rebuild
spec query "<término>"           # Full-text search en CRs y ADRs
spec query "proposed CRs"        # Por status
spec query "CR-001 dependencies" # Relaciones
spec list crs
spec list adrs
spec list domains

# Visualización
spec graph                       # Grafo completo (Mermaid)
spec graph core                  # Por domain
spec graph CR-001                # Relaciones de un CR
spec graph --format dot          # Graphviz DOT

# Validación con conflict detection
spec validate
spec validate CR-XXX             # Detecta overlap + status dependencias

# Hooks
spec hooks status
spec hooks install
```

### Búsqueda Full-Text

`spec query` busca en **CRs y ADRs**:

```bash
spec query "JWT"           # Encuentra ADRs con decisiones de auth
spec query "PostgreSQL"    # Encuentra ADRs de base de datos
spec query "factura"       # Encuentra CRs relacionados
```

Los resultados muestran `[CR]` o `[ADR]` para distinguir el tipo.

### Conflict Detection (spec validate CR-XXX)

Detecta automáticamente:
- **Entity overlap**: 2+ entidades compartidas con otro CR
- **File overlap**: 2+ archivos compartidos
- **API overlap**: cualquier API compartida
- **Dependency status**: depends_on con status inválido (proposed/rejected/blocked)

### Graph (spec graph)

- Output a stdout (redirigir a archivo para guardar)
- **Mermaid** (default): GitHub, Notion, Obsidian
- **DOT**: Graphviz para imágenes

### Índice desactualizado

Los comandos detectan automáticamente si el índice está stale:
- Compara timestamps de archivos YAML vs `graph.db`
- Muestra warning con lista de archivos sin indexar
- Recordatorio de ejecutar `spec rebuild`

---

## CR Schema

```yaml
schema: cr/v1
id: CR-XXX
status: proposed
proposed_at: <ISO date>
author: <nombre>

domain: <domain>           # Obligatorio
summary: "<específico>"
description: |
  Contexto completo del cambio.

affects:
  entities: []
  files: []
  apis: []

relationships:
  depends_on: []           # CRs previos
  affects_decision: []     # ADRs impactados

constraints: []
acceptance_criteria: []    # Medibles
```

---

## ADR Schema

```yaml
schema: adr/v1
id: ADR-XXX
status: active
decided_at: <fecha>
authors: []

context: |
  ¿Qué problema? ¿Qué restricciones?

decision: |
  ¿Qué se decidió?

alternatives:
  - name: "<opción>"
    rejected_because: "<razón>"

consequences:
  positive: []
  negative: []

tags: []
```

---

## Common Errors

```yaml
# MAL - sin comillas en @
owner: @usuario

# BIEN
owner: "@usuario"
```

- Siempre `spec validate` antes de commit
- Siempre `spec rebuild` después de cambios
- Un CR = un cambio conceptual, no una feature gigante

---

## Resources

- **Schemas**: Ver `src/schemas/` para validación completa
- **Ejemplos**: Ver `docs/examples/billing-system.md`
- **Workflow**: Ver `docs/workflow/complete-flow.md`
