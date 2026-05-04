# Skill Registry - Ztructure Project

Este archivo registra los skills disponibles para este proyecto.

## Project Skills

| Skill | Description | Location |
|-------|-------------|----------|
| `ztructure` | Sistema operativo AI-native para evolución de software. Gestiona CRs, ADRs, constraints y domains usando el CLI `spec`. | [skills/ztructure/SKILL.md](../skills/ztructure/SKILL.md) |

## Trigger Contexts

El agente debe cargar automáticamente el skill `ztructure` cuando:

- El usuario menciona: CR, ADR, spec, change request, architectural decision
- El usuario quiere proponer un cambio en el proyecto
- El usuario pregunta por decisiones pasadas o "por qué se hizo X"
- Al comenzar a trabajar en el proyecto (verificar con `spec status`)

## Usage

```bash
# Verificar estado del proyecto
spec status

# Crear un nuevo CR
# 1. spec list domains
# 2. spec query "<términos relacionados>"
# 3. Crear .project-spec/changes/CR-XXX.yaml
# 4. spec validate && spec rebuild

# Buscar contexto histórico
spec query "billing"
```

## Installation

Para instalar el skill globalmente (disponible en todos los proyectos):

```bash
cp -r skills/ztructure ~/.config/opencode/skills/
```

Luego agregar a `~/.config/opencode/AGENTS.md`:

```markdown
| Context | Skill to load |
| ------- | ------------- |
| CR, ADR, spec, change request, architectural decision | ztructure |
```
