import { describe, it, expect } from 'vitest';
import { canMeasureAsText, measureTextLines } from './textMetrics';

/** 8px per character, like a monospace font. */
const mono = (s: string) => s.length * 8;

const NBSP = String.fromCharCode(0xa0);
const EM_DASH = String.fromCharCode(0x2014);
const TAB = String.fromCharCode(0x09);
const CJK = String.fromCharCode(0x8868, 0x683c, 0x306e, 0x5217);
const LATIN_1 = `Caf${String.fromCharCode(0xe9)} r${String.fromCharCode(0xe9)}sum${String.fromCharCode(0xe9)}`;

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
		expect(measureTextLines(['  word  ', ''], mono)).toEqual({ minPx: 32, maxPx: 32 });
		expect(measureTextLines([], mono)).toEqual({ minPx: 0, maxPx: 0 });
	});

	it('can wrap after a hyphen, as browsers wrap a date', () => {
		expect(measureTextLines(['2026-10-08'], mono)).toEqual({ minPx: 5 * 8, maxPx: 10 * 8 });
	});

	it('does not wrap at a non-breaking space', () => {
		expect(measureTextLines([`10${NBSP}kg`], mono)).toEqual({ minPx: 5 * 8, maxPx: 5 * 8 });
	});
});

describe('canMeasureAsText', () => {
	it('accepts Latin text', () => {
		expect(canMeasureAsText(`${LATIN_1}, 2026-10-08`)).toBe(true);
	});

	it('rejects scripts and characters it cannot model', () => {
		expect(canMeasureAsText(CJK)).toBe(false); // breaks between characters
		expect(canMeasureAsText(`a${EM_DASH}b`)).toBe(false);
		expect(canMeasureAsText(`a${TAB}b`)).toBe(false); // tab width
	});
});
