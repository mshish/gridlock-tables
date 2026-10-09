/**
 * Text measurement for auto-fit without reflowing the table. Plain-text cells
 * are measured with canvas measureText; this is the font-independent part.
 * No Obsidian imports -- testable in Node/vitest directly.
 */

/**
 * Min- and max-content widths of a cell's lines of text, in px, given a
 * function measuring one string in the cell's font. Max-content is the widest
 * line; min-content is the widest word, since lines wrap only at whitespace.
 */
export function measureTextLines(
	lines: readonly string[],
	measure: (text: string) => number,
): { minPx: number; maxPx: number } {
	let minPx = 0;
	let maxPx = 0;
	for (const line of lines) {
		const text = line.trim();
		if (!text) continue;
		maxPx = Math.max(maxPx, measure(text));
		for (const word of text.split(/\s+/)) minPx = Math.max(minPx, measure(word));
	}
	return { minPx, maxPx };
}
