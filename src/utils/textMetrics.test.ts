import { describe, it, expect } from 'vitest';
import { measureTextLines } from './textMetrics';

/** 8px per character, like a monospace font. */
const mono = (s: string) => s.length * 8;

describe('measureTextLines', () => {
	it('max-content is the widest line, min-content the widest word', () => {
		expect(measureTextLines(['short', 'a much longer line'], mono)).toEqual({
			minPx: 6 * 8, // "longer"
			maxPx: 18 * 8,
		});
	});

	it('an unbreakable string is both its min and max', () => {
		const url = 'https://example.com/a/very/long/path';
		expect(measureTextLines([url], mono)).toEqual({ minPx: url.length * 8, maxPx: url.length * 8 });
	});

	it('ignores surrounding whitespace and empty cells', () => {
		expect(measureTextLines(['  2026-10-08  ', ''], mono)).toEqual({ minPx: 80, maxPx: 80 });
		expect(measureTextLines([], mono)).toEqual({ minPx: 0, maxPx: 0 });
	});
});
