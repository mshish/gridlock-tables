import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const ENABLED_SCOPE = 'body.gridlock-tables-enabled';
const NOTE_OPT_OUT = ':not(.gridlock-tables-off)';

/** Split a selector list on top-level commas, not those inside :is()/:where(). */
function splitSelectorList(list: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < list.length; i++) {
		const ch = list[i];
		if (ch === '(') depth++;
		else if (ch === ')') depth--;
		else if (ch === ',' && depth === 0) {
			parts.push(list.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(list.slice(start));
	return parts.map((s) => s.trim());
}

/** Every selector of every rule in styles.css, comments stripped. */
function selectors(css: string): string[] {
	const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const out: string[] = [];
	for (const match of stripped.matchAll(/([^{}]+)\{/g)) {
		out.push(...splitSelectorList(match[1] ?? ''));
	}
	return out;
}

describe('styles.css', () => {
	it('scopes every rule under the enabled class', () => {
		const all = selectors(css);
		expect(all.length).toBeGreaterThan(0);
		expect(all.filter((s) => !s.startsWith(ENABLED_SCOPE))).toEqual([]);
	});

	it('lets a note opt out with cssclasses: [gridlock-tables-off]', () => {
		expect(selectors(css).filter((s) => !s.includes(NOTE_OPT_OUT))).toEqual([]);
	});

	it('reaches tables only through their own note view', () => {
		// A descendant combinator between the view and the table container would
		// let an opted-out embedded note match through the host note's view.
		const RV_PATH = /\.markdown-preview-view[^ >]*:not\(\.gridlock-tables-off\) > \.markdown-preview-sizer > \.el-table/;
		const LP_PATH =
			/\.markdown-source-view[^ >]*:not\(\.gridlock-tables-off\) > \.cm-editor > \.cm-scroller > \.cm-sizer > \.cm-contentContainer > \.cm-content > \.cm-table-widget/;
		const tableRules = selectors(css).filter((s) => /el-table|cm-table-widget|\btable\b/.test(s));
		expect(tableRules.length).toBeGreaterThan(0);
		expect(tableRules.filter((s) => !RV_PATH.test(s) && !LP_PATH.test(s))).toEqual([]);
	});

	it('lets wide tables break out past the readable line', () => {
		expect(css).toContain(
			'max-width: calc((100cqw - min(var(--file-line-width), 100cqw)) / 2 + 100%)',
		);
		expect(css).toContain('container-type: inline-size');
	});
});
