import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { ResizeController } from './resize/controller';
import { hideWidthComments } from './resize/hideComments';
import { livePreviewExtension } from './resize/livePreview';
import { readingViewProcessor } from './resize/readingView';
import { ENABLED_CLASS, HIDE_COMMENTS_CLASS } from './scope';
import {
	DEFAULT_SETTINGS,
	GridlockTablesSettings,
	GridlockTablesSettingTab,
} from './settings';
import {
	COLUMN_MAX_VAR,
	COLUMN_MIN_VAR,
	columnLimitVars,
} from './utils/columnLimits';
import { PinnedWidths } from './utils/columnWidths';
import { tableStartLines } from './utils/tableKey';
import { widthCommentEdit, writeWidthComment } from './utils/widthComment';
import { NoteWidthStore, RecordWidthStore } from './utils/widthStore';

export { ENABLED_CLASS };

/** data.json: the settings, plus pinned widths keyed by tableKey(). */
type PluginData = Partial<GridlockTablesSettings> & { tableWidths?: unknown };

export default class GridlockTablesPlugin extends Plugin {
	settings!: GridlockTablesSettings;
	/** Pins in data.json: the 'plugin' storage setting, and older pins. */
	private records!: RecordWidthStore;
	private widths!: NoteWidthStore;
	private resize!: ResizeController;
	/** The enabled state last applied, so a re-render runs only on switching back on. */
	private wasEnabled = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GridlockTablesSettingTab(this.app, this));
		this.register(() => {
			document.body.classList.remove(ENABLED_CLASS, HIDE_COMMENTS_CLASS);
			document.body.style.removeProperty(COLUMN_MIN_VAR);
			document.body.style.removeProperty(COLUMN_MAX_VAR);
		});
		this.applyEnabledState();
		this.loadResize();
		this.wasEnabled = this.settings.enabled;
		// At app start Obsidian loads plugins before it restores the layout, so
		// those notes render with the post-processor. A plugin loaded later (an
		// update or a re-enable) finds notes already rendered: render them again.
		if (this.app.workspace.layoutReady && this.settings.enabled) this.rerenderReadingViews();
	}

	/**
	 * Render every open Reading view from scratch so the post-processor runs on
	 * its tables. rerender(true) is not enough: it reuses sections it has already
	 * rendered, so their tables keep the state from before (no handles or pins).
	 */
	private rerenderReadingViews() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView) || leaf.view.getMode() !== 'preview') return;
			const preview = leaf.view.previewMode;
			const scroll = preview.getScroll();
			preview.set(leaf.view.getViewData(), true);
			preview.applyScroll(scroll);
		});
	}

	private loadResize() {
		this.resize = new ResizeController({
			store: this.widths,
			limits: () => ({ minCh: this.settings.columnMinCh, maxCh: this.settings.columnMaxCh }),
			forEachViewRoot: (callback) =>
				this.app.workspace.iterateAllLeaves((leaf) => callback(leaf.view.containerEl)),
		});
		this.registerMarkdownPostProcessor(readingViewProcessor(this.resize, () => this.settings.enabled));
		this.registerEditorExtension([livePreviewExtension(this.resize), hideWidthComments]);

		const listen = (doc: Document) => {
			this.registerDomEvent(doc, 'pointerdown', this.resize.onPointerDown, { capture: true });
			this.registerDomEvent(doc, 'pointermove', this.resize.onPointerMove, { passive: true });
			for (const type of ['mousedown', 'touchstart', 'click', 'dblclick'] as const) {
				this.registerDomEvent(doc, type, this.resize.swallow, { capture: true });
			}
		};
		listen(document);
		this.registerEvent(this.app.workspace.on('window-open', (win) => listen(win.doc)));

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				// Only Reading view needs this: it re-renders just the sections that
				// changed. A note open in an editor already has fresh widths in the
				// store (the editor re-reads its own, newer, document on every change),
				// so those are re-applied without reading the disk.
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				if (!this.resize.showsInReadingView(file.path)) return;
				if (this.openEditorView(file.path)) {
					this.resize.reapply(file.path);
					return;
				}
				this.app.vault
					.cachedRead(file)
					.then((text) => this.resize.refreshSource(file.path, text.split(/\r?\n/)))
					.catch((err: unknown) => console.error('Gridlock Tables: could not re-read', file.path, err));
			}),
		);
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.widths.renameFile(oldPath, file.path)));
		this.registerEvent(this.app.vault.on('delete', (file) => this.widths.renameFile(file.path, null)));
		this.register(() => this.resize.stripEverywhere());
	}

	/**
	 * The off switch. Everything the plugin does to a table must hang off
	 * ENABLED_CLASS so that disabling it restores native rendering without a
	 * reload. The column limit variables are plugin-private and only take
	 * effect through styles.css rules under ENABLED_CLASS. Resize handles and
	 * pinned colgroups are removed outright, and restored by re-rendering.
	 */
	applyEnabledState() {
		document.body.classList.toggle(ENABLED_CLASS, this.settings.enabled);
		document.body.classList.toggle(HIDE_COMMENTS_CLASS, this.settings.hideWidthComments);
		const vars = columnLimitVars(
			this.settings.columnMinCh,
			this.settings.columnMaxCh,
		);
		for (const [name, value] of Object.entries(vars)) {
			document.body.style.setProperty(name, value);
		}
		if (!this.resize) return;
		const turnedOn = this.settings.enabled && !this.wasEnabled;
		this.wasEnabled = this.settings.enabled;
		if (this.settings.enabled) {
			// Only switching the plugin back on needs Reading view rendered again.
			// Every other setting is CSS (column limits, hidden comments) or applies
			// to the next save (width storage). rerender(true) here would also be
			// harmful: it redraws sections from cache without the post-processor,
			// which drops their resize handles.
			if (turnedOn) this.rerenderReadingViews();
			this.resize.refreshEditors();
		} else {
			this.resize.stripEverywhere();
		}
	}

	async loadSettings() {
		const { tableWidths, ...settings } = ((await this.loadData()) ?? {}) as PluginData;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
		this.records = new RecordWidthStore(tableWidths, () => {
			this.saveSettings().catch((err: unknown) => this.reportSaveError(err));
		});
		this.widths = new NoteWidthStore(
			this.records,
			(path, index, widths) => this.writeWidthComment(path, index, widths),
			() => this.settings.widthStorage === 'note',
		);
	}

	async saveSettings() {
		await this.saveData({ ...this.settings, tableWidths: this.records.toJSON() });
	}

	/**
	 * Write a table's gridlock-cols comment. A note open in an editor is edited
	 * there, so unsaved typing is not overwritten; otherwise the file is
	 * rewritten atomically with Vault.process.
	 */
	private async writeWidthComment(path: string, index: number, widths: PinnedWidths): Promise<boolean> {
		const view = this.openEditorView(path);
		if (view) {
			const editor = view.editor;
			const lines = editor.getValue().split('\n');
			if (tableStartLines(lines)[index] === undefined) return this.reportMissingTable(path);
			const edit = widthCommentEdit(lines, index, widths);
			if (edit) {
				const scroll = editor.getScrollInfo();
				editor.replaceRange(
					edit.insert.map((line) => `${line}\n`).join(''),
					{ line: edit.start, ch: 0 },
					{ line: edit.start + edit.deleteCount, ch: 0 },
				);
				// replaceRange scrolls the cursor into view, which jumps the note away
				// from the table just resized. In Obsidian 1.14.4 CodeMirror does that
				// scroll in its next measure frame, so a synchronous restore is
				// overridden; the position is put back in a frame after it.
				view.containerEl.win.requestAnimationFrame(() => {
					if (view.file?.path === path) editor.scrollTo(scroll.left, scroll.top);
				});
			}
			return true;
		}
		const file = this.app.vault.getFileByPath(path);
		if (!file) return this.reportMissingTable(path);
		let found = false;
		try {
			await this.app.vault.process(file, (text) => {
				found = tableStartLines(text.split(/\r?\n/))[index] !== undefined;
				return writeWidthComment(text, index, widths);
			});
		} catch (err) {
			this.reportSaveError(err);
			return false;
		}
		return found || this.reportMissingTable(path);
	}

	/** The view showing a note in an editor (Source mode or Live Preview), if any. */
	private openEditorView(path: string): MarkdownView | undefined {
		let view: MarkdownView | undefined;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!view && leaf.view instanceof MarkdownView && leaf.view.file?.path === path && leaf.view.getMode() === 'source') {
				view = leaf.view;
			}
		});
		return view;
	}

	private reportMissingTable(path: string): false {
		console.error('Gridlock Tables: table not found in', path, '- column widths not saved');
		new Notice('Could not save column widths: the table moved. Try resizing it again.');
		return false;
	}

	private reportSaveError(err: unknown) {
		console.error('Gridlock Tables: could not save column widths', err);
		new Notice('Could not save column widths. See the developer console for details.');
	}
}
