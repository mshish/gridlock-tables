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

## Settings

- **Minimum column width** / **Maximum column width** (4-120 characters,
  defaults 6 and 60): clamp content-sized columns so a short column never
  collapses to a sliver and a long-text column wraps instead of taking the
  whole table. They set Obsidian's `--table-column-min-width` and
  `--table-column-max-width` while the plugin is enabled, and apply without a
  reload.
- **Save column widths** (default: in the note): where widths you set by
  dragging or double-clicking a column handle are kept. See below.

## Where resized widths are saved

By default, resizing a column writes the widths into the note, as an HTML
comment and a blank line above the table:

```markdown
<!-- gridlock-cols: 12ch auto 40ch -->

| Col A | Col B | Col C |
```

There is one value per column: a width in `ch`, or `auto` for a column that
sizes to its content. Other Markdown renderers ignore the comment, so the widths
travel with the note through renames, moves and sync. Delete the comment to go
back to content-driven sizing. The blank line matters: in Obsidian, a comment
directly above a table stops Live Preview rendering it as a table.

Choose **In plugin data** under **Save column widths** to leave your Markdown
untouched. Widths are then kept in the plugin's `data.json`, by note path and
table position.

Switching this setting moves nothing: widths already saved either way keep
showing, and the next resize saves to the place you chose. A table resized
while widths went to plugin data keeps that width even after its comment is
deleted, until you resize it again.

## Turning it off for one note

Add the `gridlock-tables-off` CSS class to the note's frontmatter and its
tables render natively while the plugin stays on everywhere else:

```yaml
---
cssclasses: [gridlock-tables-off]
---
```

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
