import { parseIngredient, type ParseIngredientOptions } from 'parse-ingredient';
import type { Amount } from '@/domain/recipe/amount';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { readingOptions, readUnit, sizes } from '@/domain/recipe/ingredient-units';

type ItemParts = Pick<IngredientLine, 'item' | 'preparation'>;

type Measure = {
	amount: Amount;
	unit?: string;
	// What follows the amount and unit: the item and any preparation.
	description: string;
};

const libraryOptions: ParseIngredientOptions = {
	...readingOptions,
	// "of" is dropped only after a unit, so "2 of the eggs" keeps it.
	allowLeadingOf: true,
};

// The longest line the parser reads, since the library's quantity scan slows sharply on long text,
// which no ingredient needs. A longer line keeps its text as its item.
export const maxReadLineLength = 500;

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
	if (line.length > maxReadLineLength) {
		return undefined;
	}

	const [parsed] = parseIngredient([line], libraryOptions);
	if (parsed === undefined || parsed.quantity === null) {
		return undefined;
	}

	let unit = parsed.unitOfMeasure ?? '';
	let description = parsed.description;
	// The library ends "fl oz." before its period, which belongs to the unit.
	if (unit !== '' && /^\.(?:\s|$)/u.test(description)) {
		unit = `${unit}.`;
		description = description.slice(1).trimStart();
	}

	// The library also reads a quantity from the end of a line ("Juice of 1 lemon"), which is no amount.
	if (!line.endsWith(description)) {
		return undefined;
	}

	const descriptionStart = line.length - description.length;
	const measureText = line.slice(0, descriptionStart).trimEnd();
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
		// The library reads no unit that ends the line, so "1/4 tsp" would name "tsp" as the item.
		if (description !== '' && readUnit(description) !== undefined) {
			return undefined;
		}

		return { amount, description };
	}

	const size = unitSize.exec(description)?.[0] ?? '';
	return {
		amount,
		unit: size === '' ? unit : line.slice(unitStart, descriptionStart + size.length),
		description: description
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

// Where the commas outside parentheses fall: "1 cup (240 ml, warm) milk, divided" has one.
function topLevelCommas(description: string): number[] {
	const commas: number[] = [];
	let depth = 0;
	for (let index = 0; index < description.length; index += 1) {
		const character = description[index];
		if (character === '(') {
			depth += 1;
		} else if (character === ')') {
			depth = Math.max(0, depth - 1);
		} else if (character === ',' && depth === 0) {
			commas.push(index);
		}
	}

	return commas;
}

// A lone word that describes an item rather than names one, by its shape: a size, a word such as
// "boneless", or a compound such as "bone-in".
function isDescribingWord(segment: string): boolean {
	return /^(?:\p{L}+less|\p{L}+-\p{L}+)$/iu.test(segment) || sizes.includes(segment.toLowerCase());
}

// The preparation follows the first comma outside parentheses, unless that comma sits in a run of
// describing words before the item: "boneless, skinless chicken breast, cut into strips".
function splitPreparation(description: string): ItemParts {
	const commas = topLevelCommas(description);
	const segments = [...commas, description.length].map((end, index) =>
		description.slice(index === 0 ? 0 : (commas[index - 1] ?? 0) + 1, end).trim()
	);
	const run = segments.findIndex((segment) => !isDescribingWord(segment));
	const itemWords = segments[run]?.split(/\s+/u).length ?? 0;
	const itemEnd = commas[run > 0 && itemWords >= 2 ? run : 0];
	if (itemEnd === undefined) {
		return withTrailingNote(description.trim());
	}

	return withTrailingNote(
		description.slice(0, itemEnd).trim(),
		description.slice(itemEnd + 1).trim()
	);
}

// The line's structure, read only where it is unambiguous; anything else keeps the text as its item.
export function parseIngredientLine(text: string): IngredientLine {
	const line = text.trim();
	if (line.length > maxReadLineLength) {
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

// What the line writes between its item and preparation: the comma in "1 onion, diced", or the space
// in "6 tablespoons sugar for the tops". A preparation the text does not end with takes a comma.
export function preparationSeparator(line: IngredientLine): string {
	if (line.preparation === undefined || !line.text.endsWith(line.preparation)) {
		return ', ';
	}

	const before = line.text.slice(0, line.text.length - line.preparation.length);
	return /[\s,]*$/u.exec(before)?.[0] || ', ';
}

// An amount on its own, such as a yield of "4 to 6".
export function parseAmountText(text: string): Amount | undefined {
	const measure = readMeasure(text.trim());
	return measure !== undefined && measure.unit === undefined && measure.description === ''
		? measure.amount
		: undefined;
}
