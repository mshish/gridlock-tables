import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { ResizeController } from './resize/controller';
import { livePreviewExtension } from './resize/livePreview';
import { readingViewProcessor } from './resize/readingView';
import { ENABLED_CLASS } from './scope';
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

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GridlockTablesSettingTab(this.app, this));
		this.register(() => {
			document.body.classList.remove(ENABLED_CLASS);
			document.body.style.removeProperty(COLUMN_MIN_VAR);
			document.body.style.removeProperty(COLUMN_MAX_VAR);
		});
		this.applyEnabledState();
		this.loadResize();
	}

	private loadResize() {
		this.resize = new ResizeController({
			store: this.widths,
			limits: () => ({ minCh: this.settings.columnMinCh, maxCh: this.settings.columnMaxCh }),
			forEachViewRoot: (callback) =>
				this.app.workspace.iterateAllLeaves((leaf) => callback(leaf.view.containerEl)),
		});
		this.registerMarkdownPostProcessor(readingViewProcessor(this.resize, () => this.settings.enabled));
		this.registerEditorExtension(livePreviewExtension(this.resize));

		const listen = (doc: Document) => {
			this.registerDomEvent(doc, 'pointerdown', this.resize.onPointerDown, { capture: true });
			for (const type of ['mousedown', 'touchstart', 'click', 'dblclick'] as const) {
				this.registerDomEvent(doc, type, this.resize.swallow, { capture: true });
			}
		};
		listen(document);
		this.registerEvent(this.app.workspace.on('window-open', (win) => listen(win.doc)));

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;
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
		const vars = columnLimitVars(
			this.settings.columnMinCh,
			this.settings.columnMaxCh,
		);
		for (const [name, value] of Object.entries(vars)) {
			document.body.style.setProperty(name, value);
		}
		if (!this.resize) return;
		if (this.settings.enabled) {
			this.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
			});
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
	private writeWidthComment(path: string, index: number, widths: PinnedWidths) {
		let editor: Editor | undefined;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!editor && leaf.view instanceof MarkdownView && leaf.view.file?.path === path && leaf.view.getMode() === 'source') {
				editor = leaf.view.editor;
			}
		});
		if (editor) {
			const edit = widthCommentEdit(editor.getValue().split('\n'), index, widths);
			if (!edit) return;
			editor.replaceRange(
				edit.insert.map((line) => `${line}\n`).join(''),
				{ line: edit.start, ch: 0 },
				{ line: edit.start + edit.deleteCount, ch: 0 },
			);
			return;
		}
		const file = this.app.vault.getFileByPath(path);
		if (!file) return;
		this.app.vault
			.process(file, (text) => writeWidthComment(text, index, widths))
			.catch((err: unknown) => this.reportSaveError(err));
	}

	private reportSaveError(err: unknown) {
		console.error('Gridlock Tables: could not save column widths', err);
		new Notice('Could not save column widths. See the developer console for details.');
	}
}
