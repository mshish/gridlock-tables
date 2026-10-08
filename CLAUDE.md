# Gridlock Tables -- LLM context

Same rules as AGENTS.md; this file is formatted to land in a Claude/LLM context window.

## The plugin in one sentence

Augments Obsidian's native pipe-table rendering: content-sized columns, overflow-only
horizontal scroll past the pane edge, and pinned manual widths -- OneNote-style, without
replacing the Live Preview table widget.

## Inviolable constraints

- **Never replace** the native CM6 table widget (no StateField block-replace over Obsidian-owned ranges).
- **Widths in `ch` or fractional weights only** -- never `px`.
- **All style rules under `body.gridlock-tables-enabled`** -- removing the class restores native rendering immediately, no reload.
- **`isDesktopOnly: false`** -- mobile must work; use pointer events, not mouse-only APIs.
- **Reading view and Live Preview parity** -- if it works in one, it must work in the other.
- **Pin `minAppVersion: 1.14.4`** -- the LP table widget is undocumented API; verify on every Obsidian release before raising it.

## Phase 3 is explicitly out of scope

Do not implement a custom Live Preview grid (StateField + block-replace widget) or whole-page
horizontal canvas scroll unless the user explicitly overrides this. The maintenance cost is too
high and the feature breaks on Obsidian releases.

## Auto-sizing algorithm

Lives in `src/utils/autoSize.ts`. Pure functions, no Obsidian imports. Key entry points:

- `clampCol(measured, globalMinCh, globalMaxCh)` -- clamp a measured column to the configured limits.
- `distributeWidths(cols, opts)` -- CSS 2.1 table distribution: returns final `ch` widths.

Read `docs/research/feasibility.md` section 5 before modifying the algorithm.

## Storage preference for manual widths

1. HTML comment above the table (`<!-- gridlock-cols: 12ch auto 40ch -->`): portable, travels with the note.
2. `data.json` fallback for users who refuse Markdown changes.

Never store widths in `px`. Never use sidecar files.

## Key files

| Path | Purpose |
|------|---------|
| `src/main.ts` | Plugin lifecycle only (onload/onunload/settings). Keep minimal. |
| `src/settings.ts` | Settings interface and tab (declarative 1.13 API). |
| `src/utils/autoSize.ts` | Pure column-distribution algorithm. No Obsidian imports. |
| `styles.css` | All scoped under `body.gridlock-tables-enabled`. |
| `docs/research/feasibility.md` | Full research; read before architectural decisions. |
| `AGENTS.md` | Full agent operating contract. |

## Commands

```sh
npm run build              # tsc + esbuild -> main.js
npm run lint               # ESLint
npm test                   # vitest (pure unit tests, no Obsidian)
.\scripts\install-dev.ps1  # build + copy to dev vault
```
