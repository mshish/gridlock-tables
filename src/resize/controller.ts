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
import { WidthStore } from '../utils/widthStore';
import {
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

	constructor(private readonly host: ResizeHost) {}

	decorate(table: HTMLTableElement, key: string) {
		decorateTable(table, key, this.dragging.get(table) ?? this.host.store.get(key));
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
		const handle = handleOf(evt.target);
		const cell = handle?.parentElement;
		const table = handle?.closest('table');
		if (!handle || !cell || !table || !isActiveTable(table)) return;
		if (evt.button !== 0) return;
		evt.preventDefault();
		evt.stopPropagation();
		this.startGesture(evt, handle, cell, table);
	};

	/** Keep clicks, double-clicks and touches on a handle away from the table widget. */
	swallow = (evt: Event) => {
		if (handleOf(evt.target)) evt.stopPropagation();
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
		const onEnd = (evt: PointerEvent) => {
			handle.removeEventListener('pointermove', onMove);
			handle.removeEventListener('pointerup', onEnd);
			handle.removeEventListener('pointercancel', onEnd);
			if (handle.hasPointerCapture(evt.pointerId)) handle.releasePointerCapture(evt.pointerId);
			handle.removeClass('is-active');
			container?.removeClass(RESIZING_CLASS);
			this.dragging.delete(table);
			if (moved) {
				// Store what rendered: a cell's min-width can hold a column wider
				// than the pointer asked for.
				const rendered = pxToCh(cell.getBoundingClientRect().width, chPx);
				this.save(key, pinColumn(base, col, rendered, count));
				this.lastTap = undefined;
				return;
			}
			const tap = { time: evt.timeStamp, x: evt.clientX, y: evt.clientY, handle };
			if (this.lastTap?.handle === handle && isDoubleTap(this.lastTap, tap)) {
				this.lastTap = undefined;
				this.autoFit(table, cell, col, key);
			} else {
				this.lastTap = tap;
			}
		};
		handle.addEventListener('pointermove', onMove);
		handle.addEventListener('pointerup', onEnd);
		handle.addEventListener('pointercancel', onEnd);
	}

	/** Pin a column to its content width, per the autoSize distribution. */
	private autoFit(table: HTMLTableElement, cell: HTMLElement, col: number, key: string) {
		const chPx = chWidthPx(table);
		const { minPx, maxPx } = measureColumnPx(table, cell);
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
