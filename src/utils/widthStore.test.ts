import { describe, it, expect, vi } from 'vitest';
import { NoteWidthStore, RecordWidthStore } from './widthStore';

describe('RecordWidthStore', () => {
	it('loads only valid entries from persisted data', () => {
		const store = new RecordWidthStore({ 'a.md#0': [12, null], 'a.md#1': 'junk', 'b.md#0': [null] }, () => undefined);
		expect(store.get('a.md#0')).toEqual([12, null]);
		expect(store.get('a.md#1')).toBeUndefined();
		expect(store.get('b.md#0')).toBeUndefined();
		expect(store.toJSON()).toEqual({ 'a.md#0': [12, null] });
	});

	it('loads nothing from data that is not a record', () => {
		expect(new RecordWidthStore(undefined, () => undefined).toJSON()).toEqual({});
		expect(new RecordWidthStore([1, 2], () => undefined).toJSON()).toEqual({});
	});

	it('persists sets and deletes a table whose pins are all cleared', () => {
		const persist = vi.fn();
		const store = new RecordWidthStore({}, persist);
		store.set('a.md#0', [null, 9]);
		expect(store.get('a.md#0')).toEqual([null, 9]);
		store.set('a.md#0', [null, null]);
		expect(store.get('a.md#0')).toBeUndefined();
		expect(persist).toHaveBeenCalledTimes(2);
	});

	it('follows a file rename and drops a deleted file', () => {
		const persist = vi.fn();
		const store = new RecordWidthStore({ 'a.md#0': [5], 'c.md#0': [6] }, persist);
		store.renameFile('a.md', 'b.md');
		expect(store.get('b.md#0')).toEqual([5]);
		store.renameFile('c.md', null);
		expect(store.toJSON()).toEqual({ 'b.md#0': [5] });
		expect(persist).toHaveBeenCalledTimes(2);
	});

	it('does not persist a rename that touches no table', () => {
		const persist = vi.fn();
		new RecordWidthStore({ 'a.md#0': [5] }, persist).renameFile('x.md', 'y.md');
		expect(persist).not.toHaveBeenCalled();
	});
});

describe('NoteWidthStore', () => {
	const TABLE = ['| A | B |', '|---|---|', '| 1 | 2 |'];
	const make = (inNote = true, raw: unknown = {}, written = true) => {
		const persist = vi.fn();
		const write = vi.fn(() => Promise.resolve(written));
		const record = new RecordWidthStore(raw, persist);
		const store = new NoteWidthStore(record, write, () => inNote);
		return { store, record, write, persist };
	};

	it('reads pins from the comments in the note source', () => {
		const { store } = make();
		store.observe('a.md', ['<!-- gridlock-cols: 9ch auto -->', '', ...TABLE]);
		expect(store.get('a.md#0')).toEqual([9, null]);
	});

	it('forgets a pin when its comment is removed from the note', () => {
		const { store } = make();
		store.observe('a.md', ['<!-- gridlock-cols: 9ch auto -->', '', ...TABLE]);
		store.observe('a.md', TABLE);
		expect(store.get('a.md#0')).toBeUndefined();
	});

	it('writes pins to the note and drops an older data.json entry once written', async () => {
		const { store, record, write } = make(true, { 'a.md#0': [4, null] });
		store.set('a.md#0', [null, 12]);
		expect(write).toHaveBeenCalledWith('a.md', 0, [null, 12]);
		expect(store.get('a.md#0')).toEqual([null, 12]);
		expect(record.get('a.md#0')).toEqual([4, null]);
		await Promise.resolve();
		expect(record.get('a.md#0')).toBeUndefined();
	});

	it('keeps the data.json entry and the old width when the note write fails', async () => {
		const { store, record } = make(true, { 'a.md#0': [4, null] }, false);
		store.set('a.md#0', [null, 12]);
		await Promise.resolve();
		expect(record.get('a.md#0')).toEqual([4, null]);
		expect(store.get('a.md#0')).toEqual([4, null]);
	});

	it('never hides a width when the storage setting changes', () => {
		let inNote = true;
		const record = new RecordWidthStore({ 'b.md#0': [6, null] }, () => undefined);
		const store = new NoteWidthStore(record, () => Promise.resolve(true), () => inNote);
		store.observe('a.md', ['<!-- gridlock-cols: 9ch auto -->', '', ...TABLE]);
		inNote = false;
		expect(store.get('a.md#0')).toEqual([9, null]);
		expect(store.get('b.md#0')).toEqual([6, null]);
	});

	it('removes the comment when every pin is cleared', () => {
		const { store, write } = make();
		store.set('a.md#0', [null, null]);
		expect(write).toHaveBeenCalledWith('a.md', 0, []);
		expect(store.get('a.md#0')).toBeUndefined();
	});

	it('falls back to data.json for a table without a comment', () => {
		const { store } = make(true, { 'a.md#0': [4, null] });
		store.observe('a.md', TABLE);
		expect(store.get('a.md#0')).toEqual([4, null]);
	});

	it('saves to data.json, and prefers it, when notes are not written', () => {
		const { store, record, write } = make(false);
		store.observe('a.md', ['<!-- gridlock-cols: 9ch auto -->', '', ...TABLE]);
		expect(store.get('a.md#0')).toEqual([9, null]);
		store.set('a.md#0', [7, null]);
		expect(write).not.toHaveBeenCalled();
		expect(record.get('a.md#0')).toEqual([7, null]);
		expect(store.get('a.md#0')).toEqual([7, null]);
	});

	it('does not confuse a note with one whose path extends it', () => {
		const { store } = make();
		store.observe('a.md', ['<!-- gridlock-cols: 9ch auto -->', '', ...TABLE]);
		store.observe('a.md#x.md', ['<!-- gridlock-cols: 3ch auto -->', '', ...TABLE]);
		store.observe('a.md', TABLE);
		expect(store.get('a.md#x.md#0')).toEqual([3, null]);
	});
});
