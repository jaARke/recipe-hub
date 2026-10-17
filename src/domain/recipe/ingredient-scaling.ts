// Ingredient lines at another scale, worked out when a recipe renders, so nothing stored changes.
// parse-ingredient reads the units and the measurements inside a line and converts between units;
// the rounding is our own, since no library rounds the way a cook measures: format-quantity writes
// unrounded thirds and twelfths as long decimals, convert-units is unmaintained, convert's best unit
// turns 6 tablespoons into 3 fluid ounces, recipe-scale-conv writes "0.17 cup", and cooking-units
// does not scale.
import {
	convertUnit,
	extractMeasurements,
	type ConvertUnitOptions,
	type Measurement,
	type UnitType,
} from 'parse-ingredient';
import pluralize from 'pluralize';
import type { Amount } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import {
	approximationWord,
	numberWords,
	readAmountWords,
	unreadNumberWord,
	wholeNumberWords,
	type AmountWords,
} from '@/domain/recipe/amount-words';
import type { IngredientLine, IngredientLineSpan } from '@/domain/recipe/ingredient';
import { amountOfQuantities, parseAmountText } from '@/domain/recipe/ingredient-parser';
import {
	isMetricUnit,
	readingOptions,
	readUnit,
	sizes,
	splitUnitMarker,
	unitDefinitions,
	type MetricUnit,
} from '@/domain/recipe/ingredient-units';

// What the scale left unscaled that a cook would scale: the whole line, when nothing in it was read
// though it gives an amount ("a few sprigs thyme", "Juice of 1 lemon"), which the page marks "Not
// scaled"; or the amounts in it the scale could not vouch for, such as the "1 pound" in "2 sweet
// potatoes (about 1 pound)", which may be each potato's or both, and which the page marks in place.
export type UnscaledPart = 'whole' | { amounts: readonly IngredientLineSpan[] };

export type ScaledIngredientLine = {
	// The line at the scale, in the shape the recipe page renders; its text stays the original.
	line: IngredientLine;
	// Absent when the scale read everything a cook would scale, as in "Salt to taste".
	unscaled?: UnscaledPart;
};

// A run of text by its offsets.
type TextSpan = { start: number; end: number };

// The text a span covers, replaced.
type Edit = TextSpan & { replacement: string };

// Text the scale went through, at the scale, with the amounts in it the scale left unscaled.
type ScaledText = { text: string; unscaled: TextSpan[] };

// A number in text the scale left as written, with the amount it reads as where it reads as one, and
// the measurement it gives with a unit after it: "1 ¾ cups", or "a quarter cup" read as "1/4 cup".
type WrittenNumber = TextSpan & {
	amount?: Amount;
	measurement?: Measurement;
};

// What a line tells the scale about the numbers its text leaves as written.
type LineContext = {
	factor: number;
	// Measured by volume or weight, so a second amount, or an equivalent of the line's, scales with it.
	isMeasure: boolean;
	// The count a line without a measure gives, as written: the 1 in "1 whole chicken" or "1 can".
	count?: Amount;
};

// What the scale does with a number its text leaves as written: scales it, keeps it as right at any
// scale, or keeps it and marks it unscaled.
type Treatment = 'scale' | 'keep' | 'unscaled';

// What a C after degrees reads as: a temperature, a cup, or either, where the text cannot tell.
type CelsiusOrCup = 'celsius' | 'cup' | 'either';

// The amounts the words a count counts agree with: as written, and at the scale.
type Agreement = { written: Amount; scaled: Amount };

type Rounding = (value: number) => number;

type Measure = {
	amount: Amount;
	// Undefined for a count without a unit, or a unit the table does not hold.
	unit?: string;
};

type Reading = Measure & {
	// How far the rounding strays at the worse end, as a share of the exact amount.
	error: number;
};

// A unit as stored, with any marker before it and any note in parentheses after it:
// "[?] can (14 ounces)".
type WrittenUnit = {
	marker: string;
	name: string;
	gap: string;
	note?: string;
};

// A measurement found in a line's text, with the amount it reads as.
type ReadMeasurement = {
	measurement: Measurement;
	amount: Amount;
};

// A measurement that opens the item: "2 cups plus 2 tablespoons flour" or "1 lb 2 oz beef".
type OpeningMeasurement = ReadMeasurement & {
	prefix: string;
	rest: string;
};

// The nearest multiple of the step. A fractional step divides, so thirds and twentieths come out
// exactly as their fractions do.
function roundToStep(value: number, step: number): number {
	if (step >= 1) {
		return Math.round(value / step) * step;
	}

	const perUnit = 1 / step;
	return Math.round(value * perUnit) / perUnit;
}

// The nearest of the steps' multiples, never below the smallest step, so an amount never rounds
// away: nothing goes below ⅛ teaspoon.
function toSteps(...steps: number[]): Rounding {
	const smallest = Math.min(...steps);
	return (value) => {
		const nearest = steps
			.map((step) => roundToStep(value, step))
			.reduce((best, candidate) =>
				Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
			);
		return Math.max(smallest, nearest);
	};
}

const quarters = toSteps(1 / 4);
const halves = toSteps(1 / 2);

// Counts, and units without steps of their own, in quarters below 1 and halves from 1.
const countRounding: Rounding = (value) => (value < 1 ? quarters(value) : halves(value));

const unitRoundings = {
	teaspoon: toSteps(1 / 8),
	tablespoon: halves,
	cup: toSteps(1 / 4, 1 / 3),
	'fluid ounce': halves,
	ounce: quarters,
	pound: quarters,
	// A stick's wrapper marks its tablespoons, two to a quarter.
	stick: quarters,
} as const satisfies Record<string, Rounding>;
type RoundedUnit = keyof typeof unitRoundings;

// Scaled metric amounts round to these steps: grams and milliliters whole, kilograms and liters to
// 0.05. Amounts at the original scale keep the decimals they were written with.
const metricSteps = {
	milligram: 1,
	gram: 1,
	kilogram: 0.05,
	milliliter: 1,
	centiliter: 1,
	deciliter: 0.05,
	liter: 0.05,
} as const satisfies Record<MetricUnit, number>;

// Whole grams and milliliters go to the nearest 5 from 100.
const wholeMetricStepFrom100 = 5;

function metricRounding(unit: MetricUnit): Rounding {
	const step = metricSteps[unit];
	if (step !== 1) {
		return toSteps(step);
	}

	const wholes = toSteps(1);
	const fives = toSteps(wholeMetricStepFrom100);
	return (value) => (value < 100 ? wholes(value) : fives(value));
}

function isRoundedUnit(unit: string): unit is RoundedUnit {
	return Object.hasOwn(unitRoundings, unit);
}

function roundingFor(unit: string | undefined): Rounding {
	if (unit === undefined) {
		return countRounding;
	}

	if (isRoundedUnit(unit)) {
		return unitRoundings[unit];
	}

	return isMetricUnit(unit) ? metricRounding(unit) : countRounding;
}

// US volume moves among these, largest first.
const usVolumeUnits = ['cup', 'tablespoon', 'teaspoon'] as const;
type UsVolumeUnit = (typeof usVolumeUnits)[number];

// The amounts a cook measures easily in each unit.
const readableRanges = {
	cup: { min: 1 / 4, max: Number.POSITIVE_INFINITY },
	tablespoon: { min: 1, max: 8 },
	teaspoon: { min: 1 / 8, max: 3 },
} as const satisfies Record<UsVolumeUnit, { min: number; max: number }>;

// An amount within this share of a larger unit's step lands on it: 3 teaspoons is 1 tablespoon.
const landedTolerance = 0.02;
// The cook's unit is kept while its rounding stays within this share.
const keptTolerance = 0.05;
// Rounding to the nearest step strays at most half a step, so no more than half of any amount of a
// step or more. A reading that strays further raised an end to its unit's smallest step, as 1 to 2
// teaspoons doubled would be to ¼ cup, and misstates it however easily it reads.
const closeTolerance = 1 / 2;

function isUsVolumeUnit(unit: string): unit is UsVolumeUnit {
	return (usVolumeUnits as readonly string[]).includes(unit);
}

function ends(amount: Amount): number[] {
	return amount.max === undefined ? [amount.min] : [amount.min, amount.max];
}

function times(amount: Amount, factor: number): Amount {
	return amount.max === undefined
		? { min: amount.min * factor }
		: { min: amount.min * factor, max: amount.max * factor };
}

function add(amount: Amount, other: Amount): Amount {
	return amount.max === undefined && other.max === undefined
		? { min: amount.min + other.min }
		: { min: amount.min + other.min, max: (amount.max ?? amount.min) + (other.max ?? other.min) };
}

// A noun agrees with the upper end: "1 to 2 eggs", "½ to 1 egg".
function isPlural(amount: Amount): boolean {
	return (amount.max ?? amount.min) > 1;
}

function readingIn(unit: string | undefined, exact: Amount): Reading {
	const round = roundingFor(unit);
	const error = Math.max(...ends(exact).map((value) => Math.abs(round(value) - value) / value));
	const min = round(exact.min);
	const max = exact.max === undefined ? undefined : round(exact.max);
	// Rounding can close a range, which then reads as one amount.
	const amount = max === undefined || max <= min ? { min } : { min, max };
	return unit === undefined ? { amount, error } : { amount, unit, error };
}

const conversionOptions: ConvertUnitOptions = { additionalUOMs: readingOptions.additionalUOMs };

function convert(amount: Amount, from: string, to: string): Amount | undefined {
	const factor = convertUnit(1, from, to, conversionOptions);
	return factor === null ? undefined : times(amount, factor);
}

function isReadable(reading: Reading & { unit: UsVolumeUnit }): boolean {
	const range = readableRanges[reading.unit];
	return ends(reading.amount).every((value) => value >= range.min && value <= range.max);
}

// A range picks its unit once, judged at both ends.
function volumeReading(exact: Amount, own: UsVolumeUnit): Reading {
	const readings = usVolumeUnits.flatMap((unit) => {
		const amount = convert(exact, own, unit);
		return amount === undefined ? [] : [{ ...readingIn(unit, amount), unit }];
	});
	const ownIndex = usVolumeUnits.indexOf(own);
	// A larger unit is taken only where it reads easily, so 1½ teaspoons is not ½ tablespoon.
	const landed = readings.find(
		(reading) =>
			usVolumeUnits.indexOf(reading.unit) < ownIndex &&
			reading.error <= landedTolerance &&
			isReadable(reading)
	);
	const kept = readings.find((reading) => reading.unit === own);
	if (landed !== undefined) {
		return landed;
	}

	if (kept !== undefined && isReadable(kept) && kept.error <= keptTolerance) {
		return kept;
	}

	// The sort is stable, so the larger unit wins a tie. Where no unit reads both ends easily and
	// close, the cook's unit does: 1 to 2 teaspoons doubles to 2 to 4 teaspoons.
	const closest = readings
		.filter((reading) => isReadable(reading) && reading.error <= closeTolerance)
		.sort((a, b) => a.error - b.error)[0];
	return closest ?? kept ?? readingIn(own, exact);
}

// Pounds move down to ounces off their quarter steps; mass never moves up.
function poundReading(exact: Amount): Reading {
	const kept = readingIn('pound', exact);
	const ounces = convert(exact, 'pound', 'ounce');
	return kept.error <= keptTolerance || ounces === undefined ? kept : readingIn('ounce', ounces);
}

function measureAt(exact: Amount, unit: string | undefined): Reading {
	if (unit !== undefined && isUsVolumeUnit(unit)) {
		return volumeReading(exact, unit);
	}

	return unit === 'pound' ? poundReading(exact) : readingIn(unit, exact);
}

function unitNamed(unit: string, amount: Amount): string {
	return isPlural(amount) ? (unitDefinitions[unit]?.plural ?? unit) : unit;
}

// Where the unit's name, singular or plural, starts at the end of the unit as written: after the
// describing word in "heaping tablespoons". An abbreviation holds none.
function unitNameStart(written: string, unit: string): number | undefined {
	const lower = written.toLowerCase();
	const name = [unit, unitDefinitions[unit]?.plural].find(
		(candidate) =>
			candidate !== undefined && (lower === candidate || lower.endsWith(` ${candidate}`))
	);
	return name === undefined ? undefined : written.length - name.length;
}

// A unit written out in full takes the number its amount takes, keeping its capital; an
// abbreviation stays as written.
function unitInNumber(written: string, unit: string, amount: Amount): string {
	const start = unitNameStart(written, unit);
	if (start === undefined) {
		return written;
	}

	const replacement = unitNamed(unit, amount);
	const initial =
		written.charAt(start) === written.charAt(start).toLowerCase()
			? replacement.charAt(0)
			: replacement.charAt(0).toUpperCase();
	return `${written.slice(0, start)}${initial}${replacement.slice(1)}`;
}

// The unit a measure is written in: as before when it stayed, spelled out when it changed, after any
// describing word it had: "2 heaping tablespoons" doubles to "¼ heaping cup".
function unitText(written: string, unit: string | undefined, measure: Measure): string {
	if (measure.unit === undefined || unit === undefined) {
		return written;
	}

	if (measure.unit === unit) {
		return unitInNumber(written, unit, measure.amount);
	}

	const describing = written.slice(0, unitNameStart(written, unit) ?? 0);
	return `${describing}${unitNamed(measure.unit, measure.amount)}`;
}

// The quantity's text, without its unit or a hyphen joining them: "1-1/2" in "1-1/2-ounce".
function quantityText(measurement: Measurement): string {
	const { text, unitOfMeasure } = measurement;
	return text.slice(0, text.length - unitOfMeasure.length).replace(/[\s\-\u2010-\u2015]+$/u, '');
}

// The measurements in the text that scale. A length stays true at any scale, and a quantity the
// parser would not read as an amount stays as written.
function scalableMeasurements(text: string): ReadMeasurement[] {
	return extractMeasurements(text, readingOptions).flatMap((measurement) => {
		if (measurement.unitType === 'length') {
			return [];
		}

		const { quantity, quantity2 } = measurement;
		const amount = amountOfQuantities(quantity, quantity2, quantityText(measurement));
		return amount === undefined ? [] : [{ measurement, amount }];
	});
}

function writeMeasurement(measurement: Measurement, measure: Measure): string {
	const unit = unitText(measurement.unitOfMeasure, measurement.unitOfMeasureID, measure);
	return `${formatAmount(measure.amount, unit)} ${unit}`;
}

const openingPrefix = /^(?:plus\s+|\+\s*)/iu;

// A measurement opens the item after "plus" or "+", or right after a measure's unit as a second unit
// does. After a count's unit it is a size of each, as in "1 can 15 oz tomatoes", and stays.
function openingMeasurement(item: string, afterMeasure: boolean): OpeningMeasurement | undefined {
	const prefix = openingPrefix.exec(item)?.[0] ?? '';
	if (prefix === '' && !afterMeasure) {
		return undefined;
	}

	const rest = item.slice(prefix.length);
	const [first] = scalableMeasurements(rest);
	if (first === undefined || first.measurement.startIndex !== 0) {
		return undefined;
	}

	return { ...first, prefix, rest: rest.slice(first.measurement.endIndex) };
}

function wordsSource(words: readonly string[]): string {
	return `(?:${words.join('|')})`;
}

// A whole number in words, alone or joined by hyphens to more number words, as in "7 eggs plus one egg
// yolk", "twelve to fifteen", or "one-half". "five-spice" holds none.
const wholeNumberWord = new RegExp(
	String.raw`(?<![\p{L}-])${wordsSource(wholeNumberWords)}(?:-${wordsSource(numberWords)})*(?![\p{L}-])`,
	'giu'
);

// Where a word starts, as an amount in words does.
const wordStart = /(?<![\p{L}-])\p{L}/gu;

// Where a number may start: a numeral not inside another, or a word.
const numberStart = new RegExp(String.raw`(?<![\p{N}.,/⁄])\p{N}|${wordStart.source}`, 'gu');

// Numerals read as one amount, joined into a mixed number or a range as a line's amount is: "1 1/2",
// "2-3", "2 to 3". A run ends on a numeral, so "plus 1, beaten" holds "1".
const numeralRun =
	/\p{N}(?:[\p{N}.,/⁄]*\p{N})?(?:(?:\s+|\s*[-\u2013\u2014]\s*|\s+(?:to|or)\s+)\p{N}(?:[\p{N}.,/⁄]*\p{N})?)*/giu;

// After a count, the words that join it to a range's end in words past those it reads: "12 to
// fifteen". "or more" and "to grease" end no range.
const unreadRangeEnd = new RegExp(
	String.raw`^(?:\s+(?:to|or)\s+|\s*[-\u2013\u2014]\s*)${unreadNumberWord}`,
	'iu'
);

// A count a range word joins to a measurement's unit, counting nothing of its own, ends the
// measurement's range in that unit: "a tablespoon or two", "2 tablespoons to 1", but not "1
// tablespoon or 2 eggs".
const rangeWordAfterUnit = /^\s+(?:to|or)\s+$/iu;
const countsNothing = /^\s*(?:$|[),;]|of(?!\p{L}))/iu;

function overlaps(span: TextSpan, other: TextSpan): boolean {
	return span.start < other.end && other.start < span.end;
}

function measurementNumber(measurement: Measurement): WrittenNumber {
	const { quantity, quantity2, startIndex: start, endIndex: end } = measurement;
	const amount = amountOfQuantities(quantity, quantity2, quantityText(measurement));
	return amount === undefined ? { start, end, measurement } : { start, end, amount, measurement };
}

// An amount in words at the start of the text, where it counts: with its article or fraction ("half a
// lemon", "a half lime"), or with a unit after it ("a quarter cup", "a tablespoon"). A bare article or
// fraction names rather than counts: "half and half", "cut in half", "artichoke quarters".
function amountInWords(
	text: string,
	start: number,
	words: AmountWords,
	lengths: readonly TextSpan[]
): WrittenNumber | undefined {
	const after = text.slice(start + words.written.length);
	const unitFollows = readUnit(after.trimStart()) !== undefined;
	if (!unitFollows && !/\s/u.test(words.written)) {
		return undefined;
	}

	const end = start + words.written.length;
	const [measure] = unitFollows ? scalableMeasurements(`${words.numerals}${after}`) : [];
	const withUnit =
		measure === undefined || measure.measurement.startIndex !== 0
			? undefined
			: { start, end: end + measure.measurement.endIndex - words.numerals.length, ...measure };
	// A unit read past a length is the length's: "a 2-inch piece" counts no pieces.
	if (withUnit !== undefined && !lengths.some((length) => overlaps(withUnit, length))) {
		return withUnit;
	}

	const amount = parseAmountText(words.numerals);
	return amount === undefined ? { start, end } : { start, end, amount };
}

// The amounts written in words and numerals together, read whole before the library reads their
// numerals alone, so a range scales at both ends or neither: "one to 2 tablespoons", "½ to one", "1
// and 1/2 cups". One read past a length is the length's.
function mixedAmounts(text: string, lengths: readonly TextSpan[]): WrittenNumber[] {
	const found: WrittenNumber[] = [];
	for (const { index: start } of text.matchAll(numberStart)) {
		const words = readAmountWords(text.slice(start));
		const number =
			words === undefined || !/\p{N}/u.test(words.written)
				? undefined
				: amountInWords(text, start, words, lengths);
		if (number !== undefined && ![...lengths, ...found].some((taken) => overlaps(number, taken))) {
			found.push(number);
		}
	}

	return found;
}

// A count with the amount it reads as, or, before a range's end it did not read with it, the range
// as written, which reads as none.
function countIn(text: string, span: TextSpan, amount: Amount | undefined): WrittenNumber {
	const unread = unreadRangeEnd.exec(text.slice(span.end))?.[0];
	if (unread !== undefined) {
		return { start: span.start, end: span.end + unread.length };
	}

	return amount === undefined ? span : { ...span, amount };
}

// The numbers in text other than lengths, which stay true at any scale: the "2" in "cut into 2-inch
// pieces" is none. A number is an amount in words and numerals, a measurement with its unit, a run
// of numerals, or an amount in words.
function writtenNumbers(text: string): WrittenNumber[] {
	const measurements = extractMeasurements(text, readingOptions);
	const lengths = measurements
		.filter((measurement) => measurement.unitType === 'length')
		.map(({ startIndex, endIndex }) => ({ start: startIndex, end: endIndex }));
	const mixed = mixedAmounts(text, lengths);
	const found = [
		...mixed,
		...measurements
			.filter((measurement) => measurement.unitType !== 'length')
			.map(measurementNumber)
			.filter((number) => !mixed.some((amount) => overlaps(number, amount))),
	];
	// Every number found so far blanked, so no numeral or word in one is read again, and a run of
	// numerals stops before one: "4 8-ounce links" counts 4.
	const rest = [...lengths, ...found].reduce(
		(blanked, { start, end }) =>
			`${blanked.slice(0, start)}${' '.repeat(end - start)}${blanked.slice(end)}`,
		text
	);
	const isFree = (span: TextSpan) => ![...lengths, ...found].some((taken) => overlaps(span, taken));

	for (const { 0: run, index: start } of rest.matchAll(numeralRun)) {
		const span = { start, end: start + run.length };
		if (isFree(span)) {
			found.push(countIn(text, span, parseAmountText(run)));
		}
	}

	for (const { index: start } of rest.matchAll(wordStart)) {
		const words = readAmountWords(rest.slice(start));
		const number = words === undefined ? undefined : amountInWords(rest, start, words, lengths);
		if (number !== undefined && isFree(number)) {
			found.push(number);
		}
	}

	for (const { 0: written, index: start } of rest.matchAll(wholeNumberWord)) {
		const span = { start, end: start + written.length };
		const numerals = readAmountWords(written)?.numerals;
		if (isFree(span)) {
			found.push(
				countIn(text, span, numerals === undefined ? undefined : parseAmountText(numerals))
			);
		}
	}

	return withRangesAfterUnits(text, found);
}

// The numbers in order, with each measurement whose range ends after its unit read as no amount,
// since the end's unit moves with the measurement's: "a tablespoon or two" at half is not "1½
// teaspoons or 1".
function withRangesAfterUnits(text: string, numbers: readonly WrittenNumber[]): WrittenNumber[] {
	const read: WrittenNumber[] = [];
	for (const number of [...numbers].sort((a, b) => a.start - b.start)) {
		const previous = read[read.length - 1];
		if (
			previous?.measurement !== undefined &&
			number.measurement === undefined &&
			rangeWordAfterUnit.test(text.slice(previous.end, number.start)) &&
			countsNothing.test(text.slice(number.end))
		) {
			read[read.length - 1] = {
				start: previous.start,
				end: number.end,
				measurement: previous.measurement,
			};
		} else {
			read.push(number);
		}
	}

	return read;
}

// Text gives an amount when it holds a number other than a length or opens with an amount in words,
// read or not, that is an amount: "a few sprigs thyme", "half a lemon", but not "Bake at 350 F for 20
// minutes". It marks a line the parser read nothing in, and a step whose own amounts a scaled
// recipe's note speaks for.
export function givesAmount(text: string): boolean {
	const opening = readAmountWords(text);
	const numbers =
		opening === undefined
			? writtenNumbers(text)
			: [openingNumber(opening), ...writtenNumbers(text)];
	return numbers.some((number) => !isNoAmount(number, text));
}

// The amount in words that opens text, with the amount it reads as: "Half" in "Half of the eggs".
function openingNumber({ written, numerals }: AmountWords): WrittenNumber {
	const span = { start: 0, end: written.length };
	const amount = parseAmountText(numerals);
	return amount === undefined ? span : { ...span, amount };
}

// What makes a number no amount. Before it: a can's size, a note's or a step's number, a grade or a
// strength, a ratio's first term, or what something is cut into ("#10 can", "No. 10 can", "Note 2",
// "size 2", "tipo 00", "T55", "pH 7", "1:16", "divided into 3 portions"). After it, alone or joined
// by a hyphen: a temperature, a time, a share, a ratio, a strength, a count of times, or a pan's
// other side ("110°F", "110 F", "350 degrees", "5-minute", "aged 18 months", "2% fat", "1:1", "1
// part sugar", "80 proof", "sifted 2 times", "2x", "9x13").
const noAmountBefore =
	/(?:[#\p{L}]|\p{N}\s*[x×:]\s*|(?<!\p{L})(?:note|step|size|type|tipo|grade|no\.|number|ph)\s*|(?<!\p{L})into\s+)$/iu;
const noAmountAfter =
	/^[\s\-\u2010-\u2015]*(?:[°º˚%]|:\s*\p{N}|[x×](?![\p{L}-])|f(?![\p{L}\p{N}])|(?:deg(?:ree)?|sec(?:ond)?|min(?:ute)?|h(?:ou)?r|day|week|month|y(?:ea)?r|part|time)s?(?!\p{L})|(?:per\s?cent|fahrenheit|celsius|centigrade|ratio|proof)(?!\p{L}))/iu;
// A C after two digits or more, with any decimals, is a temperature in Celsius ("45 C", "40.5 C", "40
// to 45 C", "between 40 and 45 C"), where one after a single digit is a cup, as old cards write it
// ("1 C"). Old cards also write a cup "C.", so with a period it is Celsius only after a word that
// sets a temperature, a cup before a word ("12 C. flour", "(12 C. Water)", "Add 12 C. Flour"), and
// either where nothing tells an abbreviation's period from a sentence's ("(12 C.)").
const celsiusDegrees = String.raw`\d{2,}(?:[.,]\d+)?`;
const degreesC = new RegExp(
	String.raw`^(?:[Bb]etween\s+${celsiusDegrees}\s+and\s+|${celsiusDegrees}\s*(?:[-\u2013\u2014]|to|or)\s*)?${celsiusDegrees}\s*C(?!\p{L})`,
	'u'
);
const wordAfterPeriod = /^\.\s*\p{L}/u;
// A word that sets the temperature the degrees after it give, with any word such as "about" between:
// "Bake at 180 C.", "Heat to about 45 C.", but not "up to 12 C.", which approximates an amount.
const temperatureWord = /(?<!\p{L})(?<!up\s+)(?:at|to)\s+/giu;
// A number written in zeros is a grade, as in "00 flour", and a fraction no smaller than one a
// ratio, as in "80/20 ground beef": a recipe writes neither as an amount.
const zeros = /^0+$/u;
const fraction = /^(\d+)\s*[/⁄]\s*(\d+)$/u;
// A number alone in parentheses, after any word such as "about", names nothing it counts: "(2)",
// "(about 2)".
const closesAlone = /^\s*[),;]/u;
// A share of the whole a line gives is right at any scale: a fraction before "of" and the whole ("½
// of them", "a third of the eggs", "½ of it", "½ of this"), and either term of a proportion, with or
// without a unit ("one of every two", "1 in every 3", "1 of every 2 cups", "1 cup of every 2"). A
// count of the whole is a share the scale changes ("2 of them"), as is a rate's base, which scales with
// the amount before it ("1 tablespoon salt for every 2 cups water").
const ofTheWhole = /^\s+of\s+(?:them|it|this|that|the|these|those)(?!\p{L})/iu;
const proportionTerm = String.raw`(?:\p{N}+|${wordsSource(wholeNumberWords)}(?!\p{L}))`;
const ofEvery = String.raw`\s+(?:of|in)\s+every\s+`;
const proportionFirstTerm = new RegExp(String.raw`^${ofEvery}${proportionTerm}`, 'iu');
const proportionSecondTerm = new RegExp(
	String.raw`(?<![\p{L}\p{N}])${proportionTerm}(?:\s*\p{L}+\.?)?${ofEvery}$`,
	'iu'
);

function isGradeOrRatio(written: string): boolean {
	const [, numerator, denominator] = fraction.exec(written) ?? [];
	return zeros.test(written) || Number(numerator) >= Number(denominator);
}

function isShareOfWhole(
	{ amount, measurement }: WrittenNumber,
	before: string,
	after: string
): boolean {
	const isFraction = amount !== undefined && (amount.max ?? amount.min) < 1;
	return (
		proportionFirstTerm.test(after) ||
		proportionSecondTerm.test(before) ||
		(measurement === undefined && isFraction && ofTheWhole.test(after))
	);
}

function setsTemperature(before: string): boolean {
	const word = [...before.matchAll(temperatureWord)].at(-1);
	if (word === undefined) {
		return false;
	}

	const between = before.slice(word.index + word[0].length);
	return between === '' || approximationWord.exec(between)?.[0] === between;
}

// What a C after a number's degrees reads as, if one follows them.
function celsiusOrCup({ start }: WrittenNumber, text: string): CelsiusOrCup | undefined {
	const degrees = degreesC.exec(text.slice(start))?.[0];
	if (degrees === undefined) {
		return undefined;
	}

	const after = text.slice(start + degrees.length);
	if (!after.startsWith('.') || setsTemperature(text.slice(0, start))) {
		return 'celsius';
	}

	return wordAfterPeriod.test(after) ? 'cup' : 'either';
}

// Whether a number is no amount, so right as written at any scale.
function isNoAmount(number: WrittenNumber, text: string): boolean {
	const before = text.slice(0, number.start);
	const after = text.slice(number.end);
	return (
		noAmountBefore.test(before) ||
		noAmountAfter.test(after) ||
		celsiusOrCup(number, text) === 'celsius' ||
		isGradeOrRatio(text.slice(number.start, number.end)) ||
		isShareOfWhole(number, before, after) ||
		(number.measurement === undefined && opensParentheses(before) && closesAlone.test(after))
	);
}

// A word right before a number that joins a second amount to the first: "1 egg plus 1 yolk", "2
// tomatoes or 1 can", "(or 1 tsp dried)".
const joinedAfter = /(?:(?<!\p{L})(?:plus|or|and)\s+|\+\s*)$/iu;
const joiningWord = /(?<!\p{L})(?:plus|or|and)(?!\p{L})|\+/iu;

// A size that says it is each item's, before a comma or parenthesis ends it: "(6 ounces each)".
const sizeOfEach = /^[^(),;]*(?<!\p{L})each(?!\p{L})/iu;

// A count "for" or "of" follows names nothing it counts, so it is a share of what the line counts:
// "(1 for the dough and 1 for the wash)", "(2 of them separated)".
const share = /^\s+(?:for|of)(?!\p{L})/iu;

// A count of one right before a size, with any container it counts and the parenthesis that opens the
// size: "or 1 (14-ounce can)", "or 1 can (14 ounces)".
const oneBefore = /(?:^|[\s(])(?:1|one|an?)(?:\s+(\p{L}+))?\s*\(?\s*$/iu;

// A container after a size in parentheses, or in them after it: "(8 ounce) package", "(14-ounce can)".
const containerAfterSize = [/^\)\s*(\p{L}+)/u, /^\s+(\p{L}+)\)/u];

// The count unit a word names, as a container does: "package", "cans".
function containerUnit(word: string): string | undefined {
	const unit = readUnit(word);
	return unit !== undefined && unitDefinitions[unit]?.type === 'count' ? unit : undefined;
}

// A size joined to its unit by a hyphen, as in "14-ounce can", names a size rather than an amount.
function isHyphenated(measurement: Measurement): boolean {
	const { text, unitOfMeasure } = measurement;
	const quantityEnd = quantityText(measurement).length;
	return /[-\u2010-\u2015]/u.test(text.slice(quantityEnd, text.length - unitOfMeasure.length));
}

function isOne(amount: Amount | undefined): boolean {
	return amount?.min === 1 && amount.max === undefined;
}

// Whether a number is the size of each item, which is right at any scale: a size that says so ("4
// chicken breasts (6 ounces each)"), a hyphenated one ("14-ounce"), one in a container's parentheses
// ("1 (8 ounce) package"), or one after a count of one, either a "1" right before it or, before any word
// joins another amount, the line's own ("1 whole chicken, about 4 pounds").
function isSizeOfEach(
	{ measurement }: WrittenNumber,
	before: string,
	after: string,
	context: LineContext
): boolean {
	if (sizeOfEach.test(after)) {
		return true;
	}

	if (measurement === undefined) {
		return false;
	}

	const container = containerAfterSize
		.map((pattern) => pattern.exec(after)?.[1])
		.find((word) => word !== undefined);
	const one = oneBefore.exec(before);
	const counted = one?.[1];
	return (
		isHyphenated(measurement) ||
		(container !== undefined && containerUnit(container) !== undefined) ||
		(one !== null && (counted === undefined || containerUnit(counted) !== undefined)) ||
		(isOne(context.count) && !joiningWord.test(before))
	);
}

// Whether a number opens what parentheses hold, after a word such as "about": "(1 medium)", "(about 6
// medium)".
function opensParentheses(before: string): boolean {
	const open = before.lastIndexOf('(');
	const inside = before.slice(open + 1);
	return open !== -1 && (inside.trim() === '' || approximationWord.exec(inside)?.[0] === inside);
}

// What the scale does with a number its text leaves as written. It keeps what is no amount and the
// size of each item; it scales an amount a word joins to the line's ("1 egg plus 1 yolk"), a share of
// the line's count ("1 for the dough"), and, in a line measured by volume or weight, a second amount
// or an equivalent of the line's ("(about 1 ¾ cups)", "(1 medium)"); and it marks the rest unscaled,
// such as a size after a count above one ("2 sweet potatoes (about 1 pound)"), a total on a count's
// unit ("2 envelopes (4½ teaspoons)"), or a "C." that may be Celsius ("(12 C.)").
function treatmentOf(number: WrittenNumber, text: string, context: LineContext): Treatment {
	const before = text.slice(0, number.start);
	const after = text.slice(number.end);
	if (isNoAmount(number, text) || isSizeOfEach(number, before, after, context)) {
		return 'keep';
	}

	if (celsiusOrCup(number, text) === 'either') {
		return 'unscaled';
	}

	const isShare = number.measurement === undefined && share.test(after);
	const isSecondAmount =
		context.isMeasure && (number.measurement !== undefined || opensParentheses(before));
	return joinedAfter.test(before) || isShare || isSecondAmount ? 'scale' : 'unscaled';
}

// A number at the scale, written as the scaler writes amounts, with the amounts the words it counts
// agree with; nothing where it reads as no amount.
function scaledNumber(
	{ amount, measurement }: WrittenNumber,
	factor: number
): { text: string; agreement: Agreement } | undefined {
	if (amount === undefined) {
		return undefined;
	}

	if (measurement !== undefined) {
		const measure = measureAt(times(amount, factor), measurement.unitOfMeasureID);
		return {
			text: writeMeasurement(measurement, measure),
			agreement: { written: amount, scaled: measure.amount },
		};
	}

	const count = scaleCount(amount, factor);
	return { text: formatAmount(count), agreement: { written: amount, scaled: count } };
}

// The words a count counts, after it, up to a comma, a closing parenthesis, or a word that joins
// another amount: "yolk" in "plus 1 yolk, beaten", "(14-ounce can) chopped tomatoes" after "or 1".
const countedWords =
	/^(\s*)((?:\([^()]*\)|[^(),;])*?)(?=\s*(?:[),;]|(?<!\p{L})(?:plus|or|and|with)(?!\p{L})|\+|$))/iu;

function countedWordsAfter(text: string, end: number): TextSpan {
	const [, space = '', words = ''] = countedWords.exec(text.slice(end)) ?? [];
	const start = end + space.length;
	return { start, end: start + words.length };
}

// The text with the edits made, leaving out any that overlaps a span or an earlier edit, and the spans
// moved to where their text lands.
function withEdits(text: string, edits: readonly Edit[], spans: readonly TextSpan[]): ScaledText {
	const made: Edit[] = [];
	for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
		if (![...made, ...spans].some((taken) => overlaps(edit, taken))) {
			made.push(edit);
		}
	}

	let edited = '';
	let last = 0;
	for (const { start, end, replacement } of made) {
		edited += `${text.slice(last, start)}${replacement}`;
		last = end;
	}

	const moved = (offset: number) =>
		made.reduce(
			(at, { start, end, replacement }) =>
				end <= offset ? at + replacement.length - (end - start) : at,
			offset
		);
	return {
		text: `${edited}${text.slice(last)}`,
		unscaled: spans.map(({ start, end }) => ({ start: moved(start), end: moved(end) })),
	};
}

function shifted(edit: Edit, by: number): Edit {
	return { ...edit, start: edit.start + by, end: edit.end + by };
}

// Text the scale left as written, at the scale: each number it can vouch for scaled, with the words a
// count counts agreeing, and each it cannot marked unscaled. Given the line's own amounts, the words
// before the first amount another word joins agree with them: "egg" in "egg plus 1 yolk".
function scaleWrittenText(text: string, context: LineContext, agreement?: Agreement): ScaledText {
	const edits: Edit[] = [];
	const unscaled: TextSpan[] = [];
	let headEnd = text.length;
	for (const number of writtenNumbers(text)) {
		const joined = joinedAfter.exec(text.slice(0, number.start));
		if (joined !== null) {
			headEnd = Math.min(headEnd, joined.index);
		}

		const treatment = treatmentOf(number, text, context);
		const scaled = treatment === 'scale' ? scaledNumber(number, context.factor) : undefined;
		const span = { start: number.start, end: number.end };
		if (scaled === undefined) {
			if (treatment !== 'keep') {
				unscaled.push(span);
			}
			continue;
		}

		edits.push({ ...span, replacement: scaled.text });
		if (number.measurement === undefined) {
			const counted = countedWordsAfter(text, number.end);
			const inflected = inflection(text.slice(counted.start, counted.end), scaled.agreement);
			if (inflected !== undefined) {
				edits.push(shifted(inflected, counted.start));
			}
		}
	}

	const head =
		agreement === undefined
			? undefined
			: inflection(text.slice(0, headEnd).replace(/[\s,]+$/u, ''), agreement);
	return withEdits(text, head === undefined ? edits : [head, ...edits], unscaled);
}

// pluralize alone pluralizes mass nouns and whole phrases ("flours", "clove garlics"), so an item
// changes number only when it is one to three words of letters joining nothing.
const pluralizableItem = /^\p{L}+(?: \p{L}+){0,2}$/u;
const joiningWords = new Set(['and', 'or', 'plus', 'with']);

// A word that opens what follows the noun a count counts, which the noun comes before: "bars" in
// "bars of chocolate", "chipotles" in "chipotles in adobo", and none in "for the wash".
const followingWords = ['for', 'of', 'to', 'at', 'in', 'into', 'on', 'from'];
const followingWord = new RegExp(String.raw`(?:^|\s)${wordsSource(followingWords)}(?!\p{L})`, 'iu');

// A word that reads only as a plural, as "bars" does, and "chocolate" and "rice" do not.
function isPluralOnly(word: string): boolean {
	return pluralize.isPlural(word) && !pluralize.isSingular(word);
}

// A container after its size, which takes the count's number in place of the item: "(8 ounce)
// package", "half-pint jar", and within the parentheses, "(14-ounce can)".
const sizedContainers = [
	/^(?:\([^()]*\)|\S+-\S+)\s+(\p{L}+)(?![\p{L}-])/u,
	/^\([^()]*\s(\p{L}+)\)/u,
];

function containerInflection(words: string, scaled: Amount): Edit | undefined {
	for (const pattern of sizedContainers) {
		const match = pattern.exec(words);
		const container = match?.[1];
		const unit = container === undefined ? undefined : containerUnit(container);
		if (match !== null && container !== undefined && unit !== undefined) {
			const start = match[0].lastIndexOf(container);
			return {
				start,
				end: start + container.length,
				replacement: unitInNumber(container, unit, scaled),
			};
		}
	}

	return undefined;
}

// The noun the words a count counts name, before any parenthetical and any word that follows the
// noun: the last word, or, after a count above one, the last only in the plural, as "bars" in "bars
// chocolate (70% dark)" is. "star anise" names none to change, and a size none at all: "(1 medium)".
function nounInflection(words: string, { written, scaled }: Agreement): Edit | undefined {
	const parenthetical = words.search(/\s+\(/u);
	const item = parenthetical === -1 ? words : words.slice(0, parenthetical);
	if (
		!pluralizableItem.test(item) ||
		item.split(' ').some((word) => joiningWords.has(word.toLowerCase()))
	) {
		return undefined;
	}

	const following = item.search(followingWord);
	const nouns = [...(following === -1 ? item : item.slice(0, following)).matchAll(/\p{L}+/gu)];
	const noun = isPlural(written) ? nouns.findLast(([word]) => isPluralOnly(word)) : nouns.at(-1);
	if (noun === undefined || sizes.includes(noun[0].toLowerCase())) {
		return undefined;
	}

	return {
		start: noun.index,
		end: noun.index + noun[0].length,
		replacement: isPlural(scaled) ? pluralize.plural(noun[0]) : pluralize.singular(noun[0]),
	};
}

// The word that takes the number a count takes, in the words it counts, when the scale crosses 1: a
// container after its size, or else the noun. Anything the guards cannot vouch for stays as written.
function inflection(words: string, { written, scaled }: Agreement): Edit | undefined {
	if (isPlural(written) === isPlural(scaled)) {
		return undefined;
	}

	return containerInflection(words, scaled) ?? nounInflection(words, { written, scaled });
}

// A measure's unit holds an equivalent of the whole amount in parentheses, which scales with it: "24
// oz (680 g)". A count's holds the size of each, or a total the scale cannot tell from one above a
// count of one: "1 can (14 ounces)", "2 envelopes (4½ teaspoons)".
const measureTypes: ReadonlySet<UnitType> = new Set(['volume', 'mass']);

const unitWithNote = /^(.*?)(\s*)(\([^()]*\))$/u;

function splitUnit(written: string): WrittenUnit {
	const { marker, unit } = splitUnitMarker(written);
	const [, name, gap, note] = unitWithNote.exec(unit) ?? [];
	return name === undefined || gap === undefined || note === undefined
		? { marker, name: unit, gap: '' }
		: { marker, name, gap, note };
}

// The item in the number the scaled amount takes, when the scale crosses 1: "1 onion" doubles to "2
// onions", and "1 (8 ounce) package cream cheese" to "2 (8 ounce) packages cream cheese".
export function itemForAmount(item: string, written: Amount, scaled: Amount): string {
	const edit = inflection(item, { written, scaled });
	return edit === undefined ? item : withEdits(item, [edit], []).text;
}

// A count at the scale, rounded as ingredients without a unit are.
export function scaleCount(amount: Amount, factor: number): Amount {
	return readingIn(undefined, times(amount, factor)).amount;
}

// The unscaled amounts in text the scale went through, placed in their field after what comes first.
function spansIn(
	field: IngredientLineSpan['field'],
	lead: string,
	{ unscaled }: ScaledText
): IngredientLineSpan[] {
	return unscaled.map(({ start, end }) => ({
		field,
		start: lead.length + start,
		end: lead.length + end,
	}));
}

export function scaleIngredientLine(line: IngredientLine, factor: number): ScaledIngredientLine {
	if (factor === 1) {
		return { line };
	}

	if (line.amount === undefined) {
		return givesAmount(line.text) ? { line, unscaled: 'whole' } : { line };
	}

	const written = line.unit === undefined ? undefined : splitUnit(line.unit);
	const unit = written === undefined ? undefined : readUnit(written.name);
	const type = unit === undefined ? undefined : unitDefinitions[unit]?.type;
	const isMeasure = type !== undefined && measureTypes.has(type);
	const context: LineContext = isMeasure
		? { factor, isMeasure }
		: { factor, isMeasure, count: line.amount };
	const exact = times(line.amount, factor);
	const opening = openingMeasurement(line.item, isMeasure);

	let measure = measureAt(exact, unit);
	// What the scale wrote at the item's start, before the text it went through.
	let itemLead = '';
	let item: ScaledText;
	if (opening === undefined) {
		// A count without a unit counts the item, which agrees with it: "1 onion" doubles to "2 onions".
		const agreement =
			line.unit === undefined ? { written: line.amount, scaled: measure.amount } : undefined;
		item = scaleWrittenText(line.item, context, agreement);
	} else {
		const { prefix, measurement, amount, rest } = opening;
		const second = times(amount, factor);
		const secondInUnit =
			unit === undefined ? undefined : convert(second, measurement.unitOfMeasureID, unit);
		const together =
			secondInUnit === undefined ? undefined : measureAt(add(exact, secondInUnit), unit);
		if (together !== undefined && together.unit !== unit) {
			// Parts that move to another unit read as one amount: "1 lb 2 oz" at a third is "6 ounces".
			measure = together;
			item = scaleWrittenText(rest.trimStart(), context);
		} else {
			// Each part keeps its unit: "2 cups plus 2 tablespoons" doubles to "4 cups plus 4 tablespoons".
			if (together !== undefined) {
				measure = readingIn(unit, exact);
			}
			const secondMeasure = readingIn(measurement.unitOfMeasureID, second);
			itemLead = `${prefix}${writeMeasurement(measurement, secondMeasure)}`;
			item = scaleWrittenText(rest, context);
		}
	}

	const preparation =
		line.preparation === undefined ? undefined : scaleWrittenText(line.preparation, context);
	// The unit's name at the scale, before the note in parentheses the scale goes through.
	let unitLead = '';
	let note: ScaledText | undefined;
	if (written !== undefined) {
		unitLead = `${written.marker}${unitText(written.name, unit, measure)}`;
		if (written.note !== undefined) {
			unitLead = `${unitLead}${written.gap}`;
			note = scaleWrittenText(written.note, context);
		}
	}

	const amounts = [
		...(note === undefined ? [] : spansIn('unit', unitLead, note)),
		...spansIn('item', itemLead, item),
		...(preparation === undefined ? [] : spansIn('preparation', '', preparation)),
	];
	const scaled: IngredientLine = {
		...line,
		amount: measure.amount,
		...(written === undefined ? {} : { unit: `${unitLead}${note?.text ?? ''}` }),
		item: `${itemLead}${item.text}`,
		...(preparation === undefined ? {} : { preparation: preparation.text }),
	};
	return amounts.length === 0 ? { line: scaled } : { line: scaled, unscaled: { amounts } };
}
