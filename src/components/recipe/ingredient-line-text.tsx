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

function asWritten(text: string): ReactNode {
	return text;
}

// A field's text after what the line writes before it, such as the "of " before an item or the comma
// before a preparation, with the field's spans marked.
function fieldText(
	field: IngredientLineSpan['field'],
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
	// Without an amount there is nothing to emphasize, so the line reads as it was written.
	if (line.amount === undefined) {
		return renderText(line.text);
	}

	const amount = formatAmount(line.amount, line.unit);
	// A word such as "About" that the amount was read past, so the line keeps its own wording.
	const approximation = approximationWord.exec(line.text)?.[0];
	return (
		<>
			{approximation}
			<span className="font-semibold">
				{amount}
				{line.unit !== undefined && <> {fieldText('unit', '', line.unit, renderText, marks)}</>}
			</span>{' '}
			{fieldText('item', wordsAfterUnit(written), line.item, renderText, marks)}
			{line.preparation !== undefined &&
				fieldText(
					'preparation',
					preparationSeparator(written),
					line.preparation,
					renderText,
					marks
				)}
		</>
	);
}

export { IngredientLineText };
