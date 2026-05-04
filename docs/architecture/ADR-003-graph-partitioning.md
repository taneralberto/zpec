# ADR-003: Graph Partitioning y Relevance

**Estado**: Proposed  
**Fecha**: 2025-05-02  
**Autor**: @tano

---

## Contexto

Detectar conflictos entre CRs requiere comparar el nuevo CR con los existentes. Pero comparar contra TODOS los CRs es O(n²), que no escala.

---

## Decisión

Usamos **graph partitioning** + **relevance scoring** para limitar las comparaciones.

---

## Dimensiones de particionamiento

### 1. Por Domain (bounded context)

```yaml
CR-104:
  domain: billing

# Solo se compara con otros CRs en billing
# → Reduce el espacio de búsqueda drásticamente
```

### 2. Por Entity (afectación)

```yaml
CR-104:
  affects: [invoices, taxes]

# Solo se compara con CRs que también afecten invoices o taxes
# → Cruza domains solo cuando es necesario
```

### 3. Por Temporal Window (recencia)

```yaml
CR-104:
  proposed_at: 2025-05-02

# Solo se compara con CRs propuestos en los últimos 6-12 meses
# → CRs muy viejos raramente son relevantes
```

### 4. Por Status

```yaml
# Solo se compara con CRs que estén:
# - approved
# - implemented
# - implementing

# No se compara con:
# - rejected
# - archived
```

---

## Algoritmo de relevance

```python
def get_relevant_crs(new_cr, all_crs):
    relevant = []
    
    for cr in all_crs:
        score = 0
        
        # Domain match (peso alto)
        if cr.domain == new_cr.domain:
            score += 10
        
        # Entity overlap (peso alto)
        entity_overlap = len(set(cr.affects) & set(new_cr.affects))
        score += entity_overlap * 5
        
        # Recency (peso medio)
        months_ago = (now - cr.proposed_at).months
        if months_ago <= 6:
            score += 5
        elif months_ago <= 12:
            score += 2
        
        # Status (filtro, no score)
        if cr.status not in [APPROVED, IMPLEMENTED, IMPLEMENTING]:
            continue
        
        if score > 0:
            relevant.append((cr, score))
    
    # Ordenar por score, tomar top N
    return sorted(relevant, key=lambda x: -x[1])[:20]
```

---

## Ejemplo práctico

```yaml
# CR-104: Agregar credit notes
change:
  id: CR-104
  domain: billing
  affects: [invoices, taxes, reports]
  proposed_at: 2025-05-02

# Sistema busca:
# 1. CRs en domain: billing → 10 CRs
# 2. Que afecten invoices OR taxes OR reports → 5 CRs
# 3. Con status: approved OR implemented → 4 CRs
# 4. En los últimos 6 meses → 3 CRs

# Resultado: Solo compara contra 3 CRs
# → CR-98: debit notes (relacionado)
# → CR-87: tax calculation (potencial conflicto)
# → CR-79: invoice numbering (dependencia)
```

---

## Límites configurables

```yaml
# .project-spec/config.yaml
relevance:
  max_comparisons: 20        # Máximo de CRs a comparar
  domain_weight: 10          # Peso del domain match
  entity_weight: 5           # Peso por entity overlap
  recency_bonus_6m: 5        # Bonus por <6 meses
  recency_bonus_12m: 2       # Bonus por <12 meses
  min_score: 5               # Score mínimo para considerar relevante
```

---

## Escalabilidad

| CRs en proyecto | CRs relevantes por query | Tiempo estimado |
|-----------------|--------------------------|-----------------|
| 100 | ~10 | <10ms |
| 500 | ~15 | <50ms |
| 1000 | ~20 | <100ms |
| 5000 | ~20 | <200ms |

El tiempo de query se mantiene acotado porque el relevamiento limita la búsqueda.

---

## Edge cases

### CR que afecta múltiples domains

```yaml
CR-150:
  domain: billing
  affects: [invoices]  # billing
  relationships:
    cross_domain:
      - domain: auth
        affects: [sessions]  # auth
```

Acá se compara contra CRs de billing Y auth.

### CR muy nuevo sin overlap

Si no hay CRs relevantes (score = 0), se compara contra los 10 más recientes del mismo domain por seguridad.

---

## Índices en SQLite

```sql
CREATE INDEX idx_cr_domain ON changes(domain);
CREATE INDEX idx_cr_status ON changes(status);
CREATE INDEX idx_cr_proposed ON changes(proposed_at DESC);
CREATE INDEX idx_cr_affects ON change_affects(entity);

-- Query optimizada
SELECT c.* FROM changes c
JOIN change_affects a ON c.id = a.change_id
WHERE c.domain = 'billing'
  AND a.entity IN ('invoices', 'taxes')
  AND c.status IN ('approved', 'implemented')
  AND c.proposed_at > date('now', '-6 months')
ORDER BY c.proposed_at DESC
LIMIT 20;
```

---

## Conclusión

El graph partitioning + relevance scoring permite escalar el sistema sin que la detección de conflictos se vuelva prohibitiva.
