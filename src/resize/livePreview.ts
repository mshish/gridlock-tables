/**
 * Live Preview: decorate Obsidian's native table widget in place. A
 * MutationObserver on this editor's content DOM catches the widget being
 * (re)rendered; nothing replaces or owns the widget's document range.
 */
import { Text } from '@codemirror/state';
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import { tableIndexAt, tableKey, tableStartLines } from '../utils/tableKey';
import { ResizeController } from './controller';
import { isActiveTable, stripAll, stripTable } from './tableDom';

/** Native LP tables, as direct descendants of this editor's content DOM. */
const WIDGET_TABLES = ':scope > .cm-table-widget > .table-wrapper > table';

export function livePreviewExtension(controller: ResizeController) {
	return ViewPlugin.define((view) => new LivePreviewResize(view, controller));
}

class LivePreviewResize implements PluginValue {
	private readonly observer: MutationObserver;
	private frame: number | null = null;
	private starts: { doc: Text; lines: number[] } | null = null;

	constructor(
		private readonly view: EditorView,
		private readonly controller: ResizeController,
	) {
		this.observer = new MutationObserver(() => this.refresh());
		this.observer.observe(view.contentDOM, { childList: true, subtree: true });
		controller.editors.add(this);
		this.refresh();
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) this.refresh();
	}

	/** Decorate on the next frame, once per frame however many mutations arrive. */
	refresh() {
		if (this.frame !== null) return;
		this.frame = this.view.dom.win.requestAnimationFrame(() => {
			this.frame = null;
			this.decorate();
		});
	}

	destroy() {
		this.observer.disconnect();
		if (this.frame !== null) this.view.dom.win.cancelAnimationFrame(this.frame);
		this.controller.editors.delete(this);
		stripAll(this.view.contentDOM);
	}

	private decorate() {
		const path = this.view.state.field(editorInfoField, false)?.file?.path;
		const tables = this.view.contentDOM.querySelectorAll<HTMLTableElement>(WIDGET_TABLES);
		for (const table of Array.from(tables)) {
			if (!path || !isActiveTable(table)) {
				stripTable(table);
				continue;
			}
			const index = this.tableIndex(table);
			if (index >= 0) this.controller.decorate(table, tableKey(path, index));
		}
	}

	/** Index of the widget's table among the document's tables. */
	private tableIndex(table: HTMLTableElement): number {
		const widget = table.closest('.cm-table-widget');
		if (!widget) return -1;
		const doc = this.view.state.doc;
		if (this.starts?.doc !== doc) {
			this.starts = { doc, lines: tableStartLines(doc.toString().split('\n')) };
		}
		let line: number;
		try {
			line = doc.lineAt(this.view.posAtDOM(widget)).number - 1;
		} catch {
			return -1;
		}
		return tableIndexAt(this.starts.lines, line, line);
	}
}
