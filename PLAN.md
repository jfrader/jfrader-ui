# PLAN.md — moved to Linear

**Planning, backlog, milestones and work items live in Linear**: project [`jfrader-ui`](https://linear.app/gurisitosgames/project/jfrader-ui-c77946033a48), epic **GURI-1961 — Ship jfrader-ui v1: hardening refactors + remaining components** (children GURI-1962 → GURI-1977). Work tracks per issue; branches/worktrees use the issue id (`~/Workspace/Worktrees/jfrader-ui-GURI-N`).

This file intentionally stays small. Where things live:

- **Conventions & authoring guide** → `SKILL.md` (component DoD, a11y/performance rules, overlay contracts, review checklist) and `AGENTS.md` (commands, Linear workflow, dependency allowlist).
- **Headline decisions** (one-liners; details in git history and Engram memory):
  - Palette: Arc-style pastel violet (`#a78bff` / dark text) on Linear's near-black stack; matched white/violet light theme; all pairs AA-checked.
  - Stack: from-scratch components, Emotion styling, tokens as typed TS → generated CSS custom properties, Storybook 10 + Vitest browser tests + axe gate, `@floating-ui/react` for overlays.
  - Distribution: D1 — versioned npm monorepo (`@jfrader/tokens`, `@jfrader/ui`); repo is `jfrader/jfrader-ui` (private) until publish prep (GURI-1969).
- **Work log** → Linear; **session memory** → Engram.

History of the original plan (research, reviews, reconciliations, wave logs) is in git history of this file.
