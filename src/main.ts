import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	GridlockTablesSettings,
	GridlockTablesSettingTab,
} from './settings';

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
	}

	/**
	 * The off switch. Everything the plugin does to a table must hang off
	 * ENABLED_CLASS so that disabling it restores native rendering without a
	 * reload.
	 */
	applyEnabledState() {
		document.body.classList.toggle(ENABLED_CLASS, this.settings.enabled);
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
