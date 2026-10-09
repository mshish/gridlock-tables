/**
 * Where pinned widths live. No Obsidian imports -- testable in Node/vitest.
 *
 * WidthStore is the seam between the resize UI and storage. RecordWidthStore
 * keeps pins in plugin data (data.json), keyed by tableKey(); NoteWidthStore
 * keeps them in the note as an HTML comment above each table.
 */
import { PinnedWidths, sanitizeWidths } from './columnWidths';
import { parseTableKey, renameTableKeys, tableKey } from './tableKey';
import { widthsFromComments } from './widthComment';

export interface WidthStore {
	/** Pins for a table, or undefined when none of its columns is pinned. */
	get(key: string): PinnedWidths | undefined;
	/** Replace a table's pins. All-null pins remove the table. */
	set(key: string, widths: PinnedWidths): void;
	/** The current Markdown source of a note, seen while rendering it. */
	observe?(path: string, lines: readonly string[]): void;
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

/** Rewrites the gridlock-cols comment above table `index` of the note at `path`. */
export type CommentWriter = (path: string, index: number, widths: PinnedWidths) => void;

/**
 * Pins kept in the notes themselves, as a gridlock-cols comment above each
 * table (see widthComment.ts). Widths are read from the source every time a
 * note renders, so editing or deleting a comment by hand takes effect on the
 * next render. While `inNote()` is false, every call goes to `record`
 * (data.json) instead.
 *
 * A table with no comment falls back to `record`, which still holds pins saved
 * before widths were written to notes; saving a table's pins to its note drops
 * that record entry.
 */
export class NoteWidthStore implements WidthStore {
	/** Pins read from comments, by tableKey(), for every note seen so far. */
	private readonly fromNotes = new Map<string, PinnedWidths>();

	constructor(
		private readonly record: RecordWidthStore,
		private readonly write: CommentWriter,
		private readonly inNote: () => boolean,
	) {}

	observe(path: string, lines: readonly string[]): void {
		this.forget(path);
		widthsFromComments(lines).forEach((widths, index) => this.fromNotes.set(tableKey(path, index), widths));
	}

	get(key: string): PinnedWidths | undefined {
		if (!this.inNote()) return this.record.get(key);
		return this.fromNotes.get(key) ?? this.record.get(key);
	}

	set(key: string, widths: PinnedWidths): void {
		const target = parseTableKey(key);
		if (!this.inNote() || !target) {
			this.record.set(key, widths);
			return;
		}
		const clean = sanitizeWidths(widths);
		if (clean) this.fromNotes.set(key, clean);
		else this.fromNotes.delete(key);
		this.write(target.path, target.index, clean ?? []);
		if (this.record.get(key)) this.record.set(key, []);
	}

	/** Follow a renamed file, or forget a deleted one (newPath null). */
	renameFile(oldPath: string, newPath: string | null): void {
		// The comments move with the file and are read again when it renders.
		this.forget(oldPath);
		this.record.renameFile(oldPath, newPath);
	}

	private forget(path: string): void {
		const prefix = `${path}#`;
		for (const key of Array.from(this.fromNotes.keys())) {
			if (key.startsWith(prefix) && parseTableKey(key)?.path === path) this.fromNotes.delete(key);
		}
	}
}
