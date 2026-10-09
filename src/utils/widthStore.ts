/**
 * Where pinned widths live. No Obsidian imports -- testable in Node/vitest.
 *
 * WidthStore is the seam between the resize UI and storage. RecordWidthStore
 * keeps pins in plugin data (data.json), keyed by tableKey(); a store that
 * writes an HTML comment above each table can implement the same interface.
 */
import { PinnedWidths, sanitizeWidths } from './columnWidths';
import { renameTableKeys } from './tableKey';

export interface WidthStore {
	/** Pins for a table, or undefined when none of its columns is pinned. */
	get(key: string): PinnedWidths | undefined;
	/** Replace a table's pins. All-null pins remove the table. */
	set(key: string, widths: PinnedWidths): void;
}

export class RecordWidthStore implements WidthStore {
	private record: Record<string, PinnedWidths> = {};

	/**
	 * @param raw persisted data, validated entry by entry
	 * @param persist called after every change, to save the record
	 */
	constructor(
		raw: unknown,
		private readonly persist: () => void,
	) {
		if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
			for (const [key, value] of Object.entries(raw)) {
				const widths = sanitizeWidths(value);
				if (widths) this.record[key] = widths;
			}
		}
	}

	get(key: string): PinnedWidths | undefined {
		return this.record[key];
	}

	set(key: string, widths: PinnedWidths): void {
		const clean = sanitizeWidths(widths);
		if (clean) this.record[key] = clean;
		else delete this.record[key];
		this.persist();
	}

	/** Follow a renamed file, or forget a deleted one (newPath null). */
	renameFile(oldPath: string, newPath: string | null): void {
		const next = renameTableKeys(this.record, oldPath, newPath);
		const changed = Object.keys(next).join('\n') !== Object.keys(this.record).join('\n');
		this.record = next;
		if (changed) this.persist();
	}

	toJSON(): Record<string, PinnedWidths> {
		return { ...this.record };
	}
}
