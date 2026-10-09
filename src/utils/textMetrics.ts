/**
 * Text measurement for auto-fit without reflowing the table. Plain-text cells
 * are measured with canvas measureText; this is the font-independent part.
 * No Obsidian imports -- testable in Node/vitest directly.
 */

/**
 * Text whose line-break opportunities this module models: printable Basic
 * Latin (U+0020-U+007E) and Latin-1 (U+00A0-U+00FF). Other scripts break in
 * ways a split cannot model (CJK and Thai between characters, en and em dashes
 * per UAX #14) and a tab is wider than canvas draws it, so cells holding them
 * are measured by laying the table out instead.
 */
const MODELLED_TEXT = new RegExp(
	`^[${String.fromCharCode(0x20)}-${String.fromCharCode(0x7e)}${String.fromCharCode(0xa0)}-${String.fromCharCode(0xff)}]*$`,
);

/** CSS breaks at these; not at a non-breaking space (U+00A0). */
const BREAKING_SPACE = /[ \t\n\f\r]+/;
const EDGE_SPACE = /^[ \t\n\f\r]+|[ \t\n\f\r]+$/g;

export function canMeasureAsText(line: string): boolean {
	return MODELLED_TEXT.test(line);
}

/** The pieces a line can wrap into: split at spaces, and after each hyphen. */
function unbreakablePieces(line: string): string[] {
	return line
		.split(BREAKING_SPACE)
		.flatMap((word) => word.replace(/-/g, '-\n').split('\n'))
		.filter(Boolean);
}

/**
 * Min- and max-content widths of a cell's lines of text, in px, given a
 * function measuring one string in the cell's font. Max-content is the widest
 * line; min-content is the widest piece the line can wrap into.
 */
export function measureTextLines(
	lines: readonly string[],
	measure: (text: string) => number,
): { minPx: number; maxPx: number } {
	let minPx = 0;
	let maxPx = 0;
	for (const line of lines) {
		const text = line.replace(EDGE_SPACE, '');
		if (!text) continue;
		maxPx = Math.max(maxPx, measure(text));
		for (const piece of unbreakablePieces(text)) minPx = Math.max(minPx, measure(piece));
	}
	return { minPx, maxPx };
}
