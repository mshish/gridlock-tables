/**
 * Which table is which: a table is identified by its file path and its index
 * among the file's tables. Reading view and Live Preview both count tables in
 * the Markdown source, so the same table gets the same key in either view.
 * No Obsidian imports -- testable in Node/vitest directly.
 */

/** Split a table row into cells on unescaped pipes, dropping outer pipes. */
function splitRow(line: string): string[] {
	let row = line.trim();
	if (row.startsWith('|')) row = row.slice(1);
	if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
	const cells: string[] = [];
	let start = 0;
	for (let i = 0; i < row.length; i++) {
		if (row[i] === '\\') i++;
		else if (row[i] === '|') {
			cells.push(row.slice(start, i));
			start = i + 1;
		}
	}
	cells.push(row.slice(start));
	return cells;
}

const DELIMITER_CELL = /^\s*:?-+:?\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

function isDelimiterRow(line: string, headerCells: number): boolean {
	const cells = splitRow(line);
	return cells.length === headerCells && cells.every((c) => DELIMITER_CELL.test(c));
}

/**
 * The 0-based header line of every top-level pipe table, in document order.
 * Skips frontmatter and fenced code. A table is a header line containing a
 * pipe followed by a delimiter row with the same number of cells.
 */
export function tableStartLines(lines: readonly string[]): number[] {
	const starts: number[] = [];
	let i = 0;
	if (lines[0]?.trim() === '---') {
		const end = lines.findIndex((l, n) => n > 0 && (l.trim() === '---' || l.trim() === '...'));
		if (end > 0) i = end + 1;
	}
	let fence: string | null = null;
	for (; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const open = FENCE.exec(line)?.[1];
		if (fence) {
			if (open && open[0] === fence[0] && open.length >= fence.length) fence = null;
			continue;
		}
		if (open) {
			fence = open;
			continue;
		}
		const next = lines[i + 1];
		if (
			next !== undefined &&
			line.includes('|') &&
			!line.trimStart().startsWith('>') &&
			isDelimiterRow(next, splitRow(line).length)
		) {
			starts.push(i);
			i++;
		}
	}
	return starts;
}

/** Index of the first table starting within [fromLine, toLine], or -1. */
export function tableIndexAt(starts: readonly number[], fromLine: number, toLine: number): number {
	return starts.findIndex((s) => s >= fromLine && s <= toLine);
}

export function tableKey(path: string, index: number): string {
	return `${path}#${index}`;
}

/** Move a file's table keys to its new path, or drop them when newPath is null. */
export function renameTableKeys<T>(
	record: Record<string, T>,
	oldPath: string,
	newPath: string | null,
): Record<string, T> {
	const prefix = `${oldPath}#`;
	const out: Record<string, T> = {};
	for (const [key, value] of Object.entries(record)) {
		if (!key.startsWith(prefix)) out[key] = value;
		else if (newPath !== null) out[`${newPath}#${key.slice(prefix.length)}`] = value;
	}
	return out;
}
