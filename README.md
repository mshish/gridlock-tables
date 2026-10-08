# Gridlock Tables

An Obsidian plugin that makes Markdown tables behave the way OneNote tables do:
columns size to their content, a table wider than the readable line grows into
the free pane space and scrolls sideways only past the pane edge, and a column
you resize by hand stays that width.

Status: scaffold. Nothing user-facing ships yet. The design and the reasoning
behind it are in `docs/research/feasibility.md`.

## Scope

- Phase 1: overflow-only breakout, clamped content-driven column widths, a
  per-note toggle. CSS plus a thin plugin.
- Phase 2: drag-to-resize, pinned widths, double-click auto-fit, widths stored
  portably in the note as an HTML comment with a `data.json` fallback.
- Not planned: a custom Live Preview grid or whole-page horizontal canvas. See
  the feasibility doc for why.

## Development

```sh
npm install
npm run dev     # watch build to main.js
npm run build   # typecheck + production build
npm run lint
```

Requires Obsidian 1.14.4 or newer. Works on desktop and mobile.

## License

MIT
