# ADR-002: Unidades Semánticas Pequeñas

**Estado**: Proposed  
**Fecha**: 2025-05-02  
**Autor**: @tano

---

## Contexto

Las "features" tradicionales son unidades demasiado grandes y ambiguas. Una feature puede afectar múltiples domains, depender de decisiones pasadas, crear inconsistencias.

---

## Decisión

La unidad de cambio es el **Change Request (CR)**: una unidad semántica pequeña y atómica.

```yaml
# Ejemplo de CR
change:
  id: CR-104
  domain: billing
  summary: "Agregar credit notes para reversión de facturas"
  affects:
    - invoices
    - taxes
    - reports
  relationships:
    depends_on: [CR-98]
    affects_decision: [ADR-12]
  status: proposed
  proposed_at: 2025-05-02
  author: @tano
```

---

## Propiedades de un CR

### Atómico

Representa un único cambio conceptual, no una "feature gigante".

### Domain-bound

Pertenece a un bounded context específico.

### Relacionable

Puede tener relaciones con otros CRs y ADRs:
- `depends_on`: CRs que deben implementarse antes
- `affects`: entidades del sistema que modifica
- `contradicts`: CRs con los que entra en conflicto
- `supersedes`: CRs que reemplaza
- `affects_decision`: ADRs que impacta

### Versionable

Tiene status: `proposed` → `approved` → `planned` → `implementing` → `implemented` → `archived`

---

## Límites de cantidad

### ¿Cuántos CRs por domain?

```yaml
# Configuración recomendada
graph:
  max_domain_crs: 50        # Alertar si > 50
  archive_after_months: 12  # Archivar después de 12 meses implementado
  relevance_window: 6       # Solo comparar con CRs de últimos 6 meses
```

### ¿Por qué no infinito?

1. **Performance**: Conflict detection es O(n²) sin límites
2. **Utilidad**: CRs de hace 2 años raramente son relevantes
3. **Complejidad**: Más CRs activos = más superficie de conflicto

---

## Particionamiento

```txt
domains/
├── billing/
│   ├── active_crs: [CR-98, CR-104, CR-105]
│   ├── archived_crs: [CR-45, CR-67]
│   └── constraints: [...]
├── auth/
│   ├── active_crs: [CR-87, CR-91]
│   └── ...
└── reporting/
    └── ...
```

### Consultas por domain

```bash
spec query "billing conflicts"
# → Solo busca en domain: billing
# → O(d) donde d = CRs en billing
```

### Consultas por entity

```bash
spec query "what affects invoices?"
# → Solo busca CRs con affects: [invoices]
# → O(e) donde e = CRs que afectan esa entity
```

---

## Anti-patrones

### ❌ Feature gigante como un CR

```yaml
# MAL
change:
  id: CR-104
  summary: "Sistema completo de credit notes con reversión, impuestos, reportes, auditoría"
```

### ✅ Múltiples CRs relacionados

```yaml
# BIEN
CR-104: "Agregar entidad credit-note"
CR-105: "Implementar reversión de facturas"
CR-106: "Actualizar cálculo de impuestos"
CR-107: "Agregar reportes de credit notes"

# Con relaciones
CR-105:
  depends_on: [CR-104]
CR-106:
  depends_on: [CR-104, CR-105]
```

---

## Ventajas

1. **Review granular**: Cada CR se revisa por separado
2. **Conflict detection**: Más preciso con unidades pequeñas
3. **Rollback**: Podés revertir CRs específicos
4. **Tracking**: Sabés exactamente qué cambió y por qué

---

## Trade-offs

| Aspecto | Ventaja | Desventaja |
|---------|---------|------------|
| Granularidad | Control fino | Más archivos |
| Relaciones | Grafo explícito | Hay que mantenerlo |
| Review | Más fácil | Más PRs |

---

## Próximos pasos

1. Definir schema completo de CR
2. Implementar validación de relaciones
3. Crear herramienta de conflict detection
4. Documentar patrones de uso
