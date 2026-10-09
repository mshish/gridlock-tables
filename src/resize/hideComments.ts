/**
 * Live Preview: hide each table's gridlock-cols comment, and the blank line
 * after it, while no selection touches those lines -- the way Live Preview
 * hides other markup until the cursor reaches it. This only marks the lines
 * with a class; styles.css hides them in Live Preview and only where the
 * plugin applies, so Source mode, opted-out notes and the disabled plugin
 * show the comment as before.
 */
import { RangeSetBuilder, Text } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { LineRange, untouchedLines, widthCommentRanges } from '../utils/widthComment';

const HIDDEN = Decoration.line({ class: 'gridlock-cols-hidden' });

class HideWidthComments implements PluginValue {
	decorations: DecorationSet;
	private ranges: { doc: Text; lines: LineRange[] } | null = null;

	constructor(view: EditorView) {
		this.decorations = this.build(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.selectionSet) this.decorations = this.build(update.view);
	}

	private build(view: EditorView): DecorationSet {
		const doc = view.state.doc;
		if (this.ranges?.doc !== doc) {
			this.ranges = { doc, lines: widthCommentRanges(doc.toString().split('\n')) };
		}
		const selected = view.state.selection.ranges.map((r) => {
			const end = doc.lineAt(r.to);
			// A selection that ends at the start of a line (a triple-click selects
			// the line and its line break) does not reach into that line.
			const last = !r.empty && r.to === end.from ? end.number - 2 : end.number - 1;
			return { from: doc.lineAt(r.from).number - 1, to: Math.max(last, doc.lineAt(r.from).number - 1) };
		});
		const builder = new RangeSetBuilder<Decoration>();
		for (const n of untouchedLines(this.ranges.lines, selected)) {
			const line = doc.line(n + 1);
			builder.add(line.from, line.from, HIDDEN);
		}
		return builder.finish();
	}
}

export const hideWidthComments = ViewPlugin.fromClass(HideWidthComments, {
	decorations: (plugin) => plugin.decorations,
});
