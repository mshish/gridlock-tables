/**
 * Resize-handle gesture rules. No Obsidian imports -- testable in Node/vitest.
 */

/** Only the primary pointer's main button starts a gesture, so a second finger cannot start a parallel one. */
export function startsGesture(evt: { button: number; isPrimary: boolean }): boolean {
	return evt.isPrimary && evt.button === 0;
}

/** How close to a column's right edge, in px, a mouse grabs it from any row: a little inside the column, a little past the edge. */
export const EDGE_ZONE = { inside: 5, outside: 3 };

/**
 * The column whose right edge `x` is on, given each column's right edge in
 * order, or -1. Where narrow columns put two edges in reach, the nearer wins.
 */
export function columnEdgeAt(rightEdges: readonly number[], x: number, zone = EDGE_ZONE): number {
	let found = -1;
	let nearest = Infinity;
	rightEdges.forEach((edge, i) => {
		const offset = x - edge;
		if (offset < -zone.inside || offset > zone.outside || Math.abs(offset) >= nearest) return;
		found = i;
		nearest = Math.abs(offset);
	});
	return found;
}

/**
 * What a finished gesture does. A pointerup commits a drag or counts as a
 * tap; a cancel (pointercancel, or capture lost because the handle went away)
 * reverts to the stored widths and neither saves nor counts as a tap.
 */
export function gestureEnd(ending: 'up' | 'cancel', moved: boolean): 'commit' | 'tap' | 'revert' {
	if (ending === 'cancel') return 'revert';
	return moved ? 'commit' : 'tap';
}
