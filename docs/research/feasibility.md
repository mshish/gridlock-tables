# Feasibility: An Obsidian Plugin for OneNote-Style Dynamic Table Columns and Canvas Scroll

You can build most of this. A plugin that sizes columns to their content, lets wide tables break out of the readable column and scroll sideways, and remembers manual resizes is a realistic project for one developer, measured in weeks. Several community plugins already do parts of it. True OneNote parity is not realistic: a free-form page that scrolls sideways *while you edit in Live Preview* means fighting Obsidian's private table widget, and that work breaks with Obsidian updates. My advice is to build a "dynamic-width + per-table horizontal scroll + persisted manual widths" plugin on top of the native widget, and drop full-page canvas scroll as a goal.

## TL;DR
- **Easy, mostly done already:** content-driven auto widths and tables that break out of the readable column with their own horizontal scroll. This is CSS plus a light plugin, and Table Style Tweaks and Dynamic Wide Content already ship it for both Reading view and Live Preview.
- **Moderate:** drag-to-resize plus auto-fit, with widths saved outside the Markdown. Table Width, Table Resize and Table Column Resize do this today. The gaps are polish: mobile and touch, stable table identity, and portability.
- **Hard, high-maintenance:** OneNote-style whole-page canvas scroll and a custom-rendered table in Live Preview. Both mean replacing or deeply patching Obsidian's undocumented CM6 table widget. Plugins that modify it (e.g. Sheets Extended) have had to ship fixes after Obsidian 1.13. Build this only if you are willing to maintain it continuously.

## Key Findings

### 1. Why Obsidian tables behave the way they do
- **Live Preview** draws a GFM pipe table as a native CodeMirror 6 widget, nested as `.cm-table-widget > .table-wrapper > table`. Since **Obsidian 1.5.0** (Nov 2023) this widget has been a full table editor: "Table rows and columns are now easier to create, edit, sort, reorder, select, copy, and paste... Tables are still saved to plain text Markdown." Each cell is edited in its own small sub-editor. The widget also captures events: one plugin author notes that "Live Preview's own table-editing widget intercepts right-clicks made directly on the table itself." Later releases kept adjusting it, e.g. 1.5.8 "Fixed issue where long horizontal tables would lose their scroll position on edit."
- **Reading view** renders tables with the standard Markdown post-processing pipeline (`.markdown-rendered table`). This DOM is ordinary, stable and easy to post-process.
- **Width behavior** comes from three layers:
  1. The browser's `table-layout: auto` algorithm sizes columns between each column's min-content and max-content width.
  2. Obsidian's theme variables cap columns. The official docs.obsidian.md Table reference lists `--table-column-max-width` ("Column maximum width") and `--table-white-space` ("Table white-space property"); `--table-column-min-width` is not on that page. Plugins also set `--table-column-min-width`: the Table Style Tweaks listing says it sets "Obsidian's official --table-column-min-width CSS variable" (its slider runs 4-40 characters, default 8).
  3. **Readable line length** caps the whole content column at `--file-line-width` (700px by default; vii33's GitHub gist on readable line length says "700px is the default width"), so a wide table gets squeezed into prose width.
- Themes and snippets often change this. One forum user found their columns were "100% / number_of_columns" until they disabled a snippet that set `table-layout: fixed; width: 100%`.
- **The real bottleneck is the readable-width cap.** The browser's auto algorithm is already a sensible content-based default; it just runs inside a container that is too narrow.

### 2. Plugin API extension points and their limits

| Extension point | What it can do for this goal | Limits |
|---|---|---|
| **CSS snippet / plugin `styles.css`** | Override the `--table-*` variables, let tables escape `--file-line-width`, add `overflow-x: auto` wrappers, set `white-space: nowrap` with min widths | Can't measure content, can't store per-table widths, can't add drag handles |
| **`registerMarkdownPostProcessor`** | Full control over Reading view tables: measure, set `<colgroup>` widths, inject resize handles, wrap in scroll containers | Reading view (and embeds, export) only. Does not touch Live Preview's table widget |
| **CM6 `ViewPlugin`** | Observe and patch the native table widget's DOM after it renders (add handles, set column widths) | Can't change vertical layout or replace line breaks, since CM6 says block decorations must come from a StateField. You patch DOM you don't own |
| **CM6 `StateField` + block `Decoration.replace` widget** | Replace the whole table in Live Preview with your own rendered or editable grid | You re-implement cursor handling, cell editing, undo, selection, IME and mobile input yourself. It conflicts with the native widget |
| **Custom view / code block** (`registerView`, `registerMarkdownCodeBlockProcessor`) | Fully custom grid in its own container, the way Better Tables and Rich Table work | Data no longer lives in a plain pipe table, or round-trips through a special block |

- **Can a plugin replace Live Preview's table rendering?** In practice, yes. Structural Tables offers an opt-in "Take over ordinary Markdown tables" mode, and a plugin's own fenced-block widget is entirely its own. Still, most mature plugins choose to **augment** the native widget instead.
- Table Master states it "applies merges by toggling rowspan / colspan attributes and hiding placeholder cells in Obsidian's existing table widget -- cell text is left untouched, so the widget remains compatible with normal Obsidian editing," using a "reading-view post-processor + live-preview view plugin."
- One plugin author (Indented Table) claims "Obsidian blocks widget and replace decorations from plugins." Structural Tables' takeover mode contradicts this as a general rule. The safest reading is that replace decorations over ranges Obsidian already manages conflict with Obsidian's own handling.
- **The risk is concrete.** Sheets Extended's 2.0.3 release (published by NicoNekoru on GitHub on Oct 3) had to "Restore native table merging and vertical headers in Obsidian 1.13 Live Preview" and now "Requires Obsidian 1.13.0 or newer"; its notes say it was "Tested through computer use in Obsidian 1.13.7 on macOS, including Live Preview, Reading view, cell editing and Tab navigation." Obsidian's public changelog doesn't flag that table-widget change.
- **Performance:** measuring cells forces layout (reflow). Large tables need batched reads, `ResizeObserver`, and caching widths by content hash. Data grids sidestep the cost with virtualization: AG Grid "can measure only what it renders," and MUI's grid "can only autosize based on the currently rendered cells." Typical Obsidian notes are small enough that full measurement is fine. A 500-row table in Live Preview is not.

### 3. Where to store column-width state

| Option | Portability | Robustness | Verdict |
|---|---|---|---|
| **Auto-compute every render (no storage)** | Perfect: the Markdown stays pure | Deterministic | **Default.** It covers the "sensible default" requirement |
| **Plugin `data.json`** (keyed by path + header/index) | Invisible to other apps. Syncs only if `.obsidian` syncs | Breaks on rename or header edits unless you track renames | What Table Width, Table Resize and Table Column Resize use. Fine for manual overrides |
| **Frontmatter** (e.g. `table-widths: {t1: [120, 300]}`) | Travels with the note, readable YAML | Must map to tables by index or header | Good for opt-in per-note overrides |
| **HTML comment before the table** (`<!-- cols: 12ch auto 40ch -->`) | Survives every Markdown tool. Invisible when rendered | Positionally bound to the table, so the most robust | **Best for overrides you want to keep.** Better Tables uses "MD + hidden comment" |
| **Sidecar file** | Poor, and adds clutter | Must be kept in sync | Avoid |
| **HTML `<table>` with `<col width>`** | Renders anywhere | Loses Markdown editability | Only as an export |

Widths in `data.json` are tied to whichever device stored them. Rich Table found it needed to scale saved widths down when "a table's saved widths total more than the available width (e.g., widths recorded in editor view, then exported to a narrower PDF page)." Store widths in **`ch`/`em` or as relative weights, not pixels**, so they survive font, zoom and mobile changes.

### 4. OneNote's model, and how much of it transfers
- **Tables:** OneNote columns grow as you type ("My columns expand in width as I type"). Once you drag a border, the column becomes fixed: "If you manually resize a column, the setting becomes fixed."
- **Weak spots:** OneNote has no proper auto-fit command. A Microsoft Q&A reply by "Cliff" (2018-02-15) on "Is there an autofit column width in OneNote?" confirmed "there are no such features in OneNote 2016 now." OneNote for the web can't set numeric widths or equalize columns.
- **The page:** OneNote pages are a canvas of absolutely positioned *note containers* with X/Y coordinates. Coordinates can even go negative, and the canvas grows right and down. A container's default width shrinks or grows to fit the screen. Once you resize it by hand, the container stops adapting, and on a phone "it need to scroll horizontal to view the note."
- **Transferable to Obsidian:**
  - *Grow-with-content until a manual resize pins the width.* This is exactly "auto layout plus stored override." **Easy.**
  - *Tables that extend past the text column and scroll sideways.* Per table, this is **easy**: a wrapper set to `width: max-content; max-width: (pane width); overflow-x: auto`, which already works in Reading view and Live Preview. As a *whole-page* horizontal scroll it is **hard and ill-advised**: you'd turn off readable line width and set `overflow-x` on `.cm-scroller` / `.markdown-preview-view`. CM6 manages its own scroller, line wrapping and viewport calculations, prose lines would stretch, and mobile panning gets awkward.
  - *Free-form X/Y positioning.* **Not feasible inside a note.** Markdown is a linear document. Obsidian Canvas (`.canvas` JSON) is the native free-form surface, but a table there is just a note card that keeps the same table limits.
- **Recommended behavior.** Text stays in the readable column. A table stays inline until its natural width exceeds the column. It then grows rightward into free pane space, with its left edge aligned to the text, and scrolls inside itself only beyond the pane edge. This gives roughly 80% of the OneNote feel at about 10% of the cost. Dynamic Wide Content already implements the "break out only when wider" rule.

### 5. A sensible auto-sizing algorithm
Copy the CSS automatic table layout and data-grid practice. Don't invent a new one.
1. **Measure per column** two values. *Min-content* is the longest unbreakable token (word or URL), clamped. *Max-content* is the widest cell laid out on one line. The CSS spec computes these per cell, then distributes: "Ideally, each column should get its preferred width (usually its max-content width)."
2. **Clamp** each column to `[minCh, maxCh]`, e.g. 6ch-60ch. This stops one long paragraph from claiming the whole table, and stops numeric columns from becoming slivers. Table Style Tweaks' default is "cells stay on one line until their content reaches... 8" characters. AG Grid exposes the same idea as `defaultMinWidth`/`defaultMaxWidth`.
3. **Pick a total width.** If the sum of max-content widths ≤ the available width, use max-content (no wrapping). Otherwise give each column its min, then distribute the remaining space in proportion to (max − min). That is the CSS 2.1/3 distribution. Short columns ("ID", dates, status) stay tight and long-text columns absorb the wrap.
4. **If even the sum of mins > the pane**, overflow horizontally and scroll. This is the OneNote "page extends" moment.
5. **Measuring:** for plain text, canvas `measureText()` with the computed font is fast and needs no reflow. Telerik recommends it, and the 6pac/SlickGrid wiki's "Auto Column Sizing" page warns that switching a column from its optimized ContentIntelligent mode to plain Content sizing makes "the performance go from 200 milliseconds to 100 seconds!" For rich cells (links, embeds, math), measure the DOM in one batched read. Optimizations: deduplicate values, sample rows on very large tables, and cache by content hash.
6. **Practical shortcut:** in most cases you can let the browser do steps 1-3. Remove `table-layout: fixed`, set the min/max variables, and let the container grow. Write your own algorithm only to persist results, switch to `fixed` after a manual resize, or support "auto-fit this column" (double-click).

### 6. Existing plugins and how close they get

| Plugin | Mode coverage | What it does | Gap vs. your goal |
|---|---|---|---|
| **Table Style Tweaks** | RV + LP | Sets the min column width (default 8ch), breaks tables out of the readable width, caps max width, horizontal scroll, keeps native layout | No manual resize, no per-table memory |
| **Dynamic Wide Content** (2k-3k downloads on the official listing depending on snapshot, Obsidian 1.5.0+, desktop + mobile) | RV + LP | Widens tables, code and diagrams *only when they exceed prose width*, scrollable frame, optional one-line cells | No resize or persistence |
| **Table Width** (Capgemini, 1.0.2, desktop-only, Obsidian 1.13.7+) | RV + LP | Drag borders, double-click auto-fit, untouched tables keep native layout, widths saved per note and table outside the Markdown | Brand new, tiny install base, desktop-only, keyed by header row |
| **Table Resize** (desktop-only, 1.12.7+) | RV + LP | Drag resize, widths in `data.json` keyed by "file path + table order + first-row header text" | Same identity fragility. No auto-fit |
| **Table Column Resizer** (bubble-wu) | RV only | Pointer and touch drag, min/max limits | No Live Preview ("planned"). Widths "reset if the table's content changes" |
| **Table Column Resize** (lolieatapple) | RV + LP + PDF | Drag resize, per-note persistence, PDF scaling | No content auto-sizing (equal widths by default) |
| **HTML Tables** | RV only | Resize, auto-fit, equalize, merges | No Live Preview |
| **Better Tables / Rich Table** | Own block | Full grid UX: drag resize, auto-fit (Rich Table), horizontal scroll | Not plain pipe tables (YAML/code block or comment-annotated) |
| **Sheets Extended, Table Master, Structural Tables** | RV + LP | Merges, headers, styling, in-place editing | Not focused on widths |
| **Advanced Tables** | Source/LP editing | Navigation and formatting | No visual widths |

**Gaps nobody fills well:**
1. One coherent product that combines content-aware defaults, overflow-only breakout, manual pinning and auto-fit, the whole OneNote lifecycle, across both views, on mobile.
2. Widths stored *in the note* portably (an HTML comment), not just in `data.json`.
3. Robust table identity across edits and renames.
4. Touch resizing in Live Preview.

The space is crowded and moving quickly, with several resize plugins released in 2026, so a new entrant needs to stand out on polish and portability, not on the basic feature.

## Recommendations

**Build in three phases. Stop after Phase 2 unless users demand more.**

1. **Phase 1: CSS plus a thin plugin, about 1 week.**
   - Overflow-only breakout: tables grow past `--file-line-width` into the pane, and only beyond that does a per-table `overflow-x: auto` scroll appear.
   - Clamped min/max column widths through the `--table-*` variables, with `table-layout: auto` restored.
   - A per-note toggle through a `cssclasses` frontmatter flag.
   - This alone delivers "sensible defaults" and the OneNote sense of a page that extends.
2. **Phase 2: resize, pin and auto-fit, about 3-6 weeks to a polished release.**
   - Reading view: a post-processor injects `<colgroup>` and handles.
   - Live Preview: a `ViewPlugin` plus a scoped `MutationObserver` *decorates the native widget* (no replacement) with handles and column widths. Once a column is pinned, switch that table to `table-layout: fixed`.
   - Double-click a border to auto-fit with the algorithm in §5.
   - Store pins as an optional HTML comment above the table (portable). Fall back to `data.json` for users who refuse any change to the Markdown.
   - Use `ch`/relative units, pointer events for touch, and test on iOS and Android.
3. **Phase 3 (optional, not advised): custom Live Preview grid or whole-page horizontal canvas, ongoing cost.**
   - A StateField block-replace widget with your own cell editors, or a pane-level horizontal scroller.
   - Expect roughly 2-3 months to reach parity with the native editor (selection, undo, IME, Vim, sort and reorder) and continual breakage on Obsidian releases.
   - If users need free-form layout, point them to Obsidian Canvas instead.

**Before writing code,** install Table Width plus Dynamic Wide Content (or Table Style Tweaks) together. If that pair covers about 90% of your need, contribute upstream or fork instead of starting fresh.

## Caveats
- **Undocumented internals.** The Live Preview table widget's DOM and classes are not public API. Sheets Extended's 1.13 fix shows the breakage is real. Pin a minimum app version, test on Obsidian Insider (Catalyst) builds, and keep an off switch that falls back to native rendering.
- **Mobile.** Several resize plugins are desktop-only. Touch drag inside a horizontally scrollable table conflicts with scroll gestures, and screens are narrow, so overflow-and-scroll will be the norm on mobile.
- **Portability.** Every Markdown-only reader (GitHub, Obsidian Publish without your plugin, other editors) ignores your widths. Auto-sizing degrades gracefully. HTML-comment pins are inert but harmless elsewhere. `data.json` pins exist only in your vault and only sync if plugin settings sync.
- **Theme conflicts.** Themes such as Minimal and popular snippets override table width and layout, so you need a "force" mode and a compatibility matrix.
- **Default values from a community source.** An Obsidian Forum post by ariehen ("Default Table css", Apr 11, 2024) lists the defaults as `--table-column-min-width: 6ch; --table-column-max-width: none;` with `--table-white-space: break-spaces`. That is a community dump, not official documentation, and I could not confirm the default `table-layout` in each view. Check them in DevTools against your target Obsidian version.
- **Source quality.** Plugin capabilities come from their own READMEs and listings, which are self-reported. Several plugins are only weeks old with small install bases. The effort estimates are my judgment for one experienced TypeScript/CM6 developer, not measured data.
