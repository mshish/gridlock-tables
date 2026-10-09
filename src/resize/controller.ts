/**
 * Column resizing for Reading view and Live Preview: drag a handle to pin a
 * column's width, double-click or double-tap it to auto-fit the column.
 *
 * Input is delegated from each window's document in the capture phase, so the
 * Live Preview table widget never sees a gesture that starts on a handle.
 */
import {
	PinnedWidths,
	Tap,
	autoFitCh,
	dragWidthCh,
	isDoubleTap,
	pinColumn,
	pxToCh,
} from '../utils/columnWidths';
import { columnEdgeAt, gestureEnd, startsGesture } from '../utils/gesture';
import { parseTableKey } from '../utils/tableKey';
import { WidthStore } from '../utils/widthStore';
import {
	EDGE_HOVER_CLASS,
	HANDLE_CLASS,
	KEY_ATTR,
	RESIZING_CLASS,
	applyWidths,
	availableWidthPx,
	cellChromePx,
	chWidthPx,
	columnWidthsPx,
	decorateTable,
	headerCells,
	isActiveTable,
	measureColumnPx,
	measureColumnText,
	scrollContainer,
	stripAll,
} from './tableDom';

export interface ResizeHost {
	store: WidthStore;
	/** Content-sized column limits from settings, in ch. */
	limits(): { minCh: number; maxCh: number };
	/** Call back with the container of every open view, in every window. */
	forEachViewRoot(callback: (root: HTMLElement) => void): void;
}

/** The handle an event started on. instanceOf works across popout windows. */
function handleOf(target: EventTarget | null): HTMLElement | null {
	const node = target as Node | null;
	if (!node?.instanceOf(HTMLElement)) return null;
	return node.closest<HTMLElement>(`.${HANDLE_CLASS}`);
}

/**
 * The active table a pointer is over and the column whose right edge it is
 * on, measured against the header cells, or null. Cells of a table nested
 * inside a cell belong to that nested table.
 */
function edgeAt(target: EventTarget | null, x: number): { table: HTMLTableElement; col: number } | null {
	const node = target as Node | null;
	if (!node?.instanceOf(HTMLElement)) return null;
	const table = node.closest<HTMLElement>('td, th')?.closest<HTMLTableElement>('table');
	if (!table || !isActiveTable(table)) return null;
	const col = columnEdgeAt(headerCells(table).map((cell) => cell.getBoundingClientRect().right), x);
	return col < 0 ? null : { table, col };
}

/** A pointer that moves less than this many px is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 3;

export class ResizeController {
	/** Live Preview editors to re-decorate when the plugin is switched back on. */
	readonly editors = new Set<{ refresh(): void }>();
	private lastTap: (Tap & { handle: Element }) | undefined;
	/**
	 * Widths of a table mid-drag. Live Preview re-decorates on every mutation,
	 * including the colgroup a drag inserts, and must not revert to the store.
	 */
	private readonly dragging = new WeakMap<HTMLTableElement, PinnedWidths>();
	/** The table whose edge the last pointerdown grabbed from a body row. */
	private edgeGestureTable: HTMLTableElement | null = null;
	/** The table showing the edge resize cursor. */
	private edgeHover: HTMLTableElement | null = null;

	constructor(private readonly host: ResizeHost) {}

	decorate(table: HTMLTableElement, key: string) {
		decorateTable(table, key, this.dragging.get(table) ?? this.host.store.get(key));
	}

	/** Give the store a note's current source, before its tables are decorated. */
	observeSource(path: string, lines: readonly string[]) {
		this.host.store.observe?.(path, lines);
	}

	/**
	 * A note changed on disk: re-read its widths and re-apply them to every open
	 * copy of its tables. Reading view only re-renders the sections that changed,
	 * so a table whose comment was edited elsewhere would otherwise keep stale
	 * widths.
	 */
	/** True when a decorated table of this note is open in a Reading view. */
	showsInReadingView(path: string): boolean {
		let shown = false;
		this.host.forEachViewRoot((root) => {
			if (shown) return;
			root.querySelectorAll(`.markdown-preview-view table[${KEY_ATTR}]`).forEach((table) => {
				if (parseTableKey(table.getAttribute(KEY_ATTR) ?? '')?.path === path) shown = true;
			});
		});
		return shown;
	}

	refreshSource(path: string, lines: readonly string[]) {
		this.observeSource(path, lines);
		this.reapply(path);
	}

	/** Re-apply the stored widths to every open copy of a note's tables. */
	reapply(path: string) {
		this.host.forEachViewRoot((root) => {
			root.querySelectorAll<HTMLTableElement>(`table[${KEY_ATTR}]`).forEach((table) => {
				const key = table.getAttribute(KEY_ATTR);
				if (!key || parseTableKey(key)?.path !== path || this.dragging.has(table)) return;
				applyWidths(table, this.host.store.get(key));
			});
		});
	}

	/** Re-decorate every Live Preview editor; Reading view re-renders itself. */
	refreshEditors() {
		this.editors.forEach((e) => e.refresh());
	}

	stripEverywhere() {
		this.host.forEachViewRoot((root) => stripAll(root));
	}

	/**
	 * Capture-phase listener for pointerdown. Returns without touching the
	 * event unless it starts on a handle of an active table.
	 */
	onPointerDown = (evt: PointerEvent) => {
		this.edgeGestureTable = null;
		let handle = handleOf(evt.target);
		if (!handle && evt.pointerType === 'mouse') {
			// With a mouse a column edge can be grabbed in any row; it drives the
			// same gesture as that column's header handle. Touch keeps to the
			// handles so a swipe near a cell border still scrolls the table.
			const edge = edgeAt(evt.target, evt.clientX);
			const header = edge ? headerCells(edge.table)[edge.col] : undefined;
			handle = header?.querySelector<HTMLElement>(`:scope > .${HANDLE_CLASS}`) ?? null;
			if (handle && edge) this.edgeGestureTable = edge.table;
		}
		const cell = handle?.parentElement;
		const table = handle?.closest('table');
		if (!handle || !cell || !table || !isActiveTable(table)) return;
		if (!startsGesture(evt)) return;
		evt.preventDefault();
		evt.stopPropagation();
		this.startGesture(evt, handle, cell, table);
	};

	/**
	 * Keep clicks, double-clicks and touches on a handle away from the table
	 * widget, and the clicks that follow grabbing an edge in a body row.
	 */
	swallow = (evt: Event) => {
		const target = evt.target as Node | null;
		if (handleOf(evt.target) || (this.edgeGestureTable && target && this.edgeGestureTable.contains(target))) {
			evt.stopPropagation();
		}
	};

	/** Show the resize cursor while a mouse is over a column edge in any row. */
	onPointerMove = (evt: PointerEvent) => {
		if (evt.pointerType !== 'mouse' || evt.buttons !== 0) return;
		const table = edgeAt(evt.target, evt.clientX)?.table ?? null;
		if (table === this.edgeHover) return;
		this.edgeHover?.removeClass(EDGE_HOVER_CLASS);
		table?.addClass(EDGE_HOVER_CLASS);
		this.edgeHover = table;
	};

	private startGesture(down: PointerEvent, handle: HTMLElement, cell: HTMLElement, table: HTMLTableElement) {
		const key = table.getAttribute(KEY_ATTR);
		if (!key) return;
		const col = headerCells(table).indexOf(cell as HTMLTableCellElement);
		if (col < 0) return;
		const count = headerCells(table).length;
		const chPx = chWidthPx(table);
		const startCh = pxToCh(cell.getBoundingClientRect().width, chPx);
		const base: PinnedWidths = this.host.store.get(key) ?? [];
		const container = scrollContainer(table);
		let moved = false;

		handle.setPointerCapture(down.pointerId);
		handle.addClass('is-active');
		// Per the issue: no scrolling or hover under the finger while dragging.
		container?.addClass(RESIZING_CLASS);

		const onMove = (evt: PointerEvent) => {
			const dx = evt.clientX - down.clientX;
			if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
			moved = true;
			const widths = pinColumn(base, col, dragWidthCh(startCh, dx, chPx), count);
			this.dragging.set(table, widths);
			applyWidths(table, widths);
		};
		let ended = false;
		const finish = (evt: PointerEvent, ending: 'up' | 'cancel') => {
			// Releasing capture after pointerup fires lostpointercapture too.
			if (ended) return;
			ended = true;
			handle.removeEventListener('pointermove', onMove);
			handle.removeEventListener('pointerup', onUp);
			handle.removeEventListener('pointercancel', onCancel);
			handle.removeEventListener('lostpointercapture', onCancel);
			doc.removeEventListener('lostpointercapture', onLostFromDocument, true);
			if (handle.hasPointerCapture(evt.pointerId)) handle.releasePointerCapture(evt.pointerId);
			handle.removeClass('is-active');
			container?.removeClass(RESIZING_CLASS);
			this.dragging.delete(table);
			switch (gestureEnd(ending, moved)) {
				case 'revert':
					applyWidths(table, this.host.store.get(key));
					this.lastTap = undefined;
					return;
				case 'commit': {
					// Store what rendered: a cell's min-width can hold a column wider
					// than the pointer asked for.
					const rendered = pxToCh(cell.getBoundingClientRect().width, chPx);
					this.save(key, pinColumn(base, col, rendered, count));
					this.lastTap = undefined;
					return;
				}
				case 'tap': {
					const tap = { time: evt.timeStamp, x: evt.clientX, y: evt.clientY, handle };
					if (this.lastTap?.handle === handle && isDoubleTap(this.lastTap, tap)) {
						this.lastTap = undefined;
						this.autoFit(table, cell, col, key);
					} else {
						this.lastTap = tap;
					}
				}
			}
		};
		const onUp = (evt: PointerEvent) => finish(evt, 'up');
		const onCancel = (evt: PointerEvent) => finish(evt, 'cancel');
		// A handle removed mid-drag loses capture with the event fired at its
		// document, not at the detached handle.
		const doc = handle.doc;
		const onLostFromDocument = (evt: PointerEvent) => {
			if (evt.pointerId === down.pointerId) finish(evt, 'cancel');
		};
		handle.addEventListener('pointermove', onMove);
		handle.addEventListener('pointerup', onUp);
		handle.addEventListener('pointercancel', onCancel);
		handle.addEventListener('lostpointercapture', onCancel);
		doc.addEventListener('lostpointercapture', onLostFromDocument, true);
	}

	/** Pin a column to its content width, per the autoSize distribution. */
	private autoFit(table: HTMLTableElement, cell: HTMLElement, col: number, key: string) {
		const chPx = chWidthPx(table);
		// Plain-text columns are measured without reflowing the table; a column
		// with links, code or other inline markup is laid out and read instead.
		const { minPx, maxPx } = measureColumnText(table, col) ?? measureColumnPx(table, cell);
		// Measurements are border-box; the setting limits are content-box.
		const chromeCh = pxToCh(cellChromePx(cell), chPx);
		const othersPx = columnWidthsPx(table).reduce((sum, w, i) => (i === col ? sum : sum + w), 0);
		const { minCh, maxCh } = this.host.limits();
		const width = autoFitCh(
			{ minCh: pxToCh(minPx, chPx), maxCh: pxToCh(maxPx, chPx) },
			{
				availableCh: pxToCh(availableWidthPx(table) - othersPx, chPx),
				globalMinCh: minCh + chromeCh,
				globalMaxCh: maxCh + chromeCh,
			},
		);
		const count = headerCells(table).length;
		this.save(key, pinColumn(this.host.store.get(key) ?? [], col, width, count));
	}

	/** Store a table's pins and show them on every open copy of that table. */
	private save(key: string, widths: PinnedWidths) {
		this.host.store.set(key, widths);
		const stored = this.host.store.get(key);
		this.host.forEachViewRoot((root) => {
			root.querySelectorAll<HTMLTableElement>(`table[${KEY_ATTR}="${CSS.escape(key)}"]`).forEach((t) =>
				applyWidths(t, stored),
			);
		});
	}
}
