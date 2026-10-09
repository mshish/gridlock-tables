import { describe, it, expect } from 'vitest';
import {
	renameTableKeys,
	tableIndexAt,
	tableKey,
	tableStartLines,
} from './tableKey';

const doc = [
	'---', // 0
	'title: x | y', // 1
	'---', // 2
	'| A | B |', // 3  table 0
	'|---|---|', // 4
	'| 1 | 2 |', // 5
	'', // 6
	'```', // 7
	'| not | a table |', // 8
	'|---|---|', // 9
	'```', // 10
	'Left | Right', // 11 table 1, no outer pipes
	':--- | ---:', // 12
	'a | b', // 13
	'', // 14
	'> | quoted | table |', // 15 not top-level
	'> |---|---|', // 16
];

describe('tableStartLines', () => {
	it('finds the header line of every top-level table, skipping frontmatter and code', () => {
		expect(tableStartLines(doc)).toEqual([3, 11]);
	});

	it('needs a header row before the delimiter row', () => {
		expect(tableStartLines(['', '|---|---|'])).toEqual([]);
		expect(tableStartLines(['---', '|---|'])).toEqual([]);
	});

	it('ignores a rule line that is not a table delimiter', () => {
		expect(tableStartLines(['Some | text', '---'])).toEqual([]);
	});
});

describe('tableIndexAt', () => {
	it('returns the index of the first table starting in the line range', () => {
		expect(tableIndexAt([3, 11], 3, 5)).toBe(0);
		expect(tableIndexAt([3, 11], 11, 13)).toBe(1);
	});

	it('returns -1 when no table starts in the range', () => {
		expect(tableIndexAt([3, 11], 6, 10)).toBe(-1);
	});
});

describe('tableKey', () => {
	it('joins the file path and table index', () => {
		expect(tableKey('notes/a.md', 2)).toBe('notes/a.md#2');
	});
});

describe('renameTableKeys', () => {
	it('moves every key of the old path to the new path', () => {
		const record = { 'a.md#0': [1], 'a.md#1': [2], 'ab.md#0': [3] };
		expect(renameTableKeys(record, 'a.md', 'b.md')).toEqual({
			'b.md#0': [1],
			'b.md#1': [2],
			'ab.md#0': [3],
		});
	});

	it('drops the keys when there is no new path', () => {
		expect(renameTableKeys({ 'a.md#0': [1], 'c.md#0': [2] }, 'a.md', null)).toEqual({
			'c.md#0': [2],
		});
	});
});
