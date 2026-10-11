# Gridlock Tables -- agent guide

Owned by the `gridlock` crewmate. This file is the authoritative operating contract for any
agent working in this repo. Read it before touching any code.

## What this plugin does

Content-sized table columns, overflow-only horizontal scroll, and pinned manual widths for
Obsidian. OneNote-style: columns grow to fit content, a table wider than the readable line
grows into free pane space and scrolls sideways only past the pane edge, and a manually
resized column stays that width.

## Non-goals (do not build)

- Phase 3: custom Live Preview grid (replacing the native CM6 table widget with a StateField
  block-replace). Too high a maintenance cost; breaks on Obsidian updates.
- Whole-page horizontal canvas scroll.
- Free-form X/Y note layout (use Obsidian Canvas instead).

## Inviolable rules

1. **Augment the native CM6 table widget -- never replace it.** Use a CM6 ViewPlugin and
   MutationObserver to decorate the widget. Do not use StateField block-replace decorations
   over ranges Obsidian already owns.
2. **Widths in `ch`/relative units only -- never `px`.** Pixel widths break across fonts,
   zoom levels, and mobile screens. Store and apply all widths in `ch` or as fractional
   weights.
3. **Reading view and Live Preview parity.** Every feature that works in Reading view must
   also work in Live Preview, and vice versa.
4. **Mobile works.** `isDesktopOnly` is `false`. Pointer events for resize handles; touch
   drag inside a horizontally scrollable table must not conflict with scroll gestures.
5. **Every style rule hangs off `body.gridlock-tables-enabled`.** Disabling the plugin in
   settings removes this class, which must restore native rendering with no reload.
6. **Pin `minAppVersion`.** The LP table widget is not public API. After any Obsidian
   release, verify the plugin still works on the new version before raising `minAppVersion`.
   Current pin: `1.14.4` (the installed version on the dev machine).

## Key documents

| File | When to read |
|------|-------------|
| `docs/research/feasibility.md` | Before any architectural decision. Full analysis of the approach, existing plugins, storage options, and the auto-sizing algorithm. |
| `docs/conductor-brief.md` | If you are running the autonomous issue loop (Issue Radar + crew). Operating contract for the loop, review tiers, and phase gating. |
| `src/utils/autoSize.ts` | The pure column-distribution algorithm. Must stay free of Obsidian imports. |
| `CLAUDE.md` | Same rules, formatted for Claude/LLM context. |

## Hard-won rules

These came from real bugs and workflow failures during development. A new contributor
(human or agent) who skips them will hit the same problems.

### CSS

- **Scope rules through the table's own view element, not a parent embed.**
  A rule like `body.gridlock-tables-enabled table` leaks into embedded notes. The correct
  path is through `.markdown-preview-view` or `.cm-editor` of the note that owns the table.
  The per-note opt-out (`:not(.gridlock-tables-off)`) must also sit at the view element
  level so embedded notes can disable the plugin independently.

- **Obsidian 1.14.4 wraps tables in scrolling containers capped at readable line width**
  in both Reading view and Live Preview. Do not add another wrapper -- extend the existing
  container. Adding a second wrapper causes double-scroll and breaks the overflow formula.

- **Overflow breakout formula must account for the line-number gutter and nesting indents.**
  Correct formula: `pane_inner_right - gutter (20px) - nesting_indent`. Verify across:
  narrow panes, line numbers on/off, quote/list nesting, and split-pane views.

- **Obsidian 1.14.4 has unnamed `@container` queries.** New CSS containers you add can
  accidentally match them. Check for unintended interactions when adding any `@container`.

### Testing

- **Unit tests do not catch cross-view bugs.** The embed-styling leak (PR #14) was invisible
  to unit tests and only surfaced in a visual review. Always include cross-view scenarios
  (note embedded in another note, split panes) in Tier 2 visual verification.

- **Keep `src/utils/` free of Obsidian imports.** Everything there must be testable in
  Node with `npm test` -- no Obsidian globals, no DOM. If you need Obsidian types, the
  code belongs in `src/` proper, not `src/utils/`.

### Git and CI

- **Never use `gh pr merge --auto` on this repo.** It has no branch protection, so
  `--auto` merges instantly before CI finishes. Always wait for CI green + Tier 1 review,
  then merge with: `gh pr merge <n> --merge --delete-branch`

- **Do not push directly to master.** Branch off master, open a PR, let CI run.

### Autonomous crew workflow

- **Issue Radar ledger writes (`issue_radar_crew_record`) require the session to be bound
  to the specific crew.** A general agent session will fail with "not an Issue Radar crew."
  Ledger calls must come from the crew session that claimed the issue.

- **Self-approval permission checks block ledger writes.** If the crew session that
  implements an issue also tries to record its own resolution, the platform refuses it as
  self-approval. The `gridlock` crewmate records phase completion; the crew records issue
  progress only.

- **Phase gating is `gridlock`'s job.** When every issue in a phase is merged, `gridlock`
  adds `ready` to all issues in the next phase without asking the owner. The crew does not
  gate phases; it just works the `ready` queue.

- **Allow rules needed for full crew autonomy** (in KiroCrew settings):
  `mcp__kirocrew-core__issue_radar_crew_record` (ledger),
  `mcp__kirocrew-core__spawn_run` (sub-agents),
  `mcp__kirocrew-core__learn_add` (save lessons).
  Without these, crew operations stall silently.

## Build and test commands

```sh
npm ci                    # install deps (skip if node_modules is current)
npm run build             # tsc typecheck + esbuild production build -> main.js
npm run dev               # watch build (development)
npm run lint              # ESLint with eslint-plugin-obsidianmd
npm test                  # vitest run (unit tests, no Obsidian required)
```

## Dev-vault install

The script auto-discovers your Obsidian vault from Obsidian's own config file.
Pass `-VaultPath` to override if you have multiple vaults.

```powershell
.\scripts\install-dev.ps1                        # build + copy to discovered vault
.\scripts\install-dev.ps1 -NoBuild              # copy only (skip build)
.\scripts\install-dev.ps1 -VaultPath "C:\path\to\your\vault"  # explicit vault
```

Fixture note for manual LP/RV checks: `docs/dev-vault-fixture.md`

## Release checklist

1. Bump `version` in `manifest.json` and `package.json`.
2. Run `npm run version` (updates `versions.json`, stages manifest + versions).
3. Tag the commit exactly as the version string (no leading `v`).
4. Push the tag -- the `release.yml` workflow builds and creates the GitHub release.
5. Attach `main.js`, `manifest.json`, `styles.css` as assets (done by the workflow).

## Phase plan

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Baseline: install Table Width + Dynamic Wide Content, record the gap | Done |
| 1 | CSS + thin plugin: overflow-only breakout, clamped col widths, per-note toggle | Done |
| 2 | Resize, pin (HTML comment), auto-fit (dbl-click), mobile touch | Done |
| 3 (optional) | Custom LP grid or whole-page canvas scroll | Explicitly out of scope |
