import { describe, it, expect } from 'vitest';
import {
	MAX_PIN_CH,
	MIN_PIN_CH,
	autoFitCh,
	colgroupWidths,
	dragWidthCh,
	freezeColumns,
	hasPins,
	isDoubleTap,
	pinColumn,
	pxToCh,
	sanitizeWidths,
} from './columnWidths';

describe('pxToCh', () => {
	it('divides by the measured ch width and rounds to a tenth', () => {
		expect(pxToCh(86.25, 8.625)).toBe(10);
		expect(pxToCh(100, 8.625)).toBe(11.6);
	});

	it('returns 0 for an unusable ch width', () => {
		expect(pxToCh(100, 0)).toBe(0);
		expect(pxToCh(100, Number.NaN)).toBe(0);
	});
});

describe('dragWidthCh', () => {
	it('adds the pointer delta, converted to ch, to the start width', () => {
		expect(dragWidthCh(10, 86.25, 8.625)).toBe(20);
		expect(dragWidthCh(20, -43.125, 8.625)).toBe(15);
	});

	it('clamps to the pin range', () => {
		expect(dragWidthCh(5, -1000, 8)).toBe(MIN_PIN_CH);
		expect(dragWidthCh(5, 100000, 8)).toBe(MAX_PIN_CH);
	});
});

describe('pinColumn', () => {
	it('pins one column and leaves the others unpinned', () => {
		expect(pinColumn([], 1, 12, 3)).toEqual([null, 12, null]);
	});

	it('keeps existing pins and resizes to the column count', () => {
		expect(pinColumn([8, null, 30, 40], 1, 12, 3)).toEqual([8, 12, 30]);
	});

	it('ignores an out-of-range column', () => {
		expect(pinColumn([8], 5, 12, 2)).toEqual([8, null]);
	});
});

describe('freezeColumns', () => {
	it('pins every unpinned column at its rendered width', () => {
		expect(freezeColumns([], [6.04, 22.5, 61.3], 3)).toEqual([6, 22.5, 61.3]);
	});

	it('keeps existing pins instead of the rendered width', () => {
		expect(freezeColumns([8, null, 30], [9.4, 22.5, 31.2], 3)).toEqual([8, 22.5, 30]);
	});

	it('clamps to the pin range and sizes to the column count', () => {
		expect(freezeColumns([null, null, 5, 7], [0, 1000, 4], 3)).toEqual([MIN_PIN_CH, MAX_PIN_CH, 5]);
	});

	it('leaves a column with no measurement unpinned', () => {
		expect(freezeColumns([], [12], 2)).toEqual([12, null]);
	});
});

describe('colgroupWidths', () => {
	it('gives pinned columns a ch width and unpinned columns none', () => {
		expect(colgroupWidths([12, null, 7.5], 4)).toEqual(['12ch', null, '7.5ch', null]);
	});

	it('drops pins past the last column', () => {
		expect(colgroupWidths([12, 20, 30], 2)).toEqual(['12ch', '20ch']);
	});
});

describe('hasPins', () => {
	it('is true only when a column within the table is pinned', () => {
		expect(hasPins([null, null], 2)).toBe(false);
		expect(hasPins([null, 9], 2)).toBe(true);
		expect(hasPins([null, null, 9], 2)).toBe(false);
	});
});

describe('sanitizeWidths', () => {
	it('keeps finite in-range numbers and nulls everything else', () => {
		expect(sanitizeWidths([12, 'x', -1, null, 9999, 7.25])).toEqual([12, null, null, null, null, 7.3]);
	});

	it('returns undefined for non-arrays and arrays without a pin', () => {
		expect(sanitizeWidths('12ch')).toBeUndefined();
		expect(sanitizeWidths([null, 'a'])).toBeUndefined();
	});
});

describe('autoFitCh', () => {
	it('fits a column to its max-content width when it fits', () => {
		expect(
			autoFitCh({ minCh: 8, maxCh: 20 }, { availableCh: 100, globalMinCh: 6, globalMaxCh: 60 }),
		).toBe(20);
	});

	it('clamps a long column to the global maximum', () => {
		expect(
			autoFitCh({ minCh: 10, maxCh: 200 }, { availableCh: 500, globalMinCh: 6, globalMaxCh: 60 }),
		).toBe(60);
	});

	it('wraps down to the available room but never below min-content', () => {
		expect(
			autoFitCh({ minCh: 10, maxCh: 50 }, { availableCh: 30, globalMinCh: 6, globalMaxCh: 60 }),
		).toBe(30);
		expect(
			autoFitCh({ minCh: 10, maxCh: 50 }, { availableCh: 4, globalMinCh: 6, globalMaxCh: 60 }),
		).toBe(10);
	});
});

describe('isDoubleTap', () => {
	const first = { time: 1000, x: 50, y: 10 };

	it('accepts a second tap that is quick and close', () => {
		expect(isDoubleTap(first, { time: 1300, x: 53, y: 12 })).toBe(true);
	});

	it('rejects a slow, distant or missing first tap', () => {
		expect(isDoubleTap(first, { time: 1600, x: 50, y: 10 })).toBe(false);
		expect(isDoubleTap(first, { time: 1100, x: 80, y: 10 })).toBe(false);
		expect(isDoubleTap(undefined, { time: 1100, x: 50, y: 10 })).toBe(false);
	});
});
