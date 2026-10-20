import { Fragment, type ReactNode } from 'react';
import { formatAmount } from '@/domain/recipe/amount-format';
import { approximationWord } from '@/domain/recipe/amount-words';
import type { IngredientLine, IngredientLineSpan } from '@/domain/recipe/ingredient';
import { preparationSeparator, wordsAfterUnit } from '@/domain/recipe/ingredient-parser';

// Spans in a line's unit, item, and preparation to mark, and how a marked span renders around its
// text as renderText renders it.
type IngredientLineMarks = {
	spans: readonly IngredientLineSpan[];
	render: (text: ReactNode) => ReactNode;
};

type IngredientLineTextProps = {
	line: IngredientLine;
	// The line as written, when line is that line at a scale, whose item and preparation the scale may
	// have changed: the words it writes between its parts read from it.
	written?: IngredientLine;
	// How the line's words after the amount render; the recipe form marks what is left to check in
	// them, and the recipe page shows them as written.
	renderText?: (text: string) => ReactNode;
	// The cooking view marks the amounts a scale left unscaled.
	marks?: IngredientLineMarks;
};

// A run of a line as the recipe page writes it: words written as they are, or the line's own words,
// which renderText renders, after what the line writes before them, with their field's spans marked.
type ShownRun =
	| { kind: 'plain'; text: string }
	| { kind: 'own'; field?: IngredientLineSpan['field']; lead: string; text: string };

// A line as the recipe page writes it, run by run: what comes before its measure, the measure, which
// shows in bold, and what comes after. Both the component and the plain text are built from it, so
// they can't say different things.
type ShownLine = {
	before: readonly ShownRun[];
	measure: readonly ShownRun[];
	after: readonly ShownRun[];
};

// Where the line has an amount: any word such as "About" the amount was read past, so the line keeps
// its own wording; the amount and its unit; then the item and any preparation, each after what the
// line writes before it. Without an amount there is nothing to emphasize, so the line reads as it was
// written.
function shownLine(line: IngredientLine, written: IngredientLine): ShownLine {
	if (line.amount === undefined) {
		return { before: [], measure: [], after: [{ kind: 'own', lead: '', text: line.text }] };
	}

	const approximation = approximationWord.exec(line.text)?.[0];
	const unit: ShownRun[] =
		line.unit === undefined
			? []
			: [
					{ kind: 'plain', text: ' ' },
					{ kind: 'own', field: 'unit', lead: '', text: line.unit },
				];
	const preparation: ShownRun[] =
		line.preparation === undefined
			? []
			: [
					{
						kind: 'own',
						field: 'preparation',
						lead: preparationSeparator(written),
						text: line.preparation,
					},
				];
	return {
		before: approximation === undefined ? [] : [{ kind: 'plain', text: approximation }],
		measure: [{ kind: 'plain', text: formatAmount(line.amount, line.unit) }, ...unit],
		after: [
			{ kind: 'plain', text: ' ' },
			{ kind: 'own', field: 'item', lead: wordsAfterUnit(written), text: line.item },
			...preparation,
		],
	};
}

function runText(run: ShownRun): string {
	return run.kind === 'plain' ? run.text : `${run.lead}${run.text}`;
}

function asWritten(text: string): ReactNode {
	return text;
}

// A field's text after what the line writes before it, such as the "of " before an item or the comma
// before a preparation, with the field's spans marked. A run outside any field has none.
function fieldText(
	field: IngredientLineSpan['field'] | undefined,
	lead: string,
	text: string,
	renderText: (text: string) => ReactNode,
	marks: IngredientLineMarks | undefined
): ReactNode {
	const shown = `${lead}${text}`;
	const spans =
		marks?.spans.filter((span) => span.field === field).sort((a, b) => a.start - b.start) ?? [];
	if (marks === undefined || spans.length === 0) {
		return renderText(shown);
	}

	const pieces: ReactNode[] = [];
	let last = 0;
	for (const span of spans) {
		const start = lead.length + span.start;
		const end = lead.length + span.end;
		if (start > last) {
			pieces.push(renderText(shown.slice(last, start)));
		}
		pieces.push(marks.render(renderText(shown.slice(start, end))));
		last = end;
	}
	if (last < shown.length) {
		pieces.push(renderText(shown.slice(last)));
	}
	return pieces.map((piece, index) => <Fragment key={index}>{piece}</Fragment>);
}

// An ingredient as the recipe page shows it, which the recipe form previews under each line.
function IngredientLineText({
	line,
	written = line,
	renderText = asWritten,
	marks,
}: IngredientLineTextProps) {
	const { before, measure, after } = shownLine(line, written);
	const rendered = (runs: readonly ShownRun[]) =>
		runs.map((run, index) => (
			<Fragment key={index}>
				{run.kind === 'plain'
					? run.text
					: fieldText(run.field, run.lead, run.text, renderText, marks)}
			</Fragment>
		));
	return (
		<>
			{rendered(before)}
			{measure.length > 0 && <span className="font-semibold">{rendered(measure)}</span>}
			{rendered(after)}
		</>
	);
}

// The line as IngredientLineText shows it, in plain text, such as to tell whether it reads as typed.
function ingredientLinePlainText(line: IngredientLine): string {
	const { before, measure, after } = shownLine(line, line);
	return [...before, ...measure, ...after].map(runText).join('');
}

export { ingredientLinePlainText, IngredientLineText };
