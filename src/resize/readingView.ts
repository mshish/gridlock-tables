import { MarkdownPostProcessor } from 'obsidian';
import { tableIndexAt, tableKey, tableStartLines } from '../utils/tableKey';
import { ResizeController } from './controller';
import { stripTable } from './tableDom';

const OPT_OUT_CLASS = 'gridlock-tables-off';

function optedOut(frontmatter: unknown): boolean {
	const classes = (frontmatter as { cssclasses?: unknown } | null | undefined)?.cssclasses;
	if (Array.isArray(classes)) return classes.includes(OPT_OUT_CLASS);
	return typeof classes === 'string' && classes.split(/[\s,]+/).includes(OPT_OUT_CLASS);
}

/**
 * Reading view: decorate each rendered table section. The section is not yet
 * in the document here, so the opt-out comes from frontmatter; the pointer
 * handler and styles.css re-check the full view path before acting.
 */
export function readingViewProcessor(controller: ResizeController, enabled: () => boolean): MarkdownPostProcessor {
	return (el, ctx) => {
		const table = el.querySelector<HTMLTableElement>(':scope > table');
		if (!table) return;
		if (!enabled() || optedOut(ctx.frontmatter)) {
			stripTable(table);
			return;
		}
		const info = ctx.getSectionInfo(el);
		if (!info) return;
		const lines = info.text.split('\n');
		const index = tableIndexAt(tableStartLines(lines), info.lineStart, info.lineEnd);
		if (index < 0) return;
		controller.observeSource(ctx.sourcePath, lines);
		controller.decorate(table, tableKey(ctx.sourcePath, index));
	};
}
