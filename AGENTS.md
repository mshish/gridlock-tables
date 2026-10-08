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
| `src/utils/autoSize.ts` | The pure column-distribution algorithm. Must stay free of Obsidian imports. |
| `CLAUDE.md` | Same rules, formatted for Claude/LLM context. |

## Build and test commands

```sh
npm ci                    # install deps (skip if node_modules is current)
npm run build             # tsc typecheck + esbuild production build -> main.js
npm run dev               # watch build (development)
npm run lint              # ESLint with eslint-plugin-obsidianmd
npm test                  # vitest run (unit tests, no Obsidian required)
```

## Dev-vault install

```powershell
.\scripts\install-dev.ps1          # build + copy to vault
.\scripts\install-dev.ps1 -NoBuild # copy only (skip build)
```

Vault: `D:\Obsidian\Personal\.obsidian\plugins\gridlock-tables\`
Fixture note: `docs/dev-vault-fixture.md` -- copy to vault for manual LP/RV checks.

## Release checklist

1. Bump `version` in `manifest.json` and `package.json`.
2. Run `npm run version` (updates `versions.json`, stages manifest + versions).
3. Tag the commit exactly as the version string (no leading `v`).
4. Push the tag -- the `release.yml` workflow builds and creates the GitHub release.
5. Attach `main.js`, `manifest.json`, `styles.css` as assets (done by the workflow).

## Phase plan

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Baseline: install Table Width + Dynamic Wide Content, record the gap | Not started |
| 1 | CSS + thin plugin: overflow-only breakout, clamped col widths, per-note toggle | Not started |
| 2 | Resize, pin (HTML comment), auto-fit (dbl-click), mobile touch | Not started |
| 3 (optional) | Custom LP grid or whole-page canvas scroll | Explicitly out of scope |
