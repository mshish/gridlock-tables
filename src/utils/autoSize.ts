/**
 * Pure auto-sizing algorithm for table columns.
 * No Obsidian imports -- testable in Node/vitest directly.
 *
 * Algorithm (CSS 2.1 table distribution):
 * 1. Clamp each column to [minCh, maxCh].
 * 2. If sum of maxCh fits in available width, use max-content widths.
 * 3. Otherwise give each column its min, distribute remaining space
 *    proportional to (max - min).
 * 4. If even mins overflow available width, let it overflow (horizontal scroll).
 */

export interface ColSpec {
	minCh: number;
	maxCh: number;
}

export interface AutoSizeOptions {
	/** Available container width in ch units */
	availableCh: number;
	/** Global minimum column width in ch */
	globalMinCh?: number;
	/** Global maximum column width in ch */
	globalMaxCh?: number;
}

const DEFAULT_MIN_CH = 6;
const DEFAULT_MAX_CH = 60;

/**
 * Clamp a measured column to [minCh, maxCh] from options or defaults.
 */
export function clampCol(
	measured: ColSpec,
	globalMinCh = DEFAULT_MIN_CH,
	globalMaxCh = DEFAULT_MAX_CH,
): ColSpec {
	const maxCh = Math.min(Math.max(measured.maxCh, globalMinCh), globalMaxCh);
	return {
		// An unbreakable string (a long URL) has a min-content as wide as itself;
		// capping min at max keeps globalMaxCh a hard ceiling when space is tight.
		minCh: Math.min(Math.max(measured.minCh, globalMinCh), maxCh),
		maxCh,
	};
}

/**
 * Distribute available width across columns using the CSS 2.1 algorithm.
 * Returns an array of final widths in ch units (one per column).
 * A returned width may exceed availableCh when the sum of mins does too
 * (overflow case -- let the table scroll).
 */
export function distributeWidths(
	cols: ColSpec[],
	opts: AutoSizeOptions,
): number[] {
	const { availableCh } = opts;
	const globalMinCh = opts.globalMinCh ?? DEFAULT_MIN_CH;
	const globalMaxCh = opts.globalMaxCh ?? DEFAULT_MAX_CH;

	const clamped = cols.map((c) => clampCol(c, globalMinCh, globalMaxCh));

	const sumMax = clamped.reduce((s, c) => s + c.maxCh, 0);
	if (sumMax <= availableCh) {
		// All columns fit at max-content -- no wrapping needed.
		return clamped.map((c) => c.maxCh);
	}

	const sumMin = clamped.reduce((s, c) => s + c.minCh, 0);
	if (sumMin >= availableCh) {
		// Even mins overflow -- return mins and let the table scroll.
		return clamped.map((c) => c.minCh);
	}

	// Distribute remaining space proportional to (max - min).
	const remaining = availableCh - sumMin;
	const totalSlack = clamped.reduce((s, c) => s + (c.maxCh - c.minCh), 0);

	return clamped.map((c) => {
		const slack = c.maxCh - c.minCh;
		const share = totalSlack > 0 ? (slack / totalSlack) * remaining : 0;
		return c.minCh + share;
	});
}
