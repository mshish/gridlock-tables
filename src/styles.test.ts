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
		const prelude = (match[1] ?? '').trim();
		if (prelude.startsWith('@')) continue;
		out.push(...splitSelectorList(prelude));
	}
	return out;
}

/** Each `@container <query> { ... }` block: its query and its body. */
function containerBlocks(css: string): { query: string; body: string; start: number; end: number }[] {
	const out = [];
	for (const match of css.matchAll(/@container ([^{]+)\{/g)) {
		const open = (match.index ?? 0) + match[0].length;
		let depth = 1;
		let i = open;
		while (depth > 0 && i < css.length) {
			if (css[i] === '{') depth++;
			else if (css[i] === '}') depth--;
			i++;
		}
		out.push({ query: match[1] ?? '', body: css.slice(open, i - 1), start: match.index ?? 0, end: i });
	}
	return out;
}

/** The option ids declared in the Style Settings block. */
function settingIds(css: string): string[] {
	const block = /\/\* @settings([\s\S]*?)\*\//.exec(css)?.[1] ?? '';
	return [...block.matchAll(/^\s+id: (\S+)$/gm)].map((m) => m[1] ?? '').filter((id) => id !== 'gridlock-tables');
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

	it('uses every Style Settings variable in a rule', () => {
		const ids = settingIds(css);
		expect(ids.length).toBeGreaterThan(0);
		const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
		expect(ids.filter((id) => !rules.includes(`var(--${id}`))).toEqual([]);
	});

	it('applies a Style Settings option only while that option is set', () => {
		// The rules outrank Obsidian's .markdown-rendered td/th, so an option
		// applied with a fallback would override themes and snippets even unset.
		const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
		const ids = settingIds(css);
		const blocks = containerBlocks(rules);
		let outside = rules;
		for (const b of [...blocks].reverse()) outside = outside.slice(0, b.start) + outside.slice(b.end);
		expect(ids.filter((id) => outside.includes(`--${id}`))).toEqual([]);
		const misplaced = blocks.flatMap((b) =>
			ids.filter((id) => b.body.includes(`var(--${id}`) && !b.query.includes(`style(--${id})`)),
		);
		expect(misplaced).toEqual([]);
	});

	it('lets wide tables break out past the readable line', () => {
		expect(css).toContain(
			'max-width: calc((100cqw - min(var(--file-line-width), 100cqw)) / 2 + 100%)',
		);
		expect(css).toContain('container-type: inline-size');
	});
});
