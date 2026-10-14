import type { ReactNode } from 'react';
import { formatAmount } from '@/domain/recipe/amount-format';
import { approximationWord } from '@/domain/recipe/amount-words';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { preparationSeparator, wordsAfterUnit } from '@/domain/recipe/ingredient-parser';

type IngredientLineTextProps = {
	line: IngredientLine;
	// How the line's words after the amount render; the recipe form marks what is left to check in
	// them, and the recipe page shows them as written.
	renderText?: (text: string) => ReactNode;
};

function asWritten(text: string): ReactNode {
	return text;
}

// An ingredient as the recipe page shows it, which the recipe form previews under each line.
function IngredientLineText({ line, renderText = asWritten }: IngredientLineTextProps) {
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
				{line.unit !== undefined && <> {renderText(line.unit)}</>}
			</span>{' '}
			{renderText(`${wordsAfterUnit(line)}${line.item}`)}
			{line.preparation !== undefined &&
				renderText(`${preparationSeparator(line)}${line.preparation}`)}
		</>
	);
}

export { IngredientLineText };
