/**
 * Resize-handle gesture rules. No Obsidian imports -- testable in Node/vitest.
 */

/** Only the primary pointer's main button starts a gesture, so a second finger cannot start a parallel one. */
export function startsGesture(evt: { button: number; isPrimary: boolean }): boolean {
	return evt.isPrimary && evt.button === 0;
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
