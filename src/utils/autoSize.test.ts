import { describe, it, expect } from 'vitest';
import { clampCol, distributeWidths } from './autoSize';

describe('clampCol', () => {
	it('respects global min', () => {
		const r = clampCol({ minCh: 2, maxCh: 10 }, 6, 60);
		expect(r.minCh).toBe(6);
	});

	it('respects global max', () => {
		const r = clampCol({ minCh: 6, maxCh: 80 }, 6, 60);
		expect(r.maxCh).toBe(60);
	});

	it('min never exceeds max after clamping', () => {
		const r = clampCol({ minCh: 2, maxCh: 4 }, 6, 60);
		expect(r.minCh).toBeLessThanOrEqual(r.maxCh);
	});
});

describe('distributeWidths', () => {
	it('returns max-content widths when they all fit', () => {
		const cols = [
			{ minCh: 6, maxCh: 10 },
			{ minCh: 6, maxCh: 20 },
		];
		const result = distributeWidths(cols, { availableCh: 80 });
		expect(result).toEqual([10, 20]);
	});

	it('returns mins when even mins overflow', () => {
		const cols = [
			{ minCh: 30, maxCh: 60 },
			{ minCh: 30, maxCh: 60 },
		];
		const result = distributeWidths(cols, { availableCh: 40 });
		expect(result).toEqual([30, 30]);
	});

	it('distributes remaining space proportionally', () => {
		const cols = [
			{ minCh: 6, maxCh: 20 }, // slack 14
			{ minCh: 6, maxCh: 6 },  // slack 0
		];
		// sumMin=12, sumMax=26, available=20 => remaining=8, totalSlack=14
		// col0 gets 6 + (14/14)*8 = 14, col1 gets 6 + 0 = 6
		const result = distributeWidths(cols, { availableCh: 20 });
		expect(result[0]).toBeCloseTo(14);
		expect(result[1]).toBeCloseTo(6);
	});

	it('total output equals availableCh when in distribution range', () => {
		const cols = [
			{ minCh: 6, maxCh: 30 },
			{ minCh: 6, maxCh: 30 },
			{ minCh: 6, maxCh: 30 },
		];
		const available = 50;
		const result = distributeWidths(cols, { availableCh: available });
		const total = result.reduce((s, w) => s + w, 0);
		expect(total).toBeCloseTo(available);
	});
});

describe('long unbreakable content', () => {
	it('clampCol never leaves min above the global max', () => {
		expect(clampCol({ minCh: 200, maxCh: 200 }, 6, 60)).toEqual({ minCh: 60, maxCh: 60 });
	});

	it('a long-URL column stays at the global max even when space is tight', () => {
		const result = distributeWidths(
			[
				{ minCh: 10, maxCh: 10 },
				{ minCh: 200, maxCh: 200 },
			],
			{ availableCh: 30, globalMinCh: 6, globalMaxCh: 60 },
		);
		expect(result[1]).toBe(60);
	});
});
