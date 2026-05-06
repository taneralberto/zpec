---
description: Skill para operar el CLI spec. Usar cuando se necesite consultar estado, buscar contexto, validar, reconstruir índice, o visualizar el grafo. Incluye manejo de workspaces multi-proyecto.
---

## Comandos de referencia

```bash
# Descubrir proyectos
spec projects                     # Lista proyectos con .project-spec/

# Estado y contexto
spec status                       # En CWD con .project-spec
spec status --project frontend    # En proyecto específico
spec rebuild                      # Reconstruir índice
spec rebuild --project frontend   # Reconstruir en proyecto específico

# Búsquedas
spec query "<término>"            # Full-text search
spec query "proposed CRs"         # Por status
spec query "billing conflicts"    # Por domain
spec query "CR-001 dependencies"  # Relaciones
spec list crs                     # Lista CRs
spec list crs --project frontend  # CRs del frontend
spec list adrs                    # Lista ADRs
spec list domains                 # Lista domains

# Visualización de grafo
spec graph                        # Grafo completo (Mermaid)
spec graph core                   # Solo domain "core"
spec graph CR-001                 # Relaciones de un CR específico
spec graph --format dot           # Output en Graphviz DOT
spec graph --project frontend    # Grafo del frontend

# Validación con conflict detection
spec validate                     # Todos los archivos
spec validate CR-XXX              # CR específico + conflictos
spec validate --project frontend # Validar en proyecto específico

# Agregar elementos
spec add domain billing           # Nuevo domain
spec add domain auth --project frontend  # Domain en proyecto específico

# Hooks
spec hooks status
spec hooks install
```

---

## ⚠️ Resolución de proyecto en workspaces

**Si estás en un workspace con múltiples proyectos**, cada uno con su propio `.project-spec/`, DEBES operar en el proyecto correcto.

### Cómo saber en qué proyecto trabajar

1. **El usuario menciona el proyecto** → "en el frontend", "en el backend" → Usá `--project <path>`
2. **No estás seguro** → Ejecutá `spec projects` para ver los proyectos disponibles
3. **Solo hay un proyecto** → El CLI lo detecta automáticamente

### Flujo obligatorio en workspaces

```
Usuario: "Necesito crear un módulo en el frontend"

1. Verificá qué proyectos existen:
   spec projects

2. Operá en el proyecto correcto:
   spec status --project frontend
   spec list crs --project frontend
   spec rebuild --project frontend
   spec validate --project frontend CR-001
   spec add domain auth --project frontend
```

### Comandos con --project

**TODOS** los comandos que operan en un proyecto aceptan `--project <path>`:

| Comando | Con --project |
|---------|--------------|
| `spec status` | `spec status --project frontend` |
| `spec rebuild` | `spec rebuild --project frontend` |
| `spec validate` | `spec validate --project frontend` |
| `spec query "X"` | `spec query "X" --project frontend` |
| `spec list crs` | `spec list crs --project frontend` |
| `spec list adrs` | `spec list adrs --project frontend` |
| `spec list domains` | `spec list domains --project frontend` |
| `spec graph` | `spec graph --project frontend` |
| `spec add domain X` | `spec add domain X --project frontend` |

### Prioridad de resolución

El CLI resuelve el proyecto en este orden:

1. `--project <path>` explícito → Usa ese path
2. CWD tiene `.project-spec/` → Usa CWD
3. Busca en subdirectorios:
   - 1 proyecto → Lo usa automáticamente
   - Múltiples proyectos → **Error con instrucciones**
   - 0 proyectos → **Error con instrucciones**

### Al crear CRs y ADRs

**Si no estás en el directorio del proyecto**, usá `--project`:

```bash
# En workspace root, creando un CR para el frontend
spec add domain billing --project frontend

# Luego creá el archivo YAML directamente en el path correcto
# frontend/.project-spec/changes/CR-001.yaml
```

**CRs y ADRs son independientes por proyecto.** No hay referencias cross-proyecto.

---

## Conflict Detection

Al validar un CR específico, se detectan automáticamente:

| Tipo | Condición | Severidad |
|------|-----------|-----------|
| **Entity overlap** | 2+ entidades compartidas | Warning |
| **File overlap** | 2+ archivos compartidos | Warning |
| **API overlap** | Cualquier API compartida | Warning |
| **Dependency status** | depends_on con status inválido | Warning |

**Status válidos para dependencias:** approved, implementing, done  
**Status inválidos:** proposed, rejected, blocked

---

## Output de graph

El comando `spec graph` genera:
- **Mermaid** (default): Renderiza en GitHub, Notion, Obsidian
- **DOT**: Para Graphviz (`dot -Tpng graph.dot > graph.png`)

Siempre a stdout, redirigir a archivo si se necesita guardar.

---

## Búsqueda Full-Text

`spec query` busca en **CRs y ADRs**:

```bash
spec query "JWT"           # Encuentra ADR-002 (decisión sobre JWT)
spec query "PostgreSQL"    # Encuentra ADR-001 (decisión de BD)
spec query "factura"       # Encuentra CRs relacionados
```

Los resultados muestran el tipo `[CR]` o `[ADR]` para distinguir.

---

## Índice desactualizado

Los comandos `spec status`, `spec query` y `spec graph` detectan automáticamente si el índice está desactualizado:

```
⚠ El índice está desactualizado
2 archivo(s) sin indexar:
  - .project-spec/changes/CR-005.yaml
  - .project-spec/decisions/ADR-003.yaml

Ejecutá 'spec rebuild' para actualizar el índice
```

Esto ocurre cuando:
- Se crearon nuevos archivos YAML después del último rebuild
- Se modificaron archivos YAML existentes
- El índice no existe (primera vez)

---

## Importante

- El archivo YAML es el **source of truth**
- El índice SQLite (`graph.db`) es derivado, no se commitea
- Siempre `spec validate` antes de commit
- Siempre `spec rebuild` después de cambios
