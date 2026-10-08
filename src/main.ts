import { Plugin } from 'obsidian';
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

/** Body class that every Gridlock style rule is scoped under. */
export const ENABLED_CLASS = 'gridlock-tables-enabled';

export default class GridlockTablesPlugin extends Plugin {
	settings!: GridlockTablesSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GridlockTablesSettingTab(this.app, this));
		this.applyEnabledState();
	}

	onunload() {
		document.body.classList.remove(ENABLED_CLASS);
		document.body.style.removeProperty(COLUMN_MIN_VAR);
		document.body.style.removeProperty(COLUMN_MAX_VAR);
	}

	/**
	 * The off switch. Everything the plugin does to a table must hang off
	 * ENABLED_CLASS so that disabling it restores native rendering without a
	 * reload. The column limit variables are plugin-private and only take
	 * effect through styles.css rules under ENABLED_CLASS.
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
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<GridlockTablesSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
