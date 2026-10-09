import { describe, it, expect, vi } from 'vitest';
import { RecordWidthStore } from './widthStore';

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
