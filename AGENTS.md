## ALWAYS RUN

Important: this list is separate from any others in the prompt. Follow this
order of operations.

1. study the README.md
2. grep `specs/` for any relevant keywords to the task you are implementing.
3. study the relevant specs.
4. grep `design/` for any relevant keywords to the task you are implementing.
5. study the relevant documents.
6. implement the change requested in the prompt.
7. run linting and formatting before committing.
8. Identify any remaining issues or features that need to be implemented
   1. file them as bd issues (see [Issue Management](#issue-management)).
   2. include them in GAPS.md
9. commit and push the change.
10. if you were not able to fully address the bd issue, mark it as "blocked".
    This will ensure the next worker does not pick it up again until a human reviews.

## Branch cleanup

When starting work, the branch should be clean, and you should try pull the
latest changes from the primary upstream branch before continuing.

## Add and update documentation

Always add and update documentation as appropriate. Update at least the following:

- any relevant files in the `docs/` directory.
- any updated designs and considerations in the `specs/` directory.

## Issue Management

File issues liberally to help keep context minimal and focus on your current
task.

- Issues are managed via the `bd` commmand line.
- Issues are created via `bd create`
  - Priority should be set to the following (P2 otherwise):
    - P0: Any required project fundamentals or initialization

## Committing code

- **unless** the prompt contains "don't commit", commit the code.
- **unless** the prompt contains "don't push", push the code.

- Use the conventional commit format for commit messages.
- The commit description must explain the problem first.
- The commit description must a summary of each area modified.

## Linting

- Always run linting and formatting before committing.
- Formatting and lint fixing tools are available via `just fix`.
- Linting tools are available via `just lint`.

## Testing

- linting, formatting, and testing **must** pass before a commit.
- add unit tests for every change if possible.

## CI

CI **must** pass after every commit.

To verify CI status, use the GitHub MCP server.

## Code Design

The following code tenants are followed:

- functional programming as much as possible.
- separate state from functional programming.
- re-use code as much as possible.
- leverage best-practice third party libraries.

## Examples

- example data is in the `examples/` directory.

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
