/**
 * Pinned column widths: px-to-ch conversion, drag math, colgroup values and
 * auto-fit. No Obsidian imports -- testable in Node/vitest directly.
 *
 * Widths are stored and applied in ch only. A table's pins are an array with
 * one entry per column: a width in ch for a pinned column, null for a column
 * that stays content-sized.
 */
import { ColSpec, distributeWidths } from './autoSize';

export type PinnedWidths = (number | null)[];

/** Narrowest and widest a dragged column may be pinned, in ch. */
export const MIN_PIN_CH = 1;
export const MAX_PIN_CH = 300;

/** Widths are kept to a tenth of a ch: finer steps are invisible. */
function roundCh(ch: number): number {
	return Math.round(ch * 10) / 10;
}

function clampPin(ch: number): number {
	return Math.min(Math.max(ch, MIN_PIN_CH), MAX_PIN_CH);
}

/** Convert a measured pixel length to ch, given the px width of 1ch. */
export function pxToCh(px: number, chPx: number): number {
	if (!Number.isFinite(chPx) || chPx <= 0) return 0;
	return roundCh(px / chPx);
}

/** The width a column is dragged to: its start width plus the pointer delta. */
export function dragWidthCh(startCh: number, deltaPx: number, chPx: number): number {
	return roundCh(clampPin(startCh + pxToCh(deltaPx, chPx)));
}

/** Pins one column, keeping the others, sized to the table's column count. */
export function pinColumn(
	widths: PinnedWidths,
	col: number,
	ch: number,
	columnCount: number,
): PinnedWidths {
	const next: PinnedWidths = [];
	for (let i = 0; i < columnCount; i++) {
		next.push(i === col ? roundCh(clampPin(ch)) : (widths[i] ?? null));
	}
	return next;
}

/** True when any column inside the table is pinned. */
export function hasPins(widths: PinnedWidths, columnCount: number): boolean {
	return widths.slice(0, columnCount).some((w) => w !== null);
}

/** The width each <col> gets: `Nch` for a pinned column, null for the rest. */
export function colgroupWidths(widths: PinnedWidths, columnCount: number): (string | null)[] {
	const out: (string | null)[] = [];
	for (let i = 0; i < columnCount; i++) {
		const w = widths[i];
		out.push(w === null || w === undefined ? null : `${w}ch`);
	}
	return out;
}

/**
 * Validate pins read back from storage. Anything that is not a finite width in
 * the pin range becomes unpinned; a table with no pin left is undefined.
 */
export function sanitizeWidths(raw: unknown): PinnedWidths | undefined {
	if (!Array.isArray(raw)) return undefined;
	const widths = raw.map((w: unknown) =>
		typeof w === 'number' && Number.isFinite(w) && w >= MIN_PIN_CH && w <= MAX_PIN_CH
			? roundCh(w)
			: null,
	);
	return widths.some((w) => w !== null) ? widths : undefined;
}

export interface AutoFitOptions {
	/** Room for this column: the table's available width less the other columns, in ch. */
	availableCh: number;
	/** Column limits in ch, in the same box as the measurement. */
	globalMinCh: number;
	globalMaxCh: number;
}

/**
 * Auto-fit one column (double-click): its max-content width, clamped to the
 * limits, and wrapped down toward min-content if the table would otherwise
 * run past the room it has. The same distribution as autoSize, for one column.
 */
export function autoFitCh(measured: ColSpec, opts: AutoFitOptions): number {
	const [width] = distributeWidths([measured], {
		availableCh: Math.max(opts.availableCh, 0),
		globalMinCh: opts.globalMinCh,
		globalMaxCh: opts.globalMaxCh,
	});
	return roundCh(clampPin(width ?? measured.maxCh));
}

export interface Tap {
	time: number;
	x: number;
	y: number;
}

const DOUBLE_TAP_MS = 400;
const DOUBLE_TAP_SLOP_PX = 10;

/**
 * Whether a tap completes a double tap. Detected from pointer events rather
 * than dblclick so a double tap on a touch screen auto-fits too.
 */
export function isDoubleTap(previous: Tap | undefined, tap: Tap): boolean {
	if (!previous) return false;
	return (
		tap.time - previous.time <= DOUBLE_TAP_MS &&
		Math.abs(tap.x - previous.x) <= DOUBLE_TAP_SLOP_PX &&
		Math.abs(tap.y - previous.y) <= DOUBLE_TAP_SLOP_PX
	);
}
