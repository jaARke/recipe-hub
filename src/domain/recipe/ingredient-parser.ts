import { parseIngredient, type ParseIngredientOptions } from 'parse-ingredient';
import type { Amount } from '@/domain/recipe/amount';
import { approximationWord, numeralQuantity, readAmountWords } from '@/domain/recipe/amount-words';
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { readingOptions, readUnit, sizes, splitUnitMarker } from '@/domain/recipe/ingredient-units';
import { withoutListMarkers } from '@/domain/recipe/list-markers';
import { normalizeText, withoutTrailingPunctuation } from '@/domain/text-normalization';

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

// A line written the way the parser reads every part of it: amount, unit, item, and preparation.
// The import prompt shows it, so its words are ones a card seldom holds.
export const exampleIngredientLine = '3 ribs celery, sliced';

// Punctuation that only ends a line, as in "2 cups flour;". A period that ends a unit stays.
const lineEndPunctuation = ';,.';

// The ways the library joins a range's two quantities: a dash, or "to" or "or".
const rangeDash = String.raw`[-\u2013\u2014]`;
const rangeWord = '(?:to|or)';

// A quantity, or a range of two joined the way the library joins them.
const amountPattern = new RegExp(
	String.raw`^${numeralQuantity}(?:(?:\s*${rangeDash}\s*|\s+${rangeWord}\s+)${numeralQuantity})?$`,
	'iu'
);

// The words after the amount, or after its unit, join it to a range's end the library did not read,
// so the amount is only the range's start: "12 to fifteen apples", "2 or more eggs", "1 cup to 1 1/2
// cups milk".
const unreadRangeEnd = new RegExp(String.raw`^(?:${rangeDash}|${rangeWord}(?=\s))`, 'iu');

// On old recipe cards "1-1/2" is a mixed number, since a range cannot fall from 1 to 1/2.
const hyphenatedMixedNumber = /^[1-9]\d*[-\u2013]\d+[/⁄]\d+$/u;

// The number goes on past what the library read, as in "2-inch piece" or "1,5 kg".
const continuedNumber = /[\d,./⁄\-\u2013\u2014]/u;

// A size in parentheses right after the unit belongs to it: "1 can (14 ounces) tomatoes".
const unitSize = /^\([^()]*\)(?=\s)/u;

// The "of" a line may write between its unit and its item, left out of the item: "1 cup of sugar".
const leadingOf = /^of\s+/iu;

// What a line writes between its item and its preparation: a comma, spaces, or both.
const preparationGap = /[\s,]*$/u;

// Closing phrases that say how an ingredient is used rather than what it is: "Salt to taste".
const trailingNote =
	/(?<=[\s,])(?:to taste|as needed|optional|for garnish|for serving|for dusting|for the .+)$/iu;

// Stands in for each character parentheses hold, as no space, comma, or letter does.
const parenthesizedBlank = '_';

function toAmount(min: number, max: number | null): Amount | undefined {
	if (!Number.isFinite(min) || min <= 0) {
		return undefined;
	}

	if (max === null) {
		return { min };
	}

	return Number.isFinite(max) && max > min ? { min, max } : undefined;
}

// The amount the library's two quantities stand for in the text it read them from, or nothing where
// they make none, such as a range that falls. "1-1/2" is a mixed number, which the library reads as
// the quantities 1 and 1/2.
export function amountOfQuantities(
	quantity: number,
	quantity2: number | null,
	amountText: string
): Amount | undefined {
	return quantity2 !== null && quantity2 < 1 && hyphenatedMixedNumber.test(amountText)
		? toAmount(quantity + quantity2, null)
		: toAmount(quantity, quantity2);
}

// The amount and unit that open the line, as the library reads them, or nothing it may misread. An
// amount in words is read as its numerals: "two eggs" as "2 eggs".
function readMeasure(line: string): Measure | undefined {
	if (line.length > maxReadLineLength) {
		return undefined;
	}

	const words = readAmountWords(line);
	const reading =
		words === undefined ? line : `${words.numerals}${line.slice(words.written.length)}`;
	const [parsed] = parseIngredient([reading], libraryOptions);
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
	if (!reading.endsWith(description)) {
		return undefined;
	}

	const descriptionStart = reading.length - description.length;
	const measureText = reading.slice(0, descriptionStart).trimEnd();
	if (!measureText.endsWith(unit)) {
		return undefined;
	}

	const unitStart = measureText.length - unit.length;
	const amountText = measureText.slice(0, unitStart).trimEnd();
	const amount = amountOfQuantities(parsed.quantity, parsed.quantity2, amountText);
	if (
		amount === undefined ||
		!amountPattern.test(amountText) ||
		continuedNumber.test(reading.charAt(amountText.length)) ||
		unreadRangeEnd.test(description) ||
		// The words' numerals run on into the line's, as in "a 1/2 cup".
		(words !== undefined && amountText !== words.numerals)
	) {
		return undefined;
	}

	if (unit === '') {
		// The marker after a doubtful amount stays with the unit it would hide: "1 1/2 [?] cups flour".
		const { marker, unit: afterMarker } = splitUnitMarker(description);
		if (marker !== '') {
			const unmarked = readMeasure(`${amountText} ${afterMarker}`);
			if (unmarked?.unit !== undefined) {
				return { ...unmarked, unit: `${marker}${unmarked.unit}` };
			}
		}

		// An article or a fraction in words is an amount only before a unit, so "an onion" has none.
		if (words?.needsUnit === true) {
			return undefined;
		}

		// The library reads no unit that ends the line, so "1/4 tsp" would name "tsp" as the item.
		if (description !== '' && readUnit(description) !== undefined) {
			return undefined;
		}

		return { amount, description };
	}

	const size = unitSize.exec(description)?.[0] ?? '';
	return {
		amount,
		unit: size === '' ? unit : reading.slice(unitStart, descriptionStart + size.length),
		description: description.slice(size.length).trimStart().replace(leadingOf, ''),
	};
}

// The text with what parentheses hold, and the parentheses, blanked, so a search finds only what
// stands outside them, where it stands.
function outsideParentheses(text: string): string {
	let outside = '';
	let depth = 0;
	for (let index = 0; index < text.length; index += 1) {
		const character = text.charAt(index);
		if (character === '(') {
			depth += 1;
		}

		outside += depth === 0 ? character : parenthesizedBlank;
		if (character === ')') {
			depth = Math.max(0, depth - 1);
		}
	}

	return outside;
}

// A closing note moves to the front of the preparation, so the item names only the ingredient. One
// inside parentheses stays: "eggs (1 for the dough and 1 for the wash)".
function withTrailingNote(item: string, preparation = ''): ItemParts {
	const index = outsideParentheses(item).search(trailingNote);
	const rest = index === -1 ? '' : item.slice(0, index).trimEnd().replace(/,$/u, '').trimEnd();
	if (rest !== '') {
		const note = item.slice(index);
		return { item: rest, preparation: preparation === '' ? note : `${note}, ${preparation}` };
	}

	return preparation === '' ? { item } : { item, preparation };
}

// Where the commas outside parentheses fall: "1 cup (240 ml, warm) milk, divided" has one.
function topLevelCommas(description: string): number[] {
	return [...outsideParentheses(description).matchAll(/,/gu)].map(({ index }) => index);
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

// Whether the text's last word is a unit written with its period, as in "1/4 tsp.". A word longer
// than any line the library reads is none, since its scan slows on long text.
function endsWithAbbreviatedUnit(text: string): boolean {
	const lastWord = text.slice(text.lastIndexOf(' ') + 1);
	return lastWord.length <= maxReadLineLength && readUnit(lastWord) !== undefined;
}

// The text without the given punctuation where it only ends the text, keeping the period of a unit
// written as an abbreviation: "2 cups flour;" ends at "flour", and "1/4 tsp." keeps its period.
export function withoutClosingPunctuation(text: string, punctuation: string): string {
	const kept = withoutTrailingPunctuation(text, punctuation);
	const withPeriod = `${kept}.`;
	return text.charAt(kept.length) === '.' && endsWithAbbreviatedUnit(withPeriod)
		? withPeriod
		: kept;
}

// The line as stored: tidied as all text is, without the bullet or number a list put before it or
// the punctuation that only ends it. Words and their case stay as written. A line left as only a
// marker once its punctuation goes, such as "2);", is none, so tidying a tidied line changes nothing.
export function normalizeIngredientLine(text: string): string {
	const line = withoutListMarkers(normalizeText(text).trim());
	return withoutListMarkers(withoutClosingPunctuation(line, lineEndPunctuation));
}

// The line's structure, read only where it is unambiguous; anything else keeps the text as its item.
export function parseIngredientLine(text: string): IngredientLine {
	const line = normalizeIngredientLine(text);
	if (line.length > maxReadLineLength) {
		return { text: line, item: line };
	}

	// An approximate amount reads as its number: "about 2 cups flour" is 2 cups.
	const measure = readMeasure(line.replace(approximationWord, ''));
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
	return preparationGap.exec(before)?.[0] || ', ';
}

// What the line writes between its unit and its item that neither holds: the "of " in "1 cup of
// water". It is read back from the item, since a scaled line's unit is not the one its text writes.
export function wordsAfterUnit(line: IngredientLine): string {
	const { text, item, preparation = '' } = line;
	if (!text.endsWith(preparation)) {
		return '';
	}

	const throughItem = text.slice(0, text.length - preparation.length).replace(preparationGap, '');
	if (!throughItem.endsWith(item)) {
		return '';
	}

	const lastWord = /\S+\s+$/u.exec(throughItem.slice(0, throughItem.length - item.length))?.[0];
	return lastWord !== undefined && leadingOf.test(lastWord) ? lastWord : '';
}

// An amount on its own, such as a yield of "4 to 6".
export function parseAmountText(text: string): Amount | undefined {
	const measure = readMeasure(text.trim());
	return measure !== undefined && measure.unit === undefined && measure.description === ''
		? measure.amount
		: undefined;
}
