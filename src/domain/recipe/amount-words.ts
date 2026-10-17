// Amounts written in words at the start of a text, read from a closed vocabulary: the numbers one
// to twelve; half, third, quarter, and fourth after a number or an article ("one-half", "a
// quarter", "two thirds") or alone ("half cup"); "half a" and "half an"; a whole number and a
// fraction ("two and a half", "1 and 1/2"); a range of two joined by "to" or "or", either end of
// which may be in numerals ("one to 2", "½ to one"); and "a" or "an". A whole or mixed number
// stands alone ("two eggs"), while an article or a fraction counts only before a unit the unit
// table reads ("a pinch of salt"), which the parser checks, so "a few", "a little", "a couple", and
// "an onion" read nothing. Left out on purpose: numbers past twelve and compounds such as
// "twenty-four", which recipes write in numerals; "halves", which names pieces ("pecan halves")
// more often than an amount; and "half and half", which names the cream however it is written.
// Hand-written, since words-to-numbers reads every "a" as 1, @insomnia-dev/words-to-numbers reads
// whole numbers only, and compromise misreads "one-half" and would add 143 KB to the recipe form.

export type AmountWords = {
	// The amount as the line writes it.
	written: string;
	// The same amount as the library reads it: "2 1/2" for "two and a half".
	numerals: string;
	// An article or a fraction is an amount only before a unit.
	needsUnit: boolean;
};

type Quantity = Pick<AmountWords, 'written' | 'numerals'>;

// One end of a range, and whether it stands alone, as a whole or mixed number or numerals do.
type RangeEnd = Quantity & { whole: boolean };

// A word that opens an approximate amount, as in "About 50" or "approx. 2".
export const approximationWord =
	/^(?:about|approximately|approx|around|roughly|nearly|almost|up\s+to)\b\.?\s*/iu;

// The vulgar fractions an amount may be written with: "½", "⅔".
const vulgarFractions = '[¼-¾⅐-⅞]';

// One quantity in numerals: a fraction or mixed number, a vulgar fraction, a decimal, or a whole
// number.
export const numeralQuantity = String.raw`(?:\d+(?:\s+\d+)?\s*[/⁄]\s*\d+|\d*\s*${vulgarFractions}|\d*\.\d+|\d+)`;

const wholeNumbers = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
} as const satisfies Record<string, number>;

// Each fraction word with its denominator.
const fractionWords = {
	half: 2,
	third: 3,
	thirds: 3,
	quarter: 4,
	quarters: 4,
	fourth: 4,
	fourths: 4,
} as const satisfies Record<string, number>;

// The fraction words that stand for one part on their own: "half cup", "quarter pound".
const singleFractionWords = [
	'half',
	'third',
	'quarter',
	'fourth',
] as const satisfies readonly (keyof typeof fractionWords)[];

const amountArticles = ['a', 'an'] as const;

// The words that spell out a whole number.
export const wholeNumberWords: readonly string[] = Object.keys(wholeNumbers);

// Every word that spells out a number or a part of one.
export const numberWords: readonly string[] = [...wholeNumberWords, ...Object.keys(fractionWords)];

// The number words past twelve, which it does not read, though one may still end a range: "12 to
// fifteen", "one to twenty-four".
export const unreadNumberWord = String.raw`(?:(?:thir|four|fif|six|seven|eigh|nine)teen|(?:twen|thir|for|fif|six|seven|eigh|nine)ty)(?:-\p{L}+)?(?!\p{L})`;

function anyWord(words: readonly string[]): string {
	return String.raw`(?:${words.join('|')})(?!\p{L})`;
}

const wholeWord = anyWord(Object.keys(wholeNumbers));
const article = anyWord(amountArticles);

// A quantity ends where a word does, or before punctuation that closes it, so "two-inch",
// "half-and-half", and "1,5" open with none, while "(one to 2)" holds a range.
const quantityEnd = String.raw`(?=\s|$|[);]|,(?!\d))`;

const wholePattern = new RegExp(String.raw`^${wholeWord}${quantityEnd}`, 'iu');

const numeralPattern = new RegExp(String.raw`^${numeralQuantity}${quantityEnd}`, 'u');

const countedFractionPattern = new RegExp(
	String.raw`^(${article}|${wholeWord})[\s-]+(${anyWord(Object.keys(fractionWords))})${quantityEnd}`,
	'iu'
);

const halfOfPattern = new RegExp(String.raw`^half\s+${article}${quantityEnd}`, 'iu');

const singleFractionPattern = new RegExp(
	String.raw`^${anyWord(singleFractionWords)}${quantityEnd}`,
	'iu'
);

const numeralFractionPattern = new RegExp(
	String.raw`^(?:\d+\s*[/⁄]\s*\d+|${vulgarFractions})${quantityEnd}`,
	'u'
);

const mixedNumberStart = new RegExp(String.raw`^(${wholeWord}|\d+)\s+and\s+`, 'iu');

const articleAlone = new RegExp(String.raw`^${article}${quantityEnd}`, 'iu');

const rangeSeparator = /^\s+(?:to|or)\s+/iu;

// The cream, written with spaces or an ampersand rather than hyphens: "Half and half", "half & half".
const halfAndHalf = /^half\s+(?:and|&)\s+half(?!\p{L})/iu;

function valueIn(table: Readonly<Record<string, number>>, word: string): number {
	const value = table[word.toLowerCase()];
	if (value === undefined) {
		throw new Error(`"${word}" is not in the amount words' vocabulary.`);
	}

	return value;
}

function wholeNumerals(word: string): string {
	return /^\d+$/u.test(word) ? word : String(valueIn(wholeNumbers, word));
}

function isArticle(word: string): boolean {
	return (amountArticles as readonly string[]).includes(word.toLowerCase());
}

// A fraction in words: "two-thirds" is 2/3, and "a quarter", "quarter", and "half a" are one part.
function readFraction(text: string): Quantity | undefined {
	const [counted, count, part] = countedFractionPattern.exec(text) ?? [];
	if (counted !== undefined && count !== undefined && part !== undefined) {
		const numerator = isArticle(count) ? '1' : wholeNumerals(count);
		return { written: counted, numerals: `${numerator}/${valueIn(fractionWords, part)}` };
	}

	const halfOf = halfOfPattern.exec(text)?.[0];
	if (halfOf !== undefined) {
		return { written: halfOf, numerals: `1/${fractionWords.half}` };
	}

	const single = singleFractionPattern.exec(text)?.[0];
	return single === undefined
		? undefined
		: { written: single, numerals: `1/${valueIn(fractionWords, single)}` };
}

// A whole number and a fraction, in words or numerals: "two and a half", "1 and 1/2".
function readMixedNumber(text: string): Quantity | undefined {
	const [start, whole] = mixedNumberStart.exec(text) ?? [];
	if (start === undefined || whole === undefined) {
		return undefined;
	}

	const rest = text.slice(start.length);
	const numeralFraction = numeralFractionPattern.exec(rest)?.[0];
	const fraction =
		numeralFraction === undefined
			? readFraction(rest)
			: { written: numeralFraction, numerals: numeralFraction.replace(/\s+/gu, '') };
	return fraction === undefined
		? undefined
		: {
				written: `${start}${fraction.written}`,
				numerals: `${wholeNumerals(whole)} ${fraction.numerals}`,
			};
}

function readRangeEnd(text: string): RangeEnd | undefined {
	const mixed = readMixedNumber(text);
	if (mixed !== undefined) {
		return { ...mixed, whole: true };
	}

	const fraction = readFraction(text);
	if (fraction !== undefined) {
		return { ...fraction, whole: false };
	}

	const whole = wholePattern.exec(text)?.[0];
	if (whole !== undefined) {
		return { written: whole, numerals: wholeNumerals(whole), whole: true };
	}

	const numerals = numeralPattern.exec(text)?.[0];
	return numerals === undefined ? undefined : { written: numerals, numerals, whole: true };
}

// Numerals the library reads as they are need no rewriting: "2 to 3".
function rewritten(amount: AmountWords): AmountWords | undefined {
	return amount.numerals === amount.written ? undefined : amount;
}

// The amount in words that opens the text, or nothing where it opens with none. A range whose end it
// cannot read, as in "twelve to fifteen", is none.
export function readAmountWords(text: string): AmountWords | undefined {
	if (halfAndHalf.test(text)) {
		return undefined;
	}

	const first = readRangeEnd(text);
	if (first === undefined) {
		const alone = articleAlone.exec(text)?.[0];
		return alone === undefined ? undefined : { written: alone, numerals: '1', needsUnit: true };
	}

	const afterFirst = text.slice(first.written.length);
	const separator = rangeSeparator.exec(afterFirst)?.[0];
	if (separator === undefined) {
		return rewritten({ written: first.written, numerals: first.numerals, needsUnit: !first.whole });
	}

	const second = readRangeEnd(afterFirst.slice(separator.length));
	return second === undefined
		? undefined
		: rewritten({
				written: `${first.written}${separator}${second.written}`,
				numerals: `${first.numerals}${separator}${second.numerals}`,
				needsUnit: !first.whole || !second.whole,
			});
}
