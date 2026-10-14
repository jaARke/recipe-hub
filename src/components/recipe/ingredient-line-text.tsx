import { formatAmount } from '@/domain/recipe/amount-format';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { preparationSeparator } from '@/domain/recipe/ingredient-parser';

// An ingredient as the recipe page shows it, which the recipe form previews under each line.
function IngredientLineText({ line }: { line: IngredientLine }) {
	// Without an amount there is nothing to emphasize, so the line reads as it was written.
	if (line.amount === undefined) {
		return line.text;
	}

	const amount = formatAmount(line.amount, line.unit);
	return (
		<>
			<span className="font-semibold">
				{line.unit === undefined ? amount : `${amount} ${line.unit}`}
			</span>{' '}
			{line.item}
			{line.preparation !== undefined && `${preparationSeparator(line)}${line.preparation}`}
		</>
	);
}

export { IngredientLineText };
