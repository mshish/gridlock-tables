/**
 * Global column width limits, applied as CSS variables.
 * No Obsidian imports -- testable in Node/vitest directly.
 *
 * The plugin writes the user's limits to plugin-private variables on <body>;
 * styles.css maps them onto Obsidian's --table-column-min-width and
 * --table-column-max-width only under body.gridlock-tables-enabled, so turning
 * the plugin off restores Obsidian's own values without removing anything.
 */

export const DEFAULT_COLUMN_MIN_CH = 6;
export const DEFAULT_COLUMN_MAX_CH = 60;

/** Slider range for both limits, in ch. */
export const COLUMN_LIMIT_RANGE = { min: 4, max: 120 } as const;

export const COLUMN_MIN_VAR = '--gridlock-col-min';
export const COLUMN_MAX_VAR = '--gridlock-col-max';

function clampToRange(value: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(
		Math.max(Math.round(value), COLUMN_LIMIT_RANGE.min),
		COLUMN_LIMIT_RANGE.max,
	);
}

/**
 * CSS variable values for the given limits. The max is raised to the min when
 * the two sliders cross, so a column can never be asked to be narrower than
 * its own minimum.
 */
export function columnLimitVars(
	minCh: number,
	maxCh: number,
): Record<typeof COLUMN_MIN_VAR | typeof COLUMN_MAX_VAR, string> {
	const min = clampToRange(minCh, DEFAULT_COLUMN_MIN_CH);
	const max = Math.max(clampToRange(maxCh, DEFAULT_COLUMN_MAX_CH), min);
	return {
		[COLUMN_MIN_VAR]: `${min}ch`,
		[COLUMN_MAX_VAR]: `${max}ch`,
	};
}
