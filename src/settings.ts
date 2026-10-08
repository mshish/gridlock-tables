import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import GridlockTablesPlugin from './main';
import {
	COLUMN_LIMIT_RANGE,
	DEFAULT_COLUMN_MAX_CH,
	DEFAULT_COLUMN_MIN_CH,
} from './utils/columnLimits';

export interface GridlockTablesSettings {
	/** Master off switch. When false the plugin leaves tables fully native. */
	enabled: boolean;
	/** Narrowest a content-sized column may get, in ch. */
	columnMinCh: number;
	/** Widest a content-sized column may get, in ch. */
	columnMaxCh: number;
}

export const DEFAULT_SETTINGS: GridlockTablesSettings = {
	enabled: true,
	columnMinCh: DEFAULT_COLUMN_MIN_CH,
	columnMaxCh: DEFAULT_COLUMN_MAX_CH,
};

type SettingKey = keyof GridlockTablesSettings;

/**
 * Declarative settings tab (Obsidian 1.13+). Each setting is a definition so
 * it shows up in Obsidian's settings search; add new settings here rather
 * than in a display() override.
 */
export class GridlockTablesSettingTab extends PluginSettingTab {
	plugin: GridlockTablesPlugin;

	constructor(app: App, plugin: GridlockTablesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [
			{
				name: 'Enable plugin',
				desc: 'Turn off to fall back to native Obsidian table rendering in every view.',
				control: {
					type: 'toggle',
					key: 'enabled',
					defaultValue: DEFAULT_SETTINGS.enabled,
				},
			},
			{
				name: 'Minimum column width',
				desc: 'Columns never shrink below this many characters.',
				control: {
					type: 'slider',
					key: 'columnMinCh',
					defaultValue: DEFAULT_SETTINGS.columnMinCh,
					min: COLUMN_LIMIT_RANGE.min,
					max: COLUMN_LIMIT_RANGE.max,
					step: 1,
					displayFormat: (value) => `${value}ch`,
				},
			},
			{
				name: 'Maximum column width',
				desc: 'Long text wraps instead of growing a column past this many characters.',
				control: {
					type: 'slider',
					key: 'columnMaxCh',
					defaultValue: DEFAULT_SETTINGS.columnMaxCh,
					min: COLUMN_LIMIT_RANGE.min,
					max: COLUMN_LIMIT_RANGE.max,
					step: 1,
					displayFormat: (value) => `${value}ch`,
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'enabled') {
			this.plugin.settings.enabled = Boolean(value);
		} else if (key === 'columnMinCh' || key === 'columnMaxCh') {
			this.plugin.settings[key] = Number(value);
		}
		await this.plugin.saveSettings();
		this.plugin.applyEnabledState();
	}
}
