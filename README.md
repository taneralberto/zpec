# Ztructure

**Sistema operativo AI-native para evolución de software.**

---

## El problema

El código se guarda en git. Las decisiones se pierden en Slack, Jira, Notion, reuniones.

¿El resultado?

- **Historia incompleta**: No sabés por qué se decidió X
- **Contexto perdido**: Cuando alguien se va, se va el conocimiento
- **Repeticiones**: Se discuten las mismas cosas cada 6 meses
- **Inconsistencias**: Decisiones contradictorias se acumulan

---

## La propuesta

Ztructure captura el **reasoning arquitectónico** durante el proceso de cambio, no después.

```
Idea vaga
    ↓
Interview (AI reduce ambigüedad)
    ↓
Semantic structuring (YAML canonical)
    ↓
Validation (contra arquitectura existente)
    ↓
Approval (snapshot semántico)
    ↓
Planning
    ↓
Implementation
    ↓
Reconciliation (comparar spec vs implementación)
    ↓
Architectural memory update
```

---

## Instalación

```bash
# Instalar globalmente
npm install -g ztructure

# O usar con npx
npx ztructure init
```

### Configurar con OpenCode

1. Instalar el skill de Ztructure:

```bash
# Copiar el skill a tu configuración de OpenCode
cp -r skills/ztructure ~/.config/opencode/skills/
```

2. Agregar a `~/.config/opencode/AGENTS.md`:

```markdown
| Context | Skill to load |
| ------- | ------------- |
| CR, ADR, spec, change request, architectural decision | ztructure |
```

3. El agente ahora puede usar los comandos `spec` automáticamente.

---

## Uso

### CLI directo

```bash
# Inicializar proyecto
spec init --domain billing --domain auth

# Verificar estado
spec status

# Validar archivos
spec validate

# Reconstruir índice
spec rebuild

# Listar CRs
spec list crs

# Buscar
spec query "authentication"
```

### Con OpenCode (recomendado)

Abrí el proyecto en OpenCode y simplemente hablá en lenguaje natural:

```
Usuario: "Quiero agregar soporte para credit notes en billing"

Agente: 
→ Ejecuta `spec status`
→ Ejecuta `spec list domains`
→ Ejecuta `spec query billing`
→ Te hace preguntas de clarificación
→ Crea el CR con `spec_create_cr`
→ Valida y rebuild
```

El agente tiene acceso a todas las herramientas:
- `spec_status` - Estado del grafo
- `spec_validate` - Validar archivos
- `spec_rebuild` - Reconstruir índice
- `spec_list_changes` - Listar CRs
- `spec_list_decisions` - Listar ADRs
- `spec_list_domains` - Listar domains
- `spec_query` - Búsqueda full-text
- `spec_get_cr` - Obtener CR específico
- `spec_create_cr` - Crear nuevo CR
- `spec_create_adr` - Crear nuevo ADR
- `spec_create_domain` - Crear domain
- `spec_update_cr_status` - Actualizar estado de CR

---

## Principios de diseño

### 1. YAML canonical, Markdown compiled

Los archivos `.yaml` son el source of truth. El `.md` es output para humanos.

```yaml
# CR-104.yaml (source)
schema: cr/v1
id: CR-104
domain: billing
summary: "Agregar credit notes"
affects:
  entities: [invoices, taxes]
```

### 2. Unidades semánticas pequeñas

No "features gigantes", sino **changes atómicos**.

```
CR-104.yaml  ← una unidad de cambio
CR-105.yaml  ← otra unidad
```

Relaciones: `depends_on`, `affects`, `conflicts_with`, `supersedes`.

### 3. Graph-first, Agent as interface

El **grafo semántico** es el sistema. El agent es solo una interfaz para interactuar con él.

```
Semantic Graph (el sistema real)
    │
    ├── domains/ (bounded contexts)
    ├── changes/ (units of change)
    ├── decisions/ (ADRs)
    ├── constraints/ (hard limits)
    └── relationships/ (edges)
```

### 4. Gradual engagement

El sistema se involucra MÁS cuando:
- El impacto es mayor
- La ambigüedad es mayor
- Los riesgos son mayores

Para un simple typo fix? Ni se entera.

---

## Arquitectura en dos capas

```
┌─────────────────────────────────────┐
│  AI Layer (Agent externo)           │
│  - OpenCode, Cline, Claude Desktop  │
│  - Entiende lenguaje natural        │
│  - Hace preguntas                   │
│  - Usa herramientas spec            │
└─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────┐
│  Core Layer (este CLI)              │
│  - Schema validation (Zod)          │
│  - Graph storage (SQLite)           │
│  - FTS5 full-text search            │
│  - Git hooks                        │
└─────────────────────────────────────┘
```

---

## Estructura del proyecto

```
.project-spec/
├── config.yaml          # Configuración del proyecto
├── changes/             # Change Requests (CRs)
│   ├── CR-001.yaml
│   └── CR-002.yaml
├── decisions/           # Architecture Decision Records
│   ├── ADR-001.yaml
│   └── ADR-002.yaml
├── constraints/         # Restricciones del sistema
├── domains/             # Bounded contexts
│   ├── DOMAIN-billing.yaml
│   └── DOMAIN-auth.yaml
├── queries/             # Saved queries
└── graph.db             # Índice SQLite (no commitear)
```

---

## Git Hooks

```bash
# Instalar hooks
spec hooks install

# Verificar estado
spec hooks status
```

Hooks instalados:
- **post-merge**: Ejecuta `spec rebuild` después de `git pull`
- **pre-commit**: Ejecuta `spec validate` antes de cada commit

---

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `spec init` | Inicializar estructura |
| `spec validate` | Validar archivos YAML |
| `spec rebuild` | Reconstruir índice |
| `spec status` | Estado del grafo |
| `spec list [type]` | Listar CRs, ADRs, domains |
| `spec query <query>` | Búsqueda full-text |
| `spec hooks install` | Instalar hooks de git |

---

## Diferencia con herramientas existentes

| Herramienta | Enfoque | Problema |
|-------------|---------|----------|
| adr-tools | Documentar después | Ya perdiste el contexto |
| Notion/Confluence | Prose sin estructura | No hay queries, relaciones |
| MCP ADR Analysis | Analizar código existente | No hay workflow de evolución |
| **Ztructure** | Capturar durante el cambio | Preserva reasoning en tiempo real |

---

## Estado de implementación

| Fase | Descripción | Estado |
|------|-------------|--------|
| Foundation | CLI, schemas, SQLite, hooks | ✅ Completado |
| AI Layer | Skill para OpenCode | ✅ Completado |
| Graph Queries | Queries avanzadas, temporal | 🔜 Pendiente |
| Conflict Detection | Detectar contradicciones | 🔜 Pendiente |
| Reconciliation | Spec vs implementación | 🔜 Pendiente |

---

## Filosofía

> **CONCEPTS > CODE**: Entender el problema antes de escribir soluciones.
>
> **AI IS A TOOL**: El humano dirige, AI ejecuta.
>
> **SOLID FOUNDATIONS**: Patterns, architecture, luego frameworks.
>
> **AGAINST IMMEDIACY**: No shortcuts. Aprender lleva tiempo.

---

## Licencia

MIT
