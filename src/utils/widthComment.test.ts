import { describe, it, expect } from 'vitest';
import {
	formatWidthComment,
	parseWidthComment,
	widthsFromComments,
	writeWidthComment,
} from './widthComment';

const TABLE = ['| A | B | C |', '|---|---|---|', '| 1 | 2 | 3 |'];

describe('parseWidthComment', () => {
	it('reads ch widths and auto columns', () => {
		expect(parseWidthComment('<!-- gridlock-cols: 12ch auto 40.5ch -->')).toEqual([12, null, 40.5]);
	});

	it('tolerates surrounding whitespace', () => {
		expect(parseWidthComment('  <!--gridlock-cols:  8ch   auto -->  ')).toEqual([8, null]);
	});

	it('rejects px and unknown tokens', () => {
		expect(parseWidthComment('<!-- gridlock-cols: 120px auto -->')).toBeUndefined();
		expect(parseWidthComment('<!-- gridlock-cols: wide -->')).toBeUndefined();
	});

	it('ignores other comments and an all-auto comment', () => {
		expect(parseWidthComment('<!-- note to self -->')).toBeUndefined();
		expect(parseWidthComment('<!-- gridlock-cols: auto auto -->')).toBeUndefined();
	});
});

describe('formatWidthComment', () => {
	it('writes one value per column, auto for unpinned', () => {
		expect(formatWidthComment([12, null, 40.5], 3)).toBe('<!-- gridlock-cols: 12ch auto 40.5ch -->');
	});

	it('pads missing columns with auto', () => {
		expect(formatWidthComment([12], 3)).toBe('<!-- gridlock-cols: 12ch auto auto -->');
	});
});

describe('widthsFromComments', () => {
	it('maps each table index to the comment above it', () => {
		const lines = ['<!-- gridlock-cols: 10ch auto auto -->', '', ...TABLE, '', ...TABLE];
		const widths = widthsFromComments(lines);
		expect(widths.get(0)).toEqual([10, null, null]);
		expect(widths.has(1)).toBe(false);
	});

	it('also reads a comment directly above the table', () => {
		expect(widthsFromComments(['<!-- gridlock-cols: 5ch auto auto -->', ...TABLE]).get(0)).toEqual([
			5,
			null,
			null,
		]);
	});

	it('does not reach past text between the comment and the table', () => {
		const lines = ['<!-- gridlock-cols: 5ch auto auto -->', 'Some text.', '', ...TABLE];
		expect(widthsFromComments(lines).has(0)).toBe(false);
	});
});

describe('writeWidthComment', () => {
	it('inserts the comment and a blank line above the table', () => {
		const text = ['Intro.', '', ...TABLE, ''].join('\n');
		expect(writeWidthComment(text, 0, [12, null, null])).toBe(
			['Intro.', '', '<!-- gridlock-cols: 12ch auto auto -->', '', ...TABLE, ''].join('\n'),
		);
	});

	it('replaces an existing comment in place', () => {
		const text = ['<!-- gridlock-cols: 12ch auto auto -->', '', ...TABLE].join('\n');
		expect(writeWidthComment(text, 0, [12, 20, null])).toBe(
			['<!-- gridlock-cols: 12ch 20ch auto -->', '', ...TABLE].join('\n'),
		);
	});

	it('removes the comment and its blank line when nothing is pinned', () => {
		const text = ['Intro.', '', '<!-- gridlock-cols: 12ch auto auto -->', '', ...TABLE].join('\n');
		expect(writeWidthComment(text, 0, [null, null, null])).toBe(['Intro.', '', ...TABLE].join('\n'));
	});

	it('targets the right table by index and keeps CRLF line endings', () => {
		const text = [...TABLE, '', 'Between.', '', ...TABLE].join('\r\n');
		expect(writeWidthComment(text, 1, [null, 7, null])).toBe(
			[...TABLE, '', 'Between.', '', '<!-- gridlock-cols: auto 7ch auto -->', '', ...TABLE].join('\r\n'),
		);
	});

	it('leaves the text alone when the table does not exist', () => {
		const text = TABLE.join('\n');
		expect(writeWidthComment(text, 3, [5, null, null])).toBe(text);
	});

	it('puts a table at the top of the file below its comment', () => {
		expect(writeWidthComment(TABLE.join('\n'), 0, [5, null, null])).toBe(
			['<!-- gridlock-cols: 5ch auto auto -->', '', ...TABLE].join('\n'),
		);
	});
});
