---
description: Skill para crear CRs, ADRs y Domains. Incluye convenciones de nombres, schemas, status válidos, triggers para ADR, y errores comunes. Usar cuando se esté en el flujo de creación de artefactos.
---

## Convenciones de Ztructure (OBLIGATORIO)

### Nombres de archivos

**Todos los archivos siguen un prefijo obligatorio:**

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Change Request | `CR-XXX.yaml` | `CR-001.yaml`, `CR-042.yaml` |
| Decision (ADR) | `ADR-XXX.yaml` | `ADR-001.yaml`, `ADR-015.yaml` |
| Domain | `DOMAIN-<nombre>.yaml` | `DOMAIN-billing.yaml`, `DOMAIN-auth.yaml` |
| Constraint | `CONSTRAINT-XXX.yaml` | `CONSTRAINT-001.yaml` |

**NUNCA** crear archivos sin prefijo (ej: `billing.yaml` es inválido).

### IDs dentro del archivo

El `id` debe coincidir con el nombre del archivo (sin extensión):

```yaml
# Archivo: .project-spec/domains/DOMAIN-billing.yaml
schema: domain/v1
id: DOMAIN-billing        # ← Coincide con el nombre del archivo
name: "Billing"
```

---

## Ejemplos completos de cada tipo

### Domain (`DOMAIN-xxx.yaml`)

```yaml
schema: domain/v1
id: DOMAIN-billing
name: "Billing"
bounded_context: billing          # ← OBLIGATORIO
description: "Gestión de facturación y pagos"
entities:
  - Invoice
  - CreditNote
relations:
  - domain: auth
    via: [User]
active_crs: []
archived_crs: []
stakeholders: []
owner: "@usuario"
```

### Change Request (`CR-xxx.yaml`)

```yaml
schema: cr/v1
id: CR-001
status: proposed                  # OBLIGATORIO
proposed_at: "2026-05-03"         # OBLIGATORIO cuando status = proposed
author: "@usuario"
domain: billing                   # OBLIGATORIO, debe existir en domains/
summary: "Descripción corta"
description: |
  Contexto completo del cambio.
affects:
  entities: [Invoice, CreditNote]
  files: ["src/billing/*.ts"]
  apis: ["POST /invoices/:id/credit"]
relationships:
  depends_on: []                  # IDs de CRs previos
  affects_decision: []            # IDs de ADRs impactados
constraints: []
acceptance_criteria:
  - "Criterio medible"
```

### ADR (`ADR-xxx.yaml`)

```yaml
schema: adr/v1
id: ADR-001
status: active                    # OBLIGATORIO
decided_at: "2026-05-03"          # OBLIGATORIO
authors: ["@usuario"]
context: |
  ¿Qué problema? ¿Qué restricciones?
decision: |
  ¿Qué se decidió?
alternatives:
  - name: "Opción B"
    rejected_because: "Razón"
consequences:
  positive: ["Ventaja"]
  negative: ["Desventaja"]
tags: [architecture, database]
```

---

## Status válidos

### Para CR

| Status | Fecha asociada | Significado |
|-------|----------------|-------------|
| `proposed` | `proposed_at` | CR creado, pendiente de revisión |
| `approved` | `approved_at` | CR aprobado, listo para planificar |
| `rejected` | `rejected_at` | CR rechazado, no se implementa |
| `planning` | (hereda approved_at) | Planificando implementación |
| `implementing` | (hereda approved_at) | En desarrollo |
| `implemented` | `implemented_at` | Código mergeado |
| `archived` | `archived_at` | Movido al historial |

**❌ NUNCA USAR:** `done`, `finished`, `completed`, `closed`
**✅ SIEMPRE USAR:** `implemented`

**❌ NUNCA USAR:** `done_at`, `finished_at`, `completed_at`
**✅ SIEMPRE USAR:** `implemented_at`

### Para ADR

| Status | Significado |
|-------|-------------|
| `active` | Decisión vigente |
| `superseded` | Reemplazada por otro ADR |
| `deprecated` | Ya no aplica |

**❌ NUNCA USAR:** `done`, `approved`, `accepted`
**✅ SIEMPRE USAR:** `active`

---

## Cómo crear cada tipo

### Domain

**Opción 1: Proyecto nuevo** → Usar `spec init` durante la inicialización

**Opción 2: Proyecto existente** → Crear archivo manualmente en `.project-spec/domains/DOMAIN-<nombre>.yaml`

⚠️ **NUNCA** usar `spec init -f` en proyecto existente — sobrescribe todo

### Change Request

1. Invocar skill `spec-cli` para ver qué IDs existen
2. Crear archivo con siguiente ID: `.project-spec/changes/CR-XXX.yaml`

### ADR

1. Invocar skill `spec-cli` para ver qué IDs existen
2. Crear archivo con siguiente ID: `.project-spec/decisions/ADR-XXX.yaml`

---

## Tipos de CR

| Tipo | Indicador | Preguntas clave |
|------|-----------|-----------------|
| **Feature** | "agregar", "nuevo", "implementar" | Flujo completo, entidades, APIs |
| **Refactor** | "mejorar", "cambiar", "reestructurar" | Por qué, qué gano, qué pierdo |
| **Fix** | "arreglar", "corregir", "bug" | Reproducción, impacto, solución |
| **Removal** | "eliminar", "sacar", "deprecar" | Migración, backwards compat |

---

## ¿Este CR necesita un ADR?

Antes de crear un CR, evaluá:

1. **¿La implementación involucra una decisión arquitectónica?**
   - Si hay elección entre alternativas → Crear ADR primero
   - El CR referencia el ADR en `affects_decision: [ADR-XXX]`

2. **¿El usuario mencionó trade-offs o alternativas?**
   - Si hay "entre X e Y" o "en lugar de X" → Crear ADR

3. **¿Es solo implementación sin decisiones?**
   - Si no hay alternativas ni trade-offs → Solo CR

---

## Cuándo crear un ADR (Architecture Decision Record)

### Triggers explícitos

El usuario dice frases como:
- "decidimos usar X"
- "vamos a implementar X en lugar de Y"
- "la arquitectura va a ser X"
- "elegimos X por Y razón"

### Triggers implícitos (detectar automáticamente)

| Si el usuario menciona... | Es una decisión si... | Crear ADR |
|---------------------------|----------------------|-----------|
| "entre X e Y" | Hay dos o más opciones | Sí |
| "trade-off" | Hay ventajas y desventajas | Sí |
| "porque escala mejor" | Hay razonamiento técnico | Sí |
| "mejor performance que X" | Hay comparación | Sí |
| "más simple que X" | Hay alternativas consideradas | Sí |
| "problema con X" | Hay contexto de restricción | Sí |
| "no podemos usar X porque" | Hay rechazo de alternativa | Sí |
| "delay aceptable de Xms" | Hay trade-off de tiempo vs capacidad | Sí |
| "en lugar de X" | Hay elección consciente | Sí |

### Preguntas para detectar decisiones

Durante el interview, si identificás:
- **Elección entre opciones** → ADR
- **Trade-off aceptado** → ADR
- **Restricción técnica** → ADR
- **Cambio de arquitectura existente** → ADR
- **Solo implementación** → Solo CR

### Ejemplos concretos

| Contexto | ¿ADR? | Por qué |
|----------|-------|---------|
| "Vamos a usar PostgreSQL" | Sí | Elección de tecnología |
| "Batching con 100ms de delay" | Sí | Trade-off (delay vs performance) |
| "REST en lugar de GraphQL" | Sí | Decisión arquitectónica con alternativa rechazada |
| "Crear endpoint POST /users" | No | Solo implementación, sin elección |
| "Arreglar bug de validación" | No | No es decisión arquitectónica |
| "Usar Redis para cache" | Sí | Elección de tecnología |
| "Logs en batches de 100" | Sí | Trade-off (delay vs throughput) |
| "Migrar de JWT a sessions" | Sí | Cambio de arquitectura con alternativas |
| "Agregar campo al schema" | No | Solo cambio de datos |

---

## Flujo: ¿CR o ADR o ambos?

```
¿Hay elección entre alternativas?
    ↓ Sí
¿La elección afecta la arquitectura general?
    ↓ Sí
→ Crear ADR + CR (el CR implementa el ADR)

¿Hay elección pero es solo implementación?
    ↓ Sí
→ Solo CR (mencionar la decisión en description)

¿No hay elección, solo implementar?
    ↓
→ Solo CR
```

---

## Ejemplo: Batching en NotifyGateway

**Hubo estas decisiones:**
1. ¿Batching o no batching? → **Decisión: Sí batching** → ADR
2. ¿Qué intervalo? → **Decisión: 100ms** → Parte del ADR
3. ¿Qué payload? → **Decisión: Logs pequeños ~100 chars** → Parte del ADR
4. ¿Cómo implementar? → **Implementación** → CR

**Debería haber creado:**
- ADR-001: "Batching para broadcasts de logs con intervalo de 100ms"
- CR-003: "Implementar batching en NotifyGateway" (que references ADR-001)

### Estructura del ADR para ese caso

```yaml
schema: adr/v1
id: ADR-001
status: active
decided_at: "2026-05-03"
authors: ["@taneralberto"]

context: |
  El NotifyGateway recibe ~8000 logs individuales cuando se envían SMS masivos.
  Cada log genera un mensaje WebSocket separado, sobrecargando el frontend.
  
  Restricciones:
  - El servicio externo no se puede modificar
  - Los clientes necesitan recibir todos los logs

decision: |
  Implementar batching con buffer de 100ms.
  
  - Acumular logs en un buffer
  - Enviar batches cada 100ms
  - Cada batch contiene ~100 logs

alternatives:
  - name: "Sin batching, cada log individual"
    rejected_because: "8000 mensajes sobrecargan el frontend"
  - name: "Batching con intervalo de 500ms"
    rejected_because: "Delay muy alto para feedback en tiempo real"
  - name: "Modificar el servicio externo"
    rejected_because: "No tenemos control sobre ese servicio"

consequences:
  positive:
    - "Reducción de ~100x en mensajes (8000 → 80 batches)"
    - "Frontend no se sobrecarga"
    - "Sin cambios en el servicio externo"
  negative:
    - "Logs llegan con delay de hasta 100ms"
    - "Frontend debe escuchar 'log-batch' en lugar de 'log'"

tags: [websocket, performance, batching, notify]
```

---

## Errores comunes a evitar

| Error | Correcto |
|-------|----------|
| Crear CR para cambio trivial | Clasificar primero: trivial no necesita CR |
| No crear CR para cambio significant | Clasificar primero: significant SIEMPRE necesita CR |
| Disculparse sin explicar razonamiento | Explicar POR QUÉ tomaste esa decisión |
| Cambiar de opinión porque te cuestionaron | Defender tu posición con argumentos |
| CR gigante con "todo" | Un CR = un cambio conceptual |
| Sin contexto histórico | Invocar skill `spec-cli` para consultar ADRs |
| Asumir domain | Invocar skill `spec-cli` para verificar |
| Ignorar constraints | Verificar restricciones |
| YAML sin comillas en @ | `owner: "@usuario"` |
| Query FTS5 con símbolos | Invocar skill `spec-cli` (sanitiza automáticamente) |
