/**
 * Pinned widths stored in the note itself, as an HTML comment above the table:
 *
 *     <!-- gridlock-cols: 12ch auto 40ch -->
 *
 *     | Col A | Col B | Col C |
 *
 * One value per column, `Nch` for a pinned column and `auto` for one that stays
 * content-sized. The comment is inert in every other Markdown renderer, so the
 * widths travel with the note.
 *
 * A blank line separates the comment from the table: in Obsidian 1.14.4 a
 * comment on the line directly above a table stops Live Preview rendering it
 * as a table. A comment directly above is still read, and rewritten with the
 * blank line the next time the widths change.
 *
 * No Obsidian imports -- testable in Node/vitest directly.
 */
import { PinnedWidths, sanitizeWidths } from './columnWidths';
import { tableStartLines } from './tableKey';

const COMMENT = /^\s*<!--\s*gridlock-cols:\s*(.*?)\s*-->\s*$/;
const TOKEN = /^(\d+(?:\.\d+)?)ch$/;

/** The widths in a gridlock-cols comment line, or undefined if it is not one. */
export function parseWidthComment(line: string): PinnedWidths | undefined {
	const body = COMMENT.exec(line)?.[1];
	if (body === undefined) return undefined;
	const widths: PinnedWidths = [];
	for (const token of body.split(/\s+/).filter(Boolean)) {
		if (token === 'auto') {
			widths.push(null);
			continue;
		}
		const ch = TOKEN.exec(token)?.[1];
		if (ch === undefined) return undefined;
		widths.push(Number(ch));
	}
	return sanitizeWidths(widths);
}

/** A gridlock-cols comment for a table with `columnCount` columns. */
export function formatWidthComment(widths: PinnedWidths, columnCount: number): string {
	const values: string[] = [];
	for (let i = 0; i < columnCount; i++) {
		const w = widths[i];
		values.push(w === null || w === undefined ? 'auto' : `${w}ch`);
	}
	return `<!-- gridlock-cols: ${values.join(' ')} -->`;
}

/** Line of the comment belonging to the table starting at `start`, or -1. */
function commentLine(lines: readonly string[], start: number): number {
	if (start >= 1 && COMMENT.test(lines[start - 1] ?? '')) return start - 1;
	if (start >= 2 && (lines[start - 1] ?? '').trim() === '' && COMMENT.test(lines[start - 2] ?? '')) {
		return start - 2;
	}
	return -1;
}

/** Widths from the comment above each table, by table index. */
export function widthsFromComments(lines: readonly string[]): Map<number, PinnedWidths> {
	const out = new Map<number, PinnedWidths>();
	tableStartLines(lines).forEach((start, index) => {
		const at = commentLine(lines, start);
		const widths = at < 0 ? undefined : parseWidthComment(lines[at] ?? '');
		if (widths) out.set(index, widths);
	});
	return out;
}

/** Replace `deleteCount` whole lines from line `start` with `insert`. */
export interface LineEdit {
	start: number;
	deleteCount: number;
	insert: string[];
}

/**
 * The line edit that sets the comment above table `index` to `widths`: insert
 * it, replace it, or remove it (with its blank line) when nothing is pinned.
 * Null when the table does not exist or the comment already says this.
 */
export function widthCommentEdit(
	lines: readonly string[],
	index: number,
	widths: PinnedWidths,
): LineEdit | null {
	const start = tableStartLines(lines)[index];
	if (start === undefined) return null;
	const at = commentLine(lines, start);

	let insert: string[] = [];
	if (sanitizeWidths(widths)) {
		insert = [formatWidthComment(widths, widths.length), ''];
		if (at < 0 && start > 0 && (lines[start - 1] ?? '').trim() !== '') insert.unshift('');
	}
	// The comment and the blank line after it, when there is one.
	const edit = { start: at < 0 ? start : at, deleteCount: at < 0 ? 0 : start - at, insert };
	const current = lines.slice(edit.start, edit.start + edit.deleteCount);
	return current.join('\n') === insert.join('\n') ? null : edit;
}

/** `text` with the comment above table `index` set to `widths`. */
export function writeWidthComment(text: string, index: number, widths: PinnedWidths): string {
	const lines = text.split(/\r?\n/);
	const edit = widthCommentEdit(lines, index, widths);
	if (!edit) return text;
	lines.splice(edit.start, edit.deleteCount, ...edit.insert);
	return lines.join(text.includes('\r\n') ? '\r\n' : '\n');
}
