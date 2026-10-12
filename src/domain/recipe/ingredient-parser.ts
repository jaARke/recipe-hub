import { parseIngredient, type ParseIngredientOptions } from 'parse-ingredient';
import type { Amount } from '@/domain/recipe/amount';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { maxIngredientLineLength } from '@/domain/recipe/ingredient-limits';

type ItemParts = Pick<IngredientLine, 'item' | 'preparation'>;

type Measure = {
	amount: Amount;
	unit?: string;
	// What follows the amount and unit: the item and any preparation.
	description: string;
};

const libraryOptions: ParseIngredientOptions = {
	// Sizes describe the item rather than measure it: "1 large egg".
	ignoreUOMs: ['large', 'lg', 'lg.', 'medium', 'med', 'med.', 'md', 'md.', 'small', 'sm', 'sm.'],
	// A count unit the library does not list.
	additionalUOMs: { sheet: { short: 'sheet', plural: 'sheets', type: 'count' } },
	// "of" is dropped only after a unit, so "2 of the eggs" keeps it.
	allowLeadingOf: true,
	// Exact values, so a third is not stored as 0.333.
	round: false,
};

// One quantity as written: a fraction or mixed number, a vulgar fraction, a decimal, or a whole number.
const quantitySource = String.raw`(?:\d+(?:\s+\d+)?\s*[/⁄]\s*\d+|\d*\s*[¼-¾⅐-⅞]|\d*\.\d+|\d+)`;

// A quantity, or a range of two joined the way the library joins them.
const amountPattern = new RegExp(
	String.raw`^${quantitySource}(?:(?:\s*[-\u2013\u2014]\s*|\s+(?:to|or)\s+)${quantitySource})?$`,
	'iu'
);

// On old recipe cards "1-1/2" is a mixed number, since a range cannot fall from 1 to 1/2.
const hyphenatedMixedNumber = /^[1-9]\d*[-\u2013]\d+[/⁄]\d+$/u;

// The number goes on past what the library read, as in "2-inch piece" or "1,5 kg".
const continuedNumber = /[\d,./⁄\-\u2013\u2014]/u;

// A size in parentheses right after the unit belongs to it: "1 can (14 ounces) tomatoes".
const unitSize = /^\([^()]*\)(?=\s)/u;

// Closing phrases that say how an ingredient is used rather than what it is: "Salt to taste".
const trailingNote =
	/(?<=[\s,])(?:to taste|as needed|optional|for garnish|for serving|for dusting|for the .+)$/iu;

function toAmount(min: number, max: number | null): Amount | undefined {
	if (!Number.isFinite(min) || min <= 0) {
		return undefined;
	}

	if (max === null) {
		return { min };
	}

	return Number.isFinite(max) && max > min ? { min, max } : undefined;
}

// The amount and unit that open the line, as the library reads them, or nothing it may misread.
function readMeasure(line: string): Measure | undefined {
	// The library's quantity scan slows sharply on long text, which no amount needs.
	if (line.length > maxIngredientLineLength) {
		return undefined;
	}

	const [parsed] = parseIngredient([line], libraryOptions);
	// The library also reads a quantity from the end of a line ("Juice of 1 lemon"), which is no amount.
	if (parsed === undefined || parsed.quantity === null || !line.endsWith(parsed.description)) {
		return undefined;
	}

	const descriptionStart = line.length - parsed.description.length;
	const measureText = line.slice(0, descriptionStart).trimEnd();
	const unit = parsed.unitOfMeasure ?? '';
	if (!measureText.endsWith(unit)) {
		return undefined;
	}

	const unitStart = measureText.length - unit.length;
	const amountText = measureText.slice(0, unitStart).trimEnd();
	const { quantity, quantity2 } = parsed;
	const amount =
		quantity2 !== null && quantity2 < 1 && hyphenatedMixedNumber.test(amountText)
			? toAmount(quantity + quantity2, null)
			: toAmount(quantity, quantity2);
	if (
		amount === undefined ||
		!amountPattern.test(amountText) ||
		continuedNumber.test(line.charAt(amountText.length))
	) {
		return undefined;
	}

	if (unit === '') {
		return { amount, description: parsed.description };
	}

	const size = unitSize.exec(parsed.description)?.[0] ?? '';
	return {
		amount,
		unit: size === '' ? unit : line.slice(unitStart, descriptionStart + size.length),
		description: parsed.description
			.slice(size.length)
			.trimStart()
			.replace(/^of\s+/iu, ''),
	};
}

// A closing note moves to the front of the preparation, so the item names only the ingredient.
function withTrailingNote(item: string, preparation = ''): ItemParts {
	const note = trailingNote.exec(item);
	const rest =
		note === null ? '' : item.slice(0, note.index).trimEnd().replace(/,$/u, '').trimEnd();
	if (note !== null && rest !== '') {
		return { item: rest, preparation: preparation === '' ? note[0] : `${note[0]}, ${preparation}` };
	}

	return preparation === '' ? { item } : { item, preparation };
}

// The preparation follows the first comma outside parentheses: "1 cup (240 ml, warm) milk, divided".
function splitPreparation(description: string): ItemParts {
	let depth = 0;
	for (let index = 0; index < description.length; index += 1) {
		const character = description[index];
		if (character === '(') {
			depth += 1;
		} else if (character === ')') {
			depth = Math.max(0, depth - 1);
		} else if (character === ',' && depth === 0) {
			return withTrailingNote(
				description.slice(0, index).trim(),
				description.slice(index + 1).trim()
			);
		}
	}

	return withTrailingNote(description.trim());
}

// The line's structure, read only where it is unambiguous; anything else keeps the text as its item.
export function parseIngredientLine(text: string): IngredientLine {
	const line = text.trim();
	// Too long to be one ingredient, so the line is left unread and the schema refuses it.
	if (line.length > maxIngredientLineLength) {
		return { text: line, item: line };
	}

	const measure = readMeasure(line);
	if (measure !== undefined) {
		const parts = splitPreparation(measure.description);
		if (parts.item !== '') {
			return measure.unit === undefined
				? { text: line, amount: measure.amount, ...parts }
				: { text: line, amount: measure.amount, unit: measure.unit, ...parts };
		}
	}

	return { text: line, ...withTrailingNote(line) };
}

// An amount on its own, such as a yield of "4 to 6".
export function parseAmountText(text: string): Amount | undefined {
	const measure = readMeasure(text.trim());
	return measure !== undefined && measure.unit === undefined && measure.description === ''
		? measure.amount
		: undefined;
}
