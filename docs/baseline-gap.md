# Baseline gap analysis (Phase 0)

What the two closest community plugins do with the tables in `docs/dev-vault-fixture.md`, and
which parts of the Gridlock Tables goal they leave open.

## Setup

- Obsidian 1.14.4 desktop (Windows, Electron 43), default theme, readable line length on.
- **Table Width** 1.0.2 (`table-width`, `isDesktopOnly: true`) and **Dynamic Wide Content**
  1.1.10 (`dynamic-wide-content`, `isDesktopOnly: false`), installed from their latest GitHub
  releases. Default settings for both.
- A throwaway vault containing only the fixture note and these two plugins, opened in an
  isolated Obsidian profile. The owner's personal vault was not used.
- Driven over the Chrome DevTools protocol. Layout numbers are `getBoundingClientRect()` values
  in CSS px; drags and double-clicks are real pointer input, not synthetic DOM events.
  Screenshots were taken for each case and are not committed.
- Window 1700px wide, sidebars collapsed. Readable column (prose) spans 516–1216. The pane's
  inner (padded) edges are 76 and 1655.

## Matrix

Table edges in px. "Scrolls" means the table scrolls sideways inside its own container. No
configuration made the whole page scroll sideways.

| Plugins | View | Narrow (3 cols) | Wide (10 cols) | Overflow (15 cols) |
|---|---|---|---|---|
| None (native) | RV | 516–699, left-aligned | 516–1216 frame, scrolls | 516–1216 frame, scrolls |
| None (native) | LP | 516–699, left-aligned | 500–1232 frame, scrolls, cells wrap | 500–1232 frame, scrolls |
| Table Width | RV | same as native | same as native | same as native |
| Table Width | LP | same as native | same as native | same as native |
| Dynamic Wide Content | RV | 774–957, **centred** | 382–1349, breaks out **both sides**, no scroll | 66–1666 frame, scrolls; table 4454px wide |
| Dynamic Wide Content | LP | 758–941, centred | 366–1333, both sides, no scroll | 50–1650 frame, scrolls |
| Both | RV / LP | same as Dynamic Wide Content | same as DWC | same as DWC |

Table Width changes nothing until a column is resized. Natively the wide table is 736px, only
36px wider than the readable column, so it scrolls a little.

## Overflow behaviour

- **Native:** every table is confined to the readable column. Anything wider scrolls inside its
  wrapper (`.el-table` in RV, `.cm-table-widget` in LP) while free pane space sits unused.
- **Table Width:** no overflow handling of its own.
- **Dynamic Wide Content** widens a table into a centred frame (`left: 50%;
  translateX(-50%)`) with `max-width: min(1600px, 100vw - 64px)`:
  - Tables are centred on the readable column, not aligned to the prose's left edge. That
    includes the narrow table, which fits in the column and still shifts 258px right.
  - A wide table breaks out to the left and right of the column.
  - Cells are `nowrap` by default, so the overflow table grows from 1523px to 4454px.
  - The limit is the **viewport**, not the pane. In a two-pane vertical split (each pane about
    830px), the wide table spans -32 to 935 in the left pane. The pane clips it on both sides,
    so the first and last columns are cut off, and the clipped part cannot be scrolled to. The
    overflow frame extends past both pane edges in the same way.
- Neither plugin offers a per-note opt-out. Dynamic Wide Content has global switches per
  content type and per view.

## Resize

- **Native, Dynamic Wide Content:** no column resize.
- **Table Width:**
  - Drag a column border. It responds to pointer events within 5px of the border, and the
    cursor changes to `col-resize`. It works the same in RV and LP, and in LP a border drag does
    not put the cell into editing.
  - Dragging trades width with the neighbouring column, and the table keeps its total width. A
    100px drag grew column 1 from 89 to 108px and shrank column 2 to its 40px floor.
  - Double-clicking a border fits the column to its unwrapped text (89 to 218px), and the table
    grows by that amount.
  - Widths are written as **px** on a `<colgroup>` plus the table's `width`, with
    `table-layout: fixed`. After resizing, a table no longer adapts to font, zoom or screen size.
  - A command resets the widths for the current note.

## Mobile

Mobile was **emulated** with `app.emulateMobile(true)` in a 430px window (phone layout), not run
on a real device. Touch gestures were not tested.

- **Native:** narrow table fits. Wide and overflow tables scroll inside the 24–393 column.
- **Table Width:** its manifest says `isDesktopOnly: true`, so Obsidian mobile will not offer
  it. Emulation still loaded it. It applied the desktop's saved px widths (the wide table stayed
  845px wide) and scrolled.
- **Dynamic Wide Content:** narrow table centred (117–300). Wide and overflow tables become
  near-full-width frames (26–391) that scroll; cells stay `nowrap`, so the overflow table is
  4455px wide.

## Width portability

- **Table Width** stores widths in its plugin `data.json` as px arrays, keyed by note path and
  then by the table's header row text:
  `{"files": {"note.md": {"Feature|Phase|...|Branch": [218, 40, ...]}}}`. Nothing is written to
  the Markdown file.
  - **Renaming the note loses the widths.** The key is not migrated, and renaming back
    restores them.
  - **Editing any header cell loses the widths** for that table.
  - The widths do not move with the note to another vault or app. They sync only if `.obsidian`
    syncs.
  - Two tables in one note with identical headers share an entry (read from the plugin's
    source, not tested).
- **Dynamic Wide Content** stores only global settings, and nothing per table.

## Gaps closed by Phase 1

| Gap in the baseline | Closed by |
|---|---|
| Native tables never use free pane space; DWC centres them and breaks out to the left | #4 (PR #13): the container stays left-aligned with the prose and grows rightward only when the table is wider than the column. |
| DWC's limit is the viewport, so tables clip in split panes | #4: the limit is the pane's own width (a container query on the pane's scroll element). By design; split panes were not re-measured for this doc. |
| Past the limit, DWC scrolls inside a frame but `nowrap` inflates the table | #4 scrolls inside the native container. #5 (PR #12) clamps columns to 6–60ch by default, so long cells wrap instead of widening the table. |
| Neither plugin can be switched off per note | #6 (PR #14): `cssclasses: [gridlock-tables-off]` |

## Gaps left for Phase 2

| Gap | Issue |
|---|---|
| Resize exists only in Table Width: desktop-only, px widths, neighbour-trade drag | #7: drag handles in RV and LP, widths in `ch` |
| Saved widths live in `data.json`, keyed by path + header text, and are lost on rename or header edit | #8: pin widths in an HTML comment in the Markdown |
| Auto-fit sizes to unwrapped text in px, without regard to the other columns | #10: double-click auto-fit using `distributeWidths` |
| No touch resize anywhere; Table Width is desktop-only; DWC has no handles | #9: touch handles that coexist with sideways scroll |
