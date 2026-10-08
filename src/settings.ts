import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import GridlockTablesPlugin from './main';

export interface GridlockTablesSettings {
	/** Master off switch. When false the plugin leaves tables fully native. */
	enabled: boolean;
}

export const DEFAULT_SETTINGS: GridlockTablesSettings = {
	enabled: true,
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
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'enabled') {
			this.plugin.settings.enabled = Boolean(value);
		}
		await this.plugin.saveSettings();
		this.plugin.applyEnabledState();
	}
}
