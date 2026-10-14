import type { ReactNode } from 'react';
import { formatAmount } from '@/domain/recipe/amount-format';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { preparationSeparator } from '@/domain/recipe/ingredient-parser';

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
	return (
		<>
			<span className="font-semibold">
				{line.unit === undefined ? amount : `${amount} ${line.unit}`}
			</span>{' '}
			{renderText(line.item)}
			{line.preparation !== undefined &&
				renderText(`${preparationSeparator(line)}${line.preparation}`)}
		</>
	);
}

export { IngredientLineText };
