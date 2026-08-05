# Navigator Documentation — Life Skill Tracker

**Project**: life-skill-tracker  
**Tech Stack**: Documentation, Markdown  
**Initialized**: 2026-08-04

## Overview

This is the Navigator documentation structure for the Life Skill Tracker project. Navigator helps you manage implementation plans, track tasks, document system architecture, and maintain standard operating procedures.

## Directory Structure

```
.agent/
├── DEVELOPMENT-README.md    This file — project overview
├── .nav-config.json         Navigator configuration
├── tasks/                   Implementation plans and task tracking
├── system/                  Architecture and system documentation
├── sops/                    Standard Operating Procedures
│   ├── integrations/        Integration procedures
│   ├── debugging/           Debugging guides
│   ├── development/         Development workflows
│   └── deployment/          Deployment procedures
└── grafana/                 Metrics and monitoring dashboard
```

## Getting Started

### 1. Start a Navigator Session
To begin a new Navigator session with context injection and task tracking:
```bash
# Start session: "Start my Navigator session"
```

This will:
- Load the Navigator context (active markers, config, task graph)
- Set up task tracking
- Enable workflow enforcement
- Initialize token monitoring

### 2. Create Tasks
To create new implementation tasks:
```bash
# "Create task: [task description]"
```

Tasks are stored in `.agent/tasks/` and tracked in the Navigator graph.

### 3. Document System Architecture
Add architecture and design documentation to `.agent/system/`:
- System overview
- Component relationships
- Data flows
- Key design decisions

### 4. Write Standard Operating Procedures
Add SOPs to `.agent/sops/`:
- Development workflows
- Debugging procedures
- Integration guides
- Deployment checklists

### 5. Monitor Metrics (Optional)
Enable Grafana for metrics tracking:
```bash
cd .agent/grafana
docker compose up -d
# Visit http://localhost:3000 (default: admin/admin)
```

## Configuration

Edit `.agent/.nav-config.json` to customize:
- `project_name`: Project identifier
- `tech_stack`: Technologies used
- `task_prefix`: Prefix for task IDs (default: TASK)
- `compact_strategy`: How aggressively to compress context (conservative/balanced/aggressive)
- Hook settings: Enable/disable specific Navigator hooks

## Active Hooks

Navigator registers lifecycle hooks automatically (via plugin manifest). These are enabled by default and can be toggled in `.nav-config.json`:

- **SessionStart** — Injects Navigator context at session start
- **PreCompact** — Marks context before compression
- **PostCompact** — Records compression events
- **Stop** — Tracks workflow completion
- **UserPromptSubmit** — Enforces workflow rules
- **PreToolUse(Read)** — Guards against bulk reads
- **PostToolUse** — Monitors token usage and syncs graphs

⚠️ **Note**: Restart Claude Code after updating hook settings.

## Context Markers

Navigator creates context markers in `.context-markers/` (gitignored) to track:
- Session state
- Task progress
- Workflow checkpoints
- Metrics from previous sessions

These are used to provide continuity across sessions and are automatically cleaned up.

## Next Steps

1. **Check the PRD**: Review the product specification in `/docs` to understand project goals
2. **Explore existing docs**: Look at `level_weighting.md` and docs/ for context
3. **Create a task**: Start with "Create task: [first task]" to organize work
4. **Document architecture**: Add system design to `.agent/system/` as you work

## Resources

- **CLAUDE.md**: Project-level instructions and conventions
- **Git repository**: Check git log for recent decisions
- **Task list**: Run "List all tasks" to see in-progress work

## Support

If you need help:
- Check `.agent/sops/` for relevant procedures
- Read CLAUDE.md for project conventions
- Use "Show Navigator status" to see current workflow state

---

Created by Navigator initialization on 2026-08-04
