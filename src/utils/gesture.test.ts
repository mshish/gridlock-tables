import { describe, it, expect } from 'vitest';
import { gestureEnd, startsGesture } from './gesture';

describe('startsGesture', () => {
	it('starts on the primary pointer with the main button', () => {
		expect(startsGesture({ button: 0, isPrimary: true })).toBe(true);
	});

	it('ignores a second finger and other buttons', () => {
		expect(startsGesture({ button: 0, isPrimary: false })).toBe(false);
		expect(startsGesture({ button: 2, isPrimary: true })).toBe(false);
	});
});

describe('gestureEnd', () => {
	it('commits a drag that ends with pointerup', () => {
		expect(gestureEnd('up', true)).toBe('commit');
	});

	it('counts a pointerup without movement as a tap', () => {
		expect(gestureEnd('up', false)).toBe('tap');
	});

	it('reverts a cancelled drag or tap without saving or tapping', () => {
		expect(gestureEnd('cancel', true)).toBe('revert');
		expect(gestureEnd('cancel', false)).toBe('revert');
	});
});
