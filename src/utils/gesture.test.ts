import { describe, it, expect } from 'vitest';
import { columnEdgeAt, gestureEnd, startsGesture } from './gesture';

describe('startsGesture', () => {
	it('starts on the primary pointer with the main button', () => {
		expect(startsGesture({ button: 0, isPrimary: true })).toBe(true);
	});

	it('ignores a second finger and other buttons', () => {
		expect(startsGesture({ button: 0, isPrimary: false })).toBe(false);
		expect(startsGesture({ button: 2, isPrimary: true })).toBe(false);
	});
});

describe('columnEdgeAt', () => {
	const edges = [100, 180, 400];

	it('finds the edge from just inside the column or just past it', () => {
		expect(columnEdgeAt(edges, 96)).toBe(0);
		expect(columnEdgeAt(edges, 100)).toBe(0);
		expect(columnEdgeAt(edges, 103)).toBe(0);
		expect(columnEdgeAt(edges, 402)).toBe(2);
	});

	it('is -1 away from every edge', () => {
		expect(columnEdgeAt(edges, 94)).toBe(-1);
		expect(columnEdgeAt(edges, 104)).toBe(-1);
		expect(columnEdgeAt(edges, 50)).toBe(-1);
		expect(columnEdgeAt([], 10)).toBe(-1);
	});

	it('picks the nearer edge when two are in reach', () => {
		expect(columnEdgeAt([100, 104], 101)).toBe(0);
		expect(columnEdgeAt([100, 104], 103)).toBe(1);
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
