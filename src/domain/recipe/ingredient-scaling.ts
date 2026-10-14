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
import type { IngredientLine } from '@/domain/recipe/ingredient';
import { amountOfQuantities } from '@/domain/recipe/ingredient-parser';
import {
	isMetricUnit,
	readingOptions,
	readUnit,
	unitDefinitions,
	type MetricUnit,
} from '@/domain/recipe/ingredient-units';

export type ScaledIngredientLine = {
	// The line at the scale, in the shape the recipe page renders; its text stays the original.
	line: IngredientLine;
	// The original, shown beneath the line when text the scale could not read still holds a number.
	asWritten?: string;
};

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

// A unit as stored, with any note in parentheses after it: "can (14 ounces)".
type WrittenUnit = {
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

	// The sort is stable, so the larger unit wins a tie.
	const closest = readings.filter(isReadable).sort((a, b) => a.error - b.error)[0];
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

// A unit written out in full takes the number its amount takes, keeping its capital; an
// abbreviation stays as written.
function unitInNumber(written: string, unit: string, amount: Amount): string {
	const lower = written.toLowerCase();
	const name = [unit, unitDefinitions[unit]?.plural].find(
		(candidate) =>
			candidate !== undefined && (lower === candidate || lower.endsWith(` ${candidate}`))
	);
	if (name === undefined) {
		return written;
	}

	const start = written.length - name.length;
	const replacement = unitNamed(unit, amount);
	const initial =
		written.charAt(start) === written.charAt(start).toLowerCase()
			? replacement.charAt(0)
			: replacement.charAt(0).toUpperCase();
	return `${written.slice(0, start)}${initial}${replacement.slice(1)}`;
}

// The unit a measure is written in: as before when it stayed, spelled out when it changed.
function unitText(written: string, unit: string | undefined, measure: Measure): string {
	if (measure.unit === undefined || unit === undefined) {
		return written;
	}

	return measure.unit === unit
		? unitInNumber(written, unit, measure.amount)
		: unitNamed(measure.unit, measure.amount);
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

// The text with each measurement that scales at the scale, and the text the scale left as written:
// "(340 g)" doubles to "(680 g)".
function scaleMeasurements(text: string, factor: number): { scaled: string; unread: string } {
	let scaled = '';
	let unread = '';
	let last = 0;
	for (const { measurement, amount } of scalableMeasurements(text)) {
		const before = text.slice(last, measurement.startIndex);
		const measure = measureAt(times(amount, factor), measurement.unitOfMeasureID);
		scaled += `${before}${writeMeasurement(measurement, measure)}`;
		unread += `${before} `;
		last = measurement.endIndex;
	}

	return { scaled: `${scaled}${text.slice(last)}`, unread: `${unread}${text.slice(last)}` };
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

// Number words a line may spell out, as in "7 eggs plus one egg yolk".
const numberWord =
	/(?<![\p{L}-])(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|dozen)(?![\p{L}-])/iu;

// Whether text the scale left as written still holds a number other than a length: the "2" in
// "cut into 2-inch pieces" stays true at any scale.
function holdsNumber(text: string): boolean {
	let rest = text;
	for (const measurement of extractMeasurements(text, readingOptions).reverse()) {
		if (measurement.unitType === 'length') {
			rest = `${rest.slice(0, measurement.startIndex)} ${rest.slice(measurement.endIndex)}`;
		}
	}

	return /\p{N}/u.test(rest) || numberWord.test(rest);
}

// pluralize alone pluralizes mass nouns and whole phrases ("flours", "clove garlics"), so an item
// changes number only when it is one to three words of letters joining nothing.
const pluralizableItem = /^\p{L}+(?: \p{L}+){0,2}$/u;
const joiningWords = new Set(['and', 'or', 'plus', 'with']);

// A measure's unit holds an equivalent of the whole amount in parentheses, which scales with it; a
// count's holds the size of each, which does not: "24 oz (680 g)", "2 cans (14 ounces)".
const measureTypes: ReadonlySet<UnitType> = new Set(['volume', 'mass']);

const unitWithNote = /^(.*?)(\s*)(\([^()]*\))$/u;

function splitUnit(unit: string): WrittenUnit {
	const [, name, gap, note] = unitWithNote.exec(unit) ?? [];
	return name === undefined || gap === undefined || note === undefined
		? { name: unit, gap: '' }
		: { name, gap, note };
}

// The item in the number the scaled amount takes, when the scale crosses 1: "1 onion" doubles to
// "2 onions". Anything the guards cannot vouch for stays as written.
export function itemForAmount(item: string, written: Amount, scaled: Amount): string {
	const words = item.split(' ');
	if (
		isPlural(written) === isPlural(scaled) ||
		!pluralizableItem.test(item) ||
		words.some((word) => joiningWords.has(word.toLowerCase()))
	) {
		return item;
	}

	const nounStart = item.lastIndexOf(' ') + 1;
	const noun = item.slice(nounStart);
	const inflected = isPlural(scaled) ? pluralize.plural(noun) : pluralize.singular(noun);
	return `${item.slice(0, nounStart)}${inflected}`;
}

// A count at the scale, rounded as ingredients without a unit are.
export function scaleCount(amount: Amount, factor: number): Amount {
	return readingIn(undefined, times(amount, factor)).amount;
}

export function scaleIngredientLine(line: IngredientLine, factor: number): ScaledIngredientLine {
	if (factor === 1) {
		return { line };
	}

	if (line.amount === undefined) {
		return holdsNumber(line.text) ? { line, asWritten: line.text } : { line };
	}

	const written = line.unit === undefined ? undefined : splitUnit(line.unit);
	const unit = written === undefined ? undefined : readUnit(written.name);
	const type = unit === undefined ? undefined : unitDefinitions[unit]?.type;
	const isMeasure = type !== undefined && measureTypes.has(type);
	const exact = times(line.amount, factor);
	const opening = openingMeasurement(line.item, isMeasure);
	const unread = [line.preparation ?? ''];

	let measure = measureAt(exact, unit);
	let item = line.item;
	if (opening === undefined) {
		if (line.unit === undefined) {
			item = itemForAmount(line.item, line.amount, measure.amount);
		}
		unread.push(line.item);
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
			item = rest.trimStart();
		} else {
			// Each part keeps its unit: "2 cups plus 2 tablespoons" doubles to "4 cups plus 4 tablespoons".
			if (together !== undefined) {
				measure = readingIn(unit, exact);
			}
			const secondMeasure = readingIn(measurement.unitOfMeasureID, second);
			item = `${prefix}${writeMeasurement(measurement, secondMeasure)}${rest}`;
		}
		unread.push(`${prefix} ${rest}`);
	}

	let scaledUnit: string | undefined;
	if (written !== undefined) {
		const name = unitText(written.name, unit, measure);
		if (written.note === undefined) {
			scaledUnit = name;
		} else if (isMeasure) {
			const equivalent = scaleMeasurements(written.note, factor);
			scaledUnit = `${name}${written.gap}${equivalent.scaled}`;
			unread.push(equivalent.unread);
		} else {
			scaledUnit = `${name}${written.gap}${written.note}`;
		}
	}

	const scaled: IngredientLine = {
		...line,
		amount: measure.amount,
		...(scaledUnit === undefined ? {} : { unit: scaledUnit }),
		item,
	};
	return unread.some(holdsNumber) ? { line: scaled, asWritten: line.text } : { line: scaled };
}
