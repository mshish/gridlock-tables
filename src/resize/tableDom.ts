/**
 * DOM work on a single table: resize handles, the pinned-width colgroup, and
 * measurement. Everything added here carries a gridlock class so stripTable
 * can restore the native table exactly.
 */
import { PinnedWidths, colgroupWidths, hasPins } from '../utils/columnWidths';
import { canMeasureAsText, measureTextLines } from '../utils/textMetrics';
import { ENABLED_CLASS } from '../scope';

export const HANDLE_CLASS = 'gridlock-col-resize';
export const COLGROUP_CLASS = 'gridlock-colgroup';
export const PINNED_CLASS = 'gridlock-pinned';
export const RESIZING_CLASS = 'gridlock-resizing';
/** On a table while a mouse is over one of its column edges (see ResizeController.onPointerMove). */
export const EDGE_HOVER_CLASS = 'gridlock-edge-hover';
export const MEASURE_MAX_CLASS = 'gridlock-measure-max';
export const MEASURE_MIN_CLASS = 'gridlock-measure-min';
export const KEY_ATTR = 'data-gridlock-key';
export const COL_WIDTH_VAR = '--gridlock-col-width';

/**
 * Tables the plugin may decorate: the same view-to-table paths styles.css
 * uses, so an opted-out note (or one embedded in an opted-in note) and a
 * disabled plugin never match. Obsidian 1.14.4 DOM.
 */
export const READING_TABLE =
	`body.${ENABLED_CLASS} .markdown-preview-view:not(.gridlock-tables-off) > .markdown-preview-sizer > .el-table > table`;
export const LIVE_PREVIEW_TABLE =
	`body.${ENABLED_CLASS} .markdown-source-view.mod-cm6:not(.gridlock-tables-off) > .cm-editor > .cm-scroller > .cm-sizer > .cm-contentContainer > .cm-content > .cm-table-widget > .table-wrapper > table`;

export function isActiveTable(table: Element): boolean {
	return table.matches(READING_TABLE) || table.matches(LIVE_PREVIEW_TABLE);
}

/** The table's own horizontal scroll container (.el-table / .cm-table-widget). */
export function scrollContainer(table: HTMLElement): HTMLElement | null {
	return table.closest<HTMLElement>('.el-table, .cm-table-widget');
}

/** The header cells, one per column. */
export function headerCells(table: HTMLTableElement): HTMLTableCellElement[] {
	const row = table.tHead?.rows[0] ?? table.rows[0];
	return row ? Array.from(row.cells) : [];
}

/** Add handles and apply pins. Idempotent: an up-to-date table is not touched. */
export function decorateTable(table: HTMLTableElement, key: string, widths: PinnedWidths | undefined) {
	if (table.getAttribute(KEY_ATTR) !== key) table.setAttribute(KEY_ATTR, key);
	for (const cell of headerCells(table)) {
		if (!cell.querySelector(`:scope > .${HANDLE_CLASS}`)) {
			// data-ignore-swipe keeps Obsidian's mobile sidebar swipe off the handle,
			// as on Obsidian's own table drag handles.
			cell.createDiv({ cls: HANDLE_CLASS, attr: { 'data-ignore-swipe': 'true', 'aria-hidden': 'true' } });
		}
	}
	applyWidths(table, widths);
}

/**
 * Pinned columns get a <col> width in ch; unpinned columns get none. The
 * width is a custom property that styles.css applies only to a pinned table on
 * an active note, so turning the plugin off ignores it even before cleanup.
 */
export function applyWidths(table: HTMLTableElement, widths: PinnedWidths | undefined) {
	const count = headerCells(table).length;
	if (!widths || !hasPins(widths, count)) {
		table.querySelector(`:scope > colgroup.${COLGROUP_CLASS}`)?.remove();
		if (table.hasClass(PINNED_CLASS)) table.removeClass(PINNED_CLASS);
		return;
	}
	let colgroup = table.querySelector<HTMLTableColElement>(`:scope > colgroup.${COLGROUP_CLASS}`);
	if (!colgroup || colgroup.children.length !== count) {
		colgroup?.remove();
		colgroup = createEl('colgroup', { cls: COLGROUP_CLASS });
		for (let i = 0; i < count; i++) colgroup.createEl('col');
		table.prepend(colgroup);
	}
	const values = colgroupWidths(widths, count);
	Array.from(colgroup.children).forEach((col, i) => {
		const value = values[i] ?? null;
		const style = (col as HTMLElement).style;
		if (value === null) {
			if (style.getPropertyValue(COL_WIDTH_VAR)) style.removeProperty(COL_WIDTH_VAR);
		} else if (style.getPropertyValue(COL_WIDTH_VAR) !== value) {
			(col as HTMLElement).setCssProps({ [COL_WIDTH_VAR]: value });
		}
	});
	if (!table.hasClass(PINNED_CLASS)) table.addClass(PINNED_CLASS);
}

/** Remove everything decorateTable added. */
export function stripTable(table: HTMLTableElement) {
	table.querySelectorAll(`.${HANDLE_CLASS}`).forEach((h) => h.remove());
	table.querySelector(`:scope > colgroup.${COLGROUP_CLASS}`)?.remove();
	table.removeClasses([PINNED_CLASS, MEASURE_MAX_CLASS, MEASURE_MIN_CLASS]);
	table.removeAttribute(KEY_ATTR);
	scrollContainer(table)?.removeClass(RESIZING_CLASS);
}

export function stripAll(root: ParentNode) {
	root.querySelectorAll<HTMLTableElement>(`table[${KEY_ATTR}]`).forEach(stripTable);
}

let canvas: HTMLCanvasElement | undefined;

/** Pixel width of 1ch in the table's font: the advance of "0", as CSS defines ch. */
export function chWidthPx(table: HTMLElement): number {
	const s = getComputedStyle(table);
	canvas ??= createEl('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return Number.parseFloat(s.fontSize) / 2;
	ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
	return ctx.measureText('0').width;
}

/** Rendered width of each column, in px (border box of the header cell). */
export function columnWidthsPx(table: HTMLTableElement): number[] {
	return headerCells(table).map((c) => c.getBoundingClientRect().width);
}

/** Padding plus borders of a cell, in px: the part of a column that is not content. */
export function cellChromePx(cell: HTMLElement): number {
	const s = getComputedStyle(cell);
	return ['padding-left', 'padding-right', 'border-left-width', 'border-right-width']
		.map((p) => Number.parseFloat(s.getPropertyValue(p)) || 0)
		.reduce((a, b) => a + b, 0);
}

/**
 * Min-content and max-content width of one column, in px. Lays the table out
 * unpinned at min-content and at max-content width, reads the column, and
 * restores it, all before the next paint.
 */
export function measureColumnPx(table: HTMLTableElement, cell: HTMLElement): { minPx: number; maxPx: number } {
	const pinned = table.hasClass(PINNED_CLASS);
	table.removeClass(PINNED_CLASS);
	table.addClass(MEASURE_MAX_CLASS);
	const maxPx = cell.getBoundingClientRect().width;
	table.removeClass(MEASURE_MAX_CLASS);
	table.addClass(MEASURE_MIN_CLASS);
	const minPx = cell.getBoundingClientRect().width;
	table.removeClass(MEASURE_MIN_CLASS);
	if (pinned) table.addClass(PINNED_CLASS);
	return { minPx, maxPx };
}

/**
 * A cell's text, one string per line, when it is plain text: only text and
 * line breaks, no links, code, math or other inline elements. Null otherwise.
 * Live Preview wraps a cell's content in .table-cell-wrapper; the resize
 * handle and Obsidian's own drag handles sit outside it.
 */
function plainTextLines(cell: HTMLTableCellElement): string[] | null {
	const content = cell.querySelector<HTMLElement>(':scope > .table-cell-wrapper') ?? cell;
	const lines = [''];
	for (const node of Array.from(content.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			lines[lines.length - 1] += node.textContent ?? '';
		} else if (node.nodeName === 'BR') {
			lines.push('');
		} else if (!(node.instanceOf(HTMLElement) && node.hasClass(HANDLE_CLASS))) {
			return null;
		}
	}
	return lines.every(canMeasureAsText) ? lines : null;
}

/** Spacing and casing canvas would not reproduce from the font shorthand. */
function hasTextEffects(s: CSSStyleDeclaration): boolean {
	return (
		s.letterSpacing !== 'normal' ||
		s.wordSpacing !== '0px' ||
		s.textTransform !== 'none' ||
		s.fontVariant !== 'normal' ||
		s.fontFeatureSettings !== 'normal'
	);
}

/**
 * Min-content and max-content width of one column, in px, measured with
 * canvas measureText in each cell's font, so the table is not reflowed.
 * Null when any cell in the column holds more than plain text; measure those
 * with measureColumnPx instead.
 */
export function measureColumnText(table: HTMLTableElement, col: number): { minPx: number; maxPx: number } | null {
	canvas ??= createEl('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	// Header and body cells differ in font and padding; rows of one kind do not.
	const kinds = new Map<string, { font: string; chromePx: number } | null>();
	let minPx = 0;
	let maxPx = 0;
	for (const row of Array.from(table.rows)) {
		const cell = row.cells[col];
		if (!cell) continue;
		const lines = plainTextLines(cell);
		if (!lines) return null;
		let kind = kinds.get(cell.tagName);
		if (kind === undefined) {
			const content = cell.querySelector<HTMLElement>(':scope > .table-cell-wrapper') ?? cell;
			const s = getComputedStyle(content);
			// Live Preview pads the wrapper rather than the cell: count both.
			const chromePx = cellChromePx(cell) + (content === cell ? 0 : cellChromePx(content));
			kind = hasTextEffects(s)
				? null
				: { font: `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`, chromePx };
			kinds.set(cell.tagName, kind);
		}
		if (!kind) return null;
		ctx.font = kind.font;
		const text = measureTextLines(lines, (t) => ctx.measureText(t).width);
		minPx = Math.max(minPx, text.minPx + kind.chromePx);
		maxPx = Math.max(maxPx, text.maxPx + kind.chromePx);
	}
	return { minPx, maxPx };
}

/** Room from the table's left edge to the pane's inner right edge, in px. */
export function availableWidthPx(table: HTMLElement): number {
	const pane = table.closest<HTMLElement>('.markdown-preview-view, .cm-scroller');
	const left = (scrollContainer(table) ?? table).getBoundingClientRect().left;
	if (!pane) return table.getBoundingClientRect().width;
	const right = pane.getBoundingClientRect().right - (Number.parseFloat(getComputedStyle(pane).paddingRight) || 0);
	return right - left;
}
