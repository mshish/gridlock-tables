import { MarkdownView, Notice, Plugin } from 'obsidian';
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
import { RecordWidthStore } from './utils/widthStore';

export { ENABLED_CLASS };

/** data.json: the settings, plus pinned widths keyed by tableKey(). */
type PluginData = Partial<GridlockTablesSettings> & { tableWidths?: unknown };

export default class GridlockTablesPlugin extends Plugin {
	settings!: GridlockTablesSettings;
	private widths!: RecordWidthStore;
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
		this.widths = new RecordWidthStore(tableWidths, () => {
			this.saveSettings().catch((err: unknown) => {
				console.error('Gridlock Tables: could not save column widths', err);
				new Notice('Could not save column widths. See the developer console for details.');
			});
		});
	}

	async saveSettings() {
		await this.saveData({ ...this.settings, tableWidths: this.widths.toJSON() });
	}
}
