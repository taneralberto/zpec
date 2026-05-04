# Roadmap de Implementación

---

## Fase 1: Foundation (2-3 semanas)

### Semana 1: Core CLI

```bash
spec init          # Inicializar estructura
spec validate      # Validar schemas YAML
spec rebuild       # Reconstruir índice
```

**Entregables:**
- [ ] Estructura de directorios `.project-spec/`
- [ ] Schemas YAML (CR, ADR, Constraint, Domain)
- [ ] CLI básico con `commander` o `oclif`
- [ ] Validación de schemas con `zod` o `yaml-validator`
- [ ] Tests unitarios >80% coverage

**Tech:**
- TypeScript (strict mode)
- Node.js 20+
- Zod para validación
- Vitest para tests

---

### Semana 2: SQLite Index

```bash
spec rebuild       # Parsear YAMLs y poblar DB
spec query         # Queries básicas
```

**Entregables:**
- [ ] Esquema de base de datos SQLite
- [ ] Parser YAML → SQLite
- [ ] Índices para queries eficientes
- [ ] FTS5 para búsqueda full-text
- [ ] Tests de integración

**Schema SQLite:**
```sql
CREATE TABLE changes (...)
CREATE TABLE decisions (...)
CREATE TABLE change_affects (...)
CREATE TABLE change_relationships (...)
CREATE VIRTUAL TABLE changes_fts USING fts5(...)
```

---

### Semana 3: Git Hooks

```bash
spec post-merge    # Hook de git
spec pre-commit    # Validación antes de commit
```

**Entregables:**
- [ ] Hook post-merge para rebuild
- [ ] Hook pre-commit para validación
- [ ] Documentación de setup
- [ ] Tests de integración con git

---

## Fase 2: AI Layer (3-4 semanas)

### Semana 4-5: Requirement Interview

```bash
spec propose "<descripcion>"
```

**Entregables:**
- [ ] Integración con OpenRouter API
- [ ] Prompt engineering para parsing
- [ ] Sistema de preguntas dinámicas
- [ ] Generación de CR desde interview
- [ ] Manejo de context window

**Flujo:**
```
User input → Parse → Detect ambiguity → Generate questions → Compile to YAML
```

---

### Semana 6: Conflict Detection

```bash
spec validate CR-104  # Detecta conflictos con CRs existentes
```

**Entregables:**
- [x] Algoritmo de relevance scoring (overlap de entidades, archivos, APIs)
- [x] Comparación de CRs (2+ entidades o archivos = conflicto significativo)
- [x] Detección de dependencias con status inválido
- [x] Sugerencias de resolución (warnings, no bloquea)

**Algoritmo implementado:**
```typescript
function detectConflicts(newCr, db): Conflict[] {
  const conflicts = [];
  
  // Overlap de entidades (2+ entidades compartidas)
  conflicts.push(...detectEntityOverlap(newCr, db));
  
  // Overlap de archivos (2+ patterns compartidos)
  conflicts.push(...detectFileOverlap(newCr, db));
  
  // Overlap de APIs (cualquier API compartida)
  conflicts.push(...detectApiOverlap(newCr, db));
  
  // Validación de dependencias
  conflicts.push(...validateDependencyStatus(newCr, db));
  
  return conflicts;
}
```

**Tests:** 10 tests dedicados, 40 tests totales.

---

### Semana 7: Gap Analysis

```bash
spec sync CR-104  # Compara spec vs implementación
```

**Entregables:**
- [ ] Parser de código con Tree-sitter
- [ ] Comparación spec vs código
- [ ] Detección de gaps y scope creep
- [ ] Sugerencias de reconciliación

---

## Fase 3: Graph & Queries (2-3 semanas)

### Semana 8: Graph Queries

```bash
spec query "billing conflicts"
spec graph billing --format mermaid
```

**Entregables:**
- [x] Queries predefinidas (status, domain, entity, related)
- [x] Generación de grafos visuales
- [x] Export a Mermaid (default) y DOT (Graphviz)
- [x] Subgraphs por domain (agrupa CRs por bounded context)
- [ ] Saved queries en YAML

**Tests:** 14 tests para graph, 54 tests totales.

---

### Semana 9: Temporal Queries

```bash
spec query "why JWT auth?"
spec query "timeline for billing decisions"
```

**Entregables:**
- [ ] Índices temporales
- [ ] Queries de historial
- [ ] Reconstrucción de contexto histórico

---

## Fase 4: MCP Integration (2 semanas)

### Semana 10-11: MCP Server

```bash
spec mcp serve
```

**Entregables:**
- [ ] MCP server implementation
- [ ] Tools: analyze_proposal, detect_conflicts, temporal_query, reconcile
- [ ] Integration con Claude/Cline
- [ ] Documentación MCP

**Tools MCP:**
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

---

## Fase 5: Polish & Docs (1-2 semanas)

### Semana 12: Documentation

**Entregables:**
- [ ] README completo
- [ ] Guías de uso
- [ ] Ejemplos
- [ ] ADRs del sistema mismo
- [ ] Changelog

---

## Timeline Total: 10-12 semanas

```
Mes 1: Foundation
├── Semana 1: CLI Core
├── Semana 2: SQLite
└── Semana 3: Git Hooks

Mes 2: AI Layer
├── Semana 4-5: Interview
├── Semana 6: Conflicts
└── Semana 7: Gap Analysis

Mes 3: Graph + MCP
├── Semana 8-9: Graph Queries
├── Semana 10-11: MCP Server
└── Semana 12: Docs
```

---

## MVP (4 semanas)

Si hay presión de tiempo, el MVP sería:

```bash
spec init
spec propose      # Sin interview AI, solo genera template
spec validate     # Solo schema validation
spec rebuild
spec query        # Queries básicas
```

Sin:
- AI interview
- Conflict detection automático
- Gap analysis
- MCP server

---

## Tech Stack Final

```yaml
runtime: Node.js 20+
language: TypeScript (strict)
cli_framework: oclif | commander
validation: Zod
database: better-sqlite3
yaml_parser: yaml | js-yaml
ai_api: OpenRouter
code_parser: tree-sitter
test: Vitest
mcp_sdk: @modelcontextprotocol/sdk
build: tsup | esbuild
package: npm | pnpm
```

---

## Decisiones pendientes

1. **CLI framework**: `oclif` (más features) vs `commander` (más simple)
2. **Package manager**: `npm` (estándar) vs `pnpm` (más rápido)
3. **AI provider**: Empezar con OpenRouter o directo con Anthropic/OpenAI
4. **Graph visualization**: Mermaid (simple) vs D3 (complejo)
5. **MCP transport**: stdio (simple) vs HTTP (más flexible)

---

## Primer PR (Week 1)

```txt
feat: implement spec init and basic validation

- Add .project-spec/ directory structure
- Add YAML schemas for CR, ADR, Constraint, Domain
- Implement 'spec init' command
- Implement 'spec validate' command
- Add unit tests with >80% coverage
- Add README with basic usage
```
