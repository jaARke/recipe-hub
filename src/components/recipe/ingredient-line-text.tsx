import { formatAmount } from '@/domain/recipe/amount-format';
import type { IngredientLine } from '@/domain/recipe/ingredient';

// An ingredient as the recipe page shows it, which the recipe form previews under each line.
function IngredientLineText({ line }: { line: IngredientLine }) {
	// Without an amount there is nothing to emphasize, so the line reads as it was written.
	if (line.amount === undefined) {
		return line.text;
	}

	const amount = formatAmount(line.amount);
	return (
		<>
			<span className="font-semibold">
				{line.unit === undefined ? amount : `${amount} ${line.unit}`}
			</span>{' '}
			{line.item}
			{line.preparation !== undefined && `, ${line.preparation}`}
		</>
	);
}

export { IngredientLineText };
