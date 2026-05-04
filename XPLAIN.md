# Ztructure - Explicación de Instalación y Estructura

## 1. Instalación del CLI

### Opción A: npm link (desarrollo local)

```bash
# Clonar el repositorio
git clone https://github.com/tu-org/ztructure.git
cd ztructure

# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Crear enlace global al CLI
npm link
```

Esto crea el comando `spec` disponible globalmente en tu sistema.

### Opción B: npm install -g (cuando esté publicado)

```bash
npm install -g ztructure
```

### Opción C: npx (sin instalación global)

```bash
npx ztructure init
```

---

## 2. Instalación del Agente para OpenCode

Una vez instalado el CLI, instalá el agente:

```bash
spec install
```

Esto copia:
- **Agente** → `~/.config/opencode/agents/ztructure.md`

El agente se activará automáticamente cuando:
- Propongas un cambio ("quiero agregar...", "necesito implementar...")
- Preguntes por decisiones ("¿por qué usamos...?")
- Menciones CRs, ADRs o specs

**Opciones:**
```bash
spec install --force   # Sobrescribir si ya existe
```

---

## 3. Inicialización del Proyecto

Una vez instalado el CLI, en cualquier proyecto:

```bash
# Crear la estructura con un domain inicial
spec init --domain core --domain auth

# O sin domains (se agregan después)
spec init

# Si ya existe y querés sobrescribir
spec init --force
```

**Esto crea:**

```
tu-proyecto/
└── .project-spec/
    ├── config.yaml          # Configuración del proyecto
    ├── .gitignore           # Ignora graph.db (índice derivado)
    ├── changes/             # Change Requests (CRs)
    │   └── (vacío inicialmente)
    ├── decisions/           # Architecture Decision Records (ADRs)
    │   └── (vacío inicialmente)
    ├── constraints/         # Restricciones del proyecto
    │   └── (vacío inicialmente)
    ├── domains/             # Bounded contexts
    │   ├── DOMAIN-core.yaml
    │   └── DOMAIN-auth.yaml
    └── queries/             # Queries guardadas
        └── (vacío inicialmente)
```

**NO crea `graph.db` todavía.** La base de datos SQLite se crea con `spec rebuild`.

---

## 3. Estructura de `.project-spec/`

### 3.1 `config.yaml` - Configuración del Proyecto

```yaml
schema: config/v1

project:
  name: mi-proyecto
  version: 1.0.0

stack:
  backend: typescript
  runtime: node

graph:
  max_domain_crs: 50        # Máx CRs activos por domain
  archive_after_months: 12  # Archivar CRs viejos
  relevance_window: 6       # Meses para calcular relevancia

relevance:
  domain_weight: 10         # Peso si mismo domain
  entity_weight: 5          # Peso si misma entidad
  recency_bonus_6m: 5       # Bonus si < 6 meses
  min_score: 5              # Score mínimo para sugerir

ai:
  provider: openrouter
  model: anthropic/claude-3-sonnet
  api_key_env: OPENROUTER_API_KEY

lint:
  enabled_rules:
    - require_domain
    - require_affects
    - check_conflicts
  fail_on_warning: false

hooks:
  post_merge: spec rebuild
  pre_commit: spec validate
```

**Propósito:** Configuración central del proyecto. Define stack, reglas de lint, pesos de relevancia.

---

### 3.2 `changes/` - Change Requests (CRs)

Cada archivo es un Change Request:

```yaml
# changes/CR-001.yaml

schema: cr/v1
id: CR-001
status: proposed              # proposed | approved | implementing | done | rejected | blocked

proposed_at: 2025-05-03
author: "@usuario"

domain: billing               # A qué bounded context pertenece
summary: "Credit notes para reversar facturas"
description: |
  Contexto completo del cambio.
  Por qué se hace, qué resuelve, qué trade-offs acepta.

affects:
  entities: [Invoice, CreditNote]
  files: [src/billing/*, src/invoices/*]
  apis: [POST /invoices/:id/credit]

relationships:
  depends_on: [CR-002]        # Este CR necesita que CR-002 vaya antes
  affects_decision: [ADR-003] # Impacta esta decisión arquitectónica

acceptance_criteria:
  - "Endpoint POST /invoices/:id/credit creado"
  - "Tests con >80% coverage"
  - "Documentación actualizada"
```

**Propósito:** Registrar cada cambio conceptual. Un CR = un cambio atómico.

**Ciclo de vida:**
```
proposed → approved → implementing → done
    ↓
rejected | blocked
```

---

### 3.3 `decisions/` - Architecture Decision Records (ADRs)

Cada archivo es una decisión arquitectónica:

```yaml
# decisions/ADR-001.yaml

schema: adr/v1
id: ADR-001
status: active                # active | superseded | deprecated

decided_at: 2025-03-14
authors: ["@usuario"]

context: |
  ¿Qué problema estábamos tratando de resolver?
  ¿Qué restricciones teníamos?

decision: |
  ¿Qué decidimos?
  Usar PostgreSQL como base de datos principal.

alternatives:
  - name: "MySQL"
    rejected_because: "Mejor soporte para JSON en PostgreSQL"
  - name: "MongoDB"
    rejected_because: "Necesitamos transacciones ACID"

consequences:
  positive:
    - "Queries complejas con JOINs"
    - "Transacciones ACID"
  negative:
    - "Requiere servidor dedicado"
    - "No escala horizontalmente tan fácil"

relationships:
  affects_crs: [CR-005, CR-012]
  related_adrs: [ADR-003]

tags: [database, postgresql, persistence]
```

**Propósito:** Capturar el **por qué** de las decisiones. No solo qué se decidió, sino qué alternativas se consideraron y por qué se rechazaron.

---

### 3.4 `domains/` - Bounded Contexts

Cada archivo define un bounded context:

```yaml
# domains/DOMAIN-billing.yaml

schema: domain/v1
id: DOMAIN-billing
name: "Billing"
bounded_context: billing

description: |
  Todo lo relacionado con facturación, pagos,
  y gestión de crédito.

entities:
  - Invoice
  - CreditNote
  - Payment
  - Refund

relations:
  - domain: auth
    via: [User]
  - domain: notifications
    via: [Invoice]

active_crs: [CR-002, CR-003]
archived_crs: [CR-001]

owner: "@usuario"
```

**Propósito:** Definir los bounded contexts del sistema. Cada domain agrupa entidades y CRs relacionados.

---

### 3.5 `constraints/` - Restricciones del Proyecto

Reglas que deben cumplirse:

```yaml
# constraints/CONST-001.yaml

schema: constraint/v1
id: CONST-001
name: "No ORMs pesados"
severity: high                # high | medium | low

description: |
  El proyecto no debe usar ORMs pesados como Hibernate o TypeORM.
  Preferimos query builders o SQL directo.

rationale: |
  Los ORMs pesados generan queries ineficientes y esconden
  la complejidad del acceso a datos.

applies_to:
  domains: [all]
  files: ["**/*.ts", "**/*.java"]
```

**Propósito:** Definir restricciones técnicas o de negocio que aplican a todos los cambios.

---

### 3.6 `queries/` - Queries Guardadas

Queries frecuentes que querés reutilizar:

```yaml
# queries/recent-billing.yaml

name: "Recent Billing Changes"
query: "domain:billing status:proposed"
created_at: 2025-05-03
```

**Propósito:** Guardar queries complejas para ejecutarlas después.

---

### 3.7 `graph.db` - Índice SQLite

**Este archivo NO se commitea.** Está en `.gitignore`.

**Se crea automáticamente cuando:**
- Ejecutás `spec rebuild`
- Ejecutás `spec status` (si no existe)
- Ejecutás `spec query` (si no existe)

**Contenido:**
- Tabla `changes`: CRs indexados
- Tabla `decisions`: ADRs indexados
- Tabla `domains`: Bounded contexts
- Tabla `constraints`: Restricciones
- Tabla `change_affects`: Relación CR → entidades
- Tabla `change_relationships`: Dependencias entre CRs
- Tablas FTS5: Para búsqueda full-text

**¿Por qué SQLite y no solo YAMLs?**
- YAMLs son el **source of truth** (se commitean)
- SQLite es un **índice derivado** para queries rápidas
- Cada desarrollador tiene su copia local
- Se regenera con `spec rebuild` o hooks de git

---

## 4. Flujo de Trabajo Típico

### Primer setup

```bash
# 1. Inicializar el proyecto
spec init --domain core --domain auth

# 2. Commit inicial
git add .project-spec/
git commit -m "spec: initialize project structure"

# 3. Instalar hooks (opcional pero recomendado)
spec hooks install

# 4. Crear el índice
spec rebuild
```

### Día a día

```bash
# Ver estado del grafo
spec status

# Buscar cambios relacionados
spec query "billing"
spec query "status:proposed"

# Ver visualización
spec graph

# Validar antes de commit
spec validate
```

### Después de pull/merge

```bash
# Los hooks se ejecutan automáticamente
# O manualmente:
spec rebuild
```

---

## 5. Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `spec install` | Instala el agente y skill para OpenCode |
| `spec init` | Crea la estructura `.project-spec/` |
| `spec add domain <nombre>` | Agrega un nuevo domain al proyecto |
| `spec rebuild` | Reconstruye el índice SQLite desde YAMLs |
| `spec status` | Muestra el estado actual del grafo |
| `spec validate [target]` | Valida YAMLs contra schemas |
| `spec query <query>` | Busca en CRs y ADRs |
| `spec list [type]` | Lista CRs, ADRs o domains |
| `spec graph [target]` | Genera visualización Mermaid/DOT |
| `spec hooks install` | Instala hooks de git |
| `spec hooks status` | Verifica estado de hooks |

---

## 6. Ejemplo Completo

```bash
# 1. Instalar el CLI (si no está instalado)
npm link  # desde el repo de ztructure

# 2. Instalar el agente para OpenCode
spec install

# 3. Crear proyecto de ejemplo
mkdir mi-app && cd mi-app
git init

# 4. Inicializar Ztructure
spec init --domain core

# Ver qué se creó
tree .project-spec/
# .project-spec/
# ├── config.yaml
# ├── .gitignore
# ├── changes/
# ├── decisions/
# ├── constraints/
# ├── domains/
# │   └── DOMAIN-core.yaml
# └── queries/

# Crear primer CR
cat > .project-spec/changes/CR-001.yaml << 'EOF'
schema: cr/v1
id: CR-001
status: proposed
proposed_at: 2025-05-03
author: "@yo"
domain: core
summary: "Setup inicial del proyecto"
description: "Configurar estructura base con TypeScript y Node.js"
affects:
  entities: [config]
  files: [src/*]
  apis: []
acceptance_criteria:
  - "package.json creado"
  - "tsconfig.json configurado"
EOF

# Crear primer ADR
cat > .project-spec/decisions/ADR-001.yaml << 'EOF'
schema: adr/v1
id: ADR-001
status: active
decided_at: 2025-05-03
authors: ["@yo"]
context: "Necesitamos elegir lenguaje y runtime para el backend"
decision: "Usaremos TypeScript con Node.js"
alternatives:
  - name: "Go"
    rejected_because: "El equipo tiene más experiencia en TypeScript"
consequences:
  positive: ["Tipado estático", "Ecosistema npm"]
  negative: ["Requiere build step"]
tags: [typescript, node, backend]
EOF

# Reconstruir índice
spec rebuild

# Ver estado
spec status
# ✓ Índice reconstruido:
#   Changes:     1
#   Decisions:   1
#   Domains:     1

# Buscar
spec query "TypeScript"
# [ADR] ADR-001  active  2025-05-03  Usaremos TypeScript con Node.js

# Ver grafo
spec graph
# Genera diagrama Mermaid

# Validar
spec validate
# ✓ 1 CR válido
# ✓ 1 ADR válido

# Commit
git add .project-spec/
git commit -m "spec: add initial CR and ADR"
```

---

## 7. Arquitectura: CLI + Agente

### ¿Cómo funciona?

```
┌─────────────────────────────────────────────────────────────┐
│                         OpenCode                             │
│                    (el que tiene la AI)                      │
│                                                              │
│   Lee archivos de:                                           │
│   ~/.config/opencode/agents/ztructure.md  ← Instrucciones   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ ejecuta comandos
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLI "spec"                              │
│              (instalado con npm link)                        │
│                                                              │
│   Comandos: init, validate, rebuild, query, graph, etc.      │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ lee/escribe
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    .project-spec/                            │
│                   (los YAMLs + SQLite)                       │
└─────────────────────────────────────────────────────────────┘
```

### El agente NO es código ejecutable

El agente es un **archivo de instrucciones** (markdown) que OpenCode lee. Contiene:

1. **Header YAML** que dice cuándo activarlo:
   ```yaml
   ---
   description: Gestiona CRs, ADRs y el grafo semántico...
   mode: primary
   ---
   ```

2. **Instrucciones** de comportamiento:
   - Qué hacer cuando el usuario propone un cambio
   - Qué preguntas hacer (interview)
   - Qué comandos ejecutar (`spec status`, `spec query`, etc.)

### ¿Dónde se instala?

```bash
spec install
# → ~/.config/opencode/agents/ztructure.md
```

OpenCode escanea automáticamente este directorio y carga los agentes.

---

## 8. Preguntas Frecuentes

### ¿Por qué `.project-spec/` y no `.spec/`?

Para que sea más explícito qué es. "spec" puede ser ambiguo, "project-spec" indica claramente que son especificaciones del proyecto.

### ¿Por qué SQLite si ya tengo YAMLs?

**YAMLs = source of truth** (se commitean, se versionan, se mergean)
**SQLite = índice derivado** (para queries rápidas, FTS5, joins)

Es como un índice de base de datos: los datos están en las tablas, el índice acelera las consultas.

### ¿Qué pasa si hay conflicto en `graph.db`?

No importa. `graph.db` no se commitea. Cada desarrollador tiene su copia local. Si hay conflictos en los YAMLs, se resuelven normalmente y después `spec rebuild`.

### ¿Puedo editar los YAMLs a mano?

Sí, es la forma recomendada. Los YAMLs son el source of truth. El CLI los lee y valida.

### ¿Cómo se integra con el Agent?

El Agent lee los YAMLs y usa el CLI para:
- Ver el estado actual (`spec status`)
- Buscar contexto (`spec query`)
- Validar cambios (`spec validate`)
- Ver relaciones (`spec graph`)

El Agent NO escribe directamente. Sugiere cambios y el usuario decide.

---

## 9. Siguientes Pasos

1. **Crear tu primer CR** en `changes/CR-001.yaml`
2. **Documentar decisiones** en `decisions/ADR-001.yaml`
3. **Instalar hooks** con `spec hooks install`
4. **Probar queries** con `spec query "término"`
5. **Ver el grafo** con `spec graph`
