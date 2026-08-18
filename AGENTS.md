# Project Workspace Boundary

- Treat `D:\Tests\Test` as this project's only workspace root.
- Run all project discovery, Git, build, test, and edit commands from `D:\Tests\Test` or one of its subdirectories.
- Only create, modify, move, or delete project files inside `D:\Tests\Test`.
- Do not use `C:\Users\admin\Documents\Tests` or any other directory as this project's source workspace.
- If a session for this project starts outside `D:\Tests\Test`, do not edit project files; report that the project must be reopened from `D:\Tests\Test`.
- Reading installed tools, skills, caches, and temporary files outside the project is allowed when required, but project outputs must remain inside `D:\Tests\Test`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
