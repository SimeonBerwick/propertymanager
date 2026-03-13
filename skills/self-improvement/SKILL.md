---
name: self-improvement
description: "Captures learnings, errors, and corrections to enable continuous improvement. Use when: (1) A command or operation fails unexpectedly, (2) The user corrects the agent, (3) The user requests a capability that doesn't exist, (4) An external API or tool fails, (5) The agent realizes its knowledge is outdated or incorrect, (6) A better approach is discovered for a recurring task. Also review learnings before major tasks."
---

# Self-Improvement Skill

Log learnings and errors to markdown files for continuous improvement. Coding agents can later process these into fixes, and important learnings get promoted to project memory.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Command/operation fails | Log to `.learnings/ERRORS.md` |
| User corrects you | Log to `.learnings/LEARNINGS.md` with category `correction` |
| User wants missing feature | Log to `.learnings/FEATURE_REQUESTS.md` |
| API/external tool fails | Log to `.learnings/ERRORS.md` with integration details |
| Knowledge was outdated | Log to `.learnings/LEARNINGS.md` with category `knowledge_gap` |
| Found better approach | Log to `.learnings/LEARNINGS.md` with category `best_practice` |
| Simplify/Harden recurring patterns | Log/update `.learnings/LEARNINGS.md` with `Source: simplify-and-harden` and a stable `Pattern-Key` |
| Similar to existing entry | Link with `**See Also**`, consider priority bump |
| Broadly applicable learning | Promote to `CLAUDE.md`, `AGENTS.md`, and/or `.github/copilot-instructions.md` |
| Workflow improvements | Promote to `AGENTS.md` (OpenClaw workspace) |
| Tool gotchas | Promote to `TOOLS.md` (OpenClaw workspace) |
| Behavioral patterns | Promote to `SOUL.md` (OpenClaw workspace) |

## OpenClaw Setup (Recommended)

OpenClaw is the primary platform for this skill. It uses workspace-based prompt injection with automatic skill loading.

### Workspace Structure

```text
~/.openclaw/workspace/
├── AGENTS.md
├── SOUL.md
├── TOOLS.md
├── MEMORY.md
├── memory/
│   └── YYYY-MM-DD.md
└── .learnings/
    ├── LEARNINGS.md
    ├── ERRORS.md
    └── FEATURE_REQUESTS.md
```

### Create Learning Files

Create `.learnings/` in the workspace and maintain:
- `LEARNINGS.md` — corrections, knowledge gaps, best practices
- `ERRORS.md` — command failures, exceptions
- `FEATURE_REQUESTS.md` — user-requested capabilities

### Promotion Targets

| Learning Type | Promote To | Example |
|---------------|------------|---------|
| Behavioral patterns | `SOUL.md` | Be concise, avoid disclaimers |
| Workflow improvements | `AGENTS.md` | Spawn sub-agents for long tasks |
| Tool gotchas | `TOOLS.md` | Git push needs auth configured first |

### Inter-Session Communication

OpenClaw tools that help share learnings across sessions:
- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

## Generic Setup (Other Agents)

Create `.learnings/` in the project and maintain the same three markdown logs.

## Logging Format

### Learning Entry

Append to `.learnings/LEARNINGS.md`:

```markdown
## [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
One-line description of what was learned

### Details
Full context: what happened, what was wrong, what's correct

### Suggested Action
Specific fix or improvement to make

### Metadata
- Source: conversation | error | user_feedback
- Related Files: path/to/file.ext
- Tags: tag1, tag2
- See Also: LRN-20250110-001
- Pattern-Key: simplify.dead_code | harden.input_validation
- Recurrence-Count: 1
- First-Seen: 2025-01-15
- Last-Seen: 2025-01-15

---
```

### Error Entry

Append to `.learnings/ERRORS.md`:

```markdown
## [ERR-YYYYMMDD-XXX] skill_or_command_name

**Logged**: ISO-8601 timestamp
**Priority**: high
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Summary
Brief description of what failed

### Error
```
Actual error message or output
```

### Context
- Command/operation attempted
- Input or parameters used
- Environment details if relevant

### Suggested Fix
If identifiable, what might resolve this

### Metadata
- Reproducible: yes | no | unknown
- Related Files: path/to/file.ext
- See Also: ERR-20250110-001

---
```

### Feature Request Entry

Append to `.learnings/FEATURE_REQUESTS.md`:

```markdown
## [FEAT-YYYYMMDD-XXX] capability_name

**Logged**: ISO-8601 timestamp
**Priority**: medium
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config

### Requested Capability
What the user wanted to do

### User Context
Why they needed it, what problem they're solving

### Complexity Estimate
simple | medium | complex

### Suggested Implementation
How this could be built, what it might extend

### Metadata
- Frequency: first_time | recurring
- Related Features: existing_feature_name

---
```

## ID Generation

Format: `TYPE-YYYYMMDD-XXX`
- `LRN` — learning
- `ERR` — error
- `FEAT` — feature

## Resolving Entries

When fixed:
1. Update `**Status**`
2. Add a resolution block with date, commit/PR, and notes.

Other status values:
- `in_progress`
- `wont_fix`
- `promoted`

## Promoting to Project Memory

Promote durable, broadly applicable learnings to:
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `SOUL.md`
- `TOOLS.md`

Write promoted rules as concise prevention rules, not long postmortems.

## Recurring Pattern Detection

For similar issues:
1. Search `.learnings/`
2. Link related entries with `See Also`
3. Raise priority if recurring
4. Consider a systemic fix

## Simplify & Harden Feed

Ingestion workflow for `simplify_and_harden.learning_loop.candidates`:
1. Read the candidates from the task summary.
2. Use `pattern_key` as the stable dedupe key.
3. Search `.learnings/LEARNINGS.md` with:
   - `grep -n "Pattern-Key: <pattern_key>" .learnings/LEARNINGS.md`
4. If found:
   - increment `Recurrence-Count`
   - update `Last-Seen`
   - add `See Also` links to related entries/tasks
5. If not found:
   - create a new `LRN-...` entry
   - set `Source: simplify-and-harden`
   - set `Pattern-Key`
   - set `Recurrence-Count: 1`
   - set `First-Seen` and `Last-Seen`

Promote recurring patterns into agent guidance when all are true:
- `Recurrence-Count >= 3`
- seen across at least 2 tasks
- occurred within 30 days

## Periodic Review

Review `.learnings/`:
- before major tasks
- after features
- when revisiting an area with past learnings
- weekly during active development

## Detection Triggers

Log automatically when you notice:
- corrections
- feature requests
- knowledge gaps
- command/tool/API errors

## Priority Guidelines

| Priority | When to Use |
|----------|-------------|
| critical | Blocks core functionality, data loss risk, security issue |
| high | Significant impact, affects common workflows, recurring issue |
| medium | Moderate impact, workaround exists |
| low | Minor inconvenience, edge case, nice-to-have |

## Best Practices

1. Log immediately
2. Be specific
3. Include reproduction steps
4. Link related files
5. Suggest concrete fixes
6. Use consistent categories
7. Promote aggressively when durable
8. Review regularly

## Automatic Skill Extraction

When a learning becomes reusable, extract it into a skill when it is recurring, verified, broadly applicable, or user-flagged.

## Multi-Agent Support

This skill works across:
- Claude Code
- Codex CLI
- GitHub Copilot
- OpenClaw

Regardless of agent, use it when you discover something non-obvious, correct yourself, learn project conventions, hit unexpected errors, or find a better recurring approach.
