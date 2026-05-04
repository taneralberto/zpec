# ADR-001: Arquitectura General del Sistema

**Estado**: Proposed  
**Fecha**: 2025-05-02  
**Autor**: @tano

---

## Contexto

Necesitamos un sistema que preserve el reasoning arquitectónico de un proyecto de software a largo plazo. Las herramientas existentes documentan decisiones después de tomarlas, cuando el contexto ya se perdió.

---

## Decisión

Construiremos un sistema de dos capas:

### Capa 1: Core (estructural)

- Almacenamiento en archivos YAML (source of truth)
- SQLite como índice local (derivado, no commiteado)
- Validación de schemas
- Queries estructurales
- Diff computation

### Capa 2: AI (semántica)

- Parsing de lenguaje natural
- Requirement interview
- Conflict detection
- Gap analysis
- Reconciliation post-implementation

---

## Justificación

### ¿Por qué YAML como source of truth?

1. Git versiona texto plano nativamente
2. Diff y merge son posibles
3. PR review funciona
4. No requiere infraestructura
5. Human-readable

### ¿Por qué SQLite como índice?

1. Queries eficientes (O(1) vs O(n) en archivos)
2. Sin servidor, archivo local
3. Índices para relaciones
4. FTS5 para búsqueda full-text
5. Portable

### ¿Por qué no solo DB?

1. No hay diff/merge visible
2. No se puede hacer PR review
3. Conflictos binarios
4. Historial opaco

---

## Alternativas consideradas

### Solo archivos (sin DB)

- **Pro**: Simplicidad
- **Con**: Queries O(n), no escala con muchos CRs

### Solo DB (sin archivos)

- **Pro**: Queries eficientes
- **Con**: No hay versionado visible, no hay review

### Graph DB externa (Neo4j, etc.)

- **Pro**: Relaciones nativas
- **Con**: Requiere infraestructura, overhead para devs

---

## Consecuencias

### Positivas

- Git funciona como siempre
- Cada dev tiene índice local
- Queries rápidas
- Historial completo en YAML

### Negativas

- Hay que rebuild el índice al hacer pull
- Dos representaciones para mantener sincronizadas
- SQLite puede ser limitado para grafos complejos

### Mitigaciones

- Hook post-merge para rebuild automático
- El rebuild es O(n) donde n = cantidad de YAMLs
- SQLite con tablas de relaciones es suficiente para el caso de uso

---

## Límites del enfoque

### Escala

- Funciona bien hasta ~1000 CRs por proyecto
- Más allá, considerar particionar por domain

### Complejidad de relaciones

- Relaciones simples: SQLite alcanza
- Relaciones complejas con path queries: puede necesitar graph DB real en el futuro

---

## Referencias

- Patrón similar usado por: Prisma (schema.prisma → DB), EdgeDB, Fossil SCM
