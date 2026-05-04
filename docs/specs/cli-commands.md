# Especificación: CLI Commands

---

## Comandos principales

### `spec init`

Inicializa la estructura `.project-spec/` en el proyecto.

```bash
spec init [options]

Options:
  --domain <name>    Agregar un domain inicial
  --force            Sobrescribir si ya existe
```

**Resultado:**
```txt
.project-spec/
├── changes/
├── decisions/
├── constraints/
├── domains/
├── config.yaml
└── queries/
```

---

### `spec propose`

Inicia el proceso de propuesta de cambio con interview.

```bash
spec propose "<descripcion>" [options]

Options:
  --domain <name>    Domain específico (si no se infiere)
  --no-interview     Saltar interview (solo para cambios triviales)
  --from-prd <file>  Generar múltiples CRs desde un PRD
```

**Flujo:**
```
$ spec propose "agregar credit notes"

→ Analizando propuesta...
→ Detectado domain: billing
→ Detectado entidades: invoice, tax

Interview:
  ¿Las credit notes revierten impuestos? [y/n] y
  ¿Afectan inventario? [y/n] n
  ¿Se pueden emitir parcialmente? [y/n] y
  ¿Impactan reportes históricos? [y/n] y

→ Generando CR-104.yaml
→ ¿Deseas revisar/editar antes de guardar? [Y/n]

✓ CR-104.yaml guardado en .project-spec/changes/
```

---

### `spec validate`

Valida un CR contra la arquitectura existente.

```bash
spec validate <cr-id> [options]

Options:
  --strict           Fallar en warnings, no solo errors
  --fix              Intentar auto-corregir problemas menores
```

**Output:**
```txt
$ spec validate CR-104

Validando CR-104...

✓ Schema válido
✓ Domain existe
✓ Entidades válidas

Warnings:
  ⚠ CR-104 affects 'reports' pero no hay migración definida
  ⚠ ADR-12 no mencionado en affects_decision

Errors:
  ✗ depends_on CR-98 está en status 'proposed' (debe estar approved)
  ✗ Constraint 'preserve_historical_integrity' no tiene estrategia de cumplimiento

❌ Validación falló con 2 errores, 2 warnings
```

---

### `spec approve`

Marca un CR como aprobado (snapshot semántico).

```bash
spec approve <cr-id> [options]

Options:
  --reviewers <names>  Lista de reviewers
  --notes "<text>"     Notas de aprobación
```

**Output:**
```txt
$ spec approve CR-104 --reviewers maria,pedro --notes "Aprobado con condiciones"

→ Actualizando CR-104.yaml
  status: proposed → approved
  approved_at: 2025-05-02T15:00:00Z
  reviewers: [maria, pedro]
  
→ Actualizando índice...

✓ CR-104 aprobado

Commit sugerido:
  git add .project-spec/changes/CR-104.yaml
  git commit -m "spec: approve CR-104 (credit notes)"
```

---

### `spec plan`

Genera plan de implementación desde un CR aprobado.

```bash
spec plan <cr-id> [options]

Options:
  --output <file>     Archivo de salida (default: CR-XXX-plan.md)
  --tasks             Solo generar lista de tareas
```

**Output:**
```txt
$ spec plan CR-104

Analizando CR-104...

Plan de implementación:

Fase 1: Entidades
  □ Crear entidad CreditNote
  □ Crear migración de DB
  □ Agregar relations con Invoice

Fase 2: Lógica
  □ Implementar CreditNoteService
  □ Implementar reversión de impuestos
  □ Implementar auditoría

Fase 3: API
  □ POST /credit-notes
  □ GET /invoices/:id/credit-notes
  □ Tests de integración

Fase 4: Reportes
  □ Actualizar reportes históricos
  □ Agregar filtros de credit notes

Dependencias:
  → CR-98 debe estar implementado primero

→ Generando CR-104-plan.md
✓ Plan guardado
```

---

### `spec implement`

Marca un CR como en implementación.

```bash
spec implement <cr-id> [options]

Options:
  --branch <name>     Branch de trabajo
  --wip               Marcar como work-in-progress
```

---

### `spec sync`

Compara implementación contra spec (reconciliation).

```bash
spec sync <cr-id> [options]

Options:
  --diff              Mostrar diferencias detalladas
  --update-spec       Actualizar spec según implementación
  --update-code       Sugerir cambios de código
```

**Output:**
```txt
$ spec sync CR-104 --diff

Sincronizando CR-104...

Spec dice:
  ✓ Entidad CreditNote creada
  ✓ API POST /credit-notes implementada
  ✓ Tests unitarios presentes
  
Diferencias detectadas:
  ⚠ Spec requería "auditoría de reversión", código no tiene
  ⚠ Spec requería "reportes históricos", código tiene implementación parcial
  
Código extra (no en spec):
  + Endpoint GET /credit-notes/search (no especificado)
  + Validación de límite de crédito (no especificado)

Acciones sugeridas:
  1. Implementar auditoría de reversión
  2. Completar reportes históricos  
  3. Actualizar spec para incluir GET /credit-notes/search
  4. Evaluar si validación de límite debe estar en spec

¿Actualizar spec con código extra? [y/n]
```

---

### `spec archive`

Archiva un CR implementado.

```bash
spec archive <cr-id> [options]

Options:
  --after <months>    Archivar después de X meses (default: 12)
  --force             Archivar sin importar tiempo
```

---

### `spec query`

Ejecuta queries sobre el grafo semántico.

```bash
spec query "<query>" [options]

Options:
  --domain <name>     Limitar a domain
  --format <type>     Output: json, table, md (default: table)
```

**Ejemplos:**
```bash
# Conflictos potenciales
spec query "billing conflicts"

# ¿Qué afecta esta entidad?
spec query "what affects invoices?"

# Historial de decisiones
spec query "auth decisions timeline"

# Dependencias de un CR
spec query "CR-104 dependencies"

# CRs sin approve en 30 días
spec query "stale proposals"
```

---

### `spec rebuild`

Reconstruye el índice SQLite desde los YAMLs.

```bash
spec rebuild [options]

Options:
  --force             Reconstruir aunque no haya cambios
  --verbose           Mostrar progreso
```

---

### `spec lint`

Valida todos los CRs y ADRs.

```bash
spec lint [options]

Options:
  --fix               Auto-corregir problemas menores
  --strict            Fallar en warnings
```

---

### `spec graph`

Visualiza el grafo de dependencias.

```bash
spec graph [options]

Options:
  --domain <name>     Limitar a domain
  --output <file>     Guardar como PNG/SVG
  --format <type>     dot, mermaid, json
```

---

## Hook commands (para git hooks)

### `spec post-merge`

Hook para ejecutar después de `git pull`.

```bash
# .git/hooks/post-merge
#!/bin/bash
spec rebuild --verbose
```

---

### `spec pre-commit`

Hook para validar antes de commit.

```bash
# .git/hooks/pre-commit
#!/bin/bash
spec validate --strict
```

---

## Comandos MCP (para AI integration)

### `spec mcp serve`

Inicia el servidor MCP.

```bash
spec mcp serve [options]

Options:
  --port <number>     Puerto (default: 3000)
  --stdio             Usar stdio en lugar de HTTP
```

---

### Herramientas MCP disponibles

```json
{
  "tools": [
    "spec_analyze_proposal",
    "spec_detect_conflicts", 
    "spec_generate_interview",
    "spec_find_related",
    "spec_temporal_query",
    "spec_reconcile",
    "spec_suggest_adrs"
  ]
}
```
