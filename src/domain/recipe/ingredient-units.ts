// The units ingredient lines are read in: parse-ingredient's own, with the spellings and units it
// lacks, compiled from Cooklang's bundled units.toml (MIT), the misses in scripts/evaluate, and old
// recipe cards. To add a spelling, append it to its unit's list below; to add a unit, give it a long
// singular id, a short form, a plural, a type, and a conversion factor (to milliliters or grams) if
// it converts. The library tries a spelling's exact case first, so "T" and "t" can differ. A unit or
// spelling any recipe could use goes upstream to parse-ingredient first, and leaves this table once
// a release has it.
import {
	parseIngredient,
	unitsOfMeasure,
	type ExtractMeasurementsOptions,
	type UnitOfMeasure,
	type UnitOfMeasureDefinitions,
} from 'parse-ingredient';
import { transcriptionMarkers } from '@/domain/recipe/transcription-markers';

// Sizes describe the item rather than measure it: "1 large egg".
export const sizes: readonly string[] = [
	'large',
	'lg',
	'lg.',
	'medium',
	'med',
	'med.',
	'md',
	'md.',
	'small',
	'sm',
	'sm.',
];

// Words old cards put before a spoon or cup, read as part of the unit: "2 level tablespoons salt".
const measureModifiers = ['level', 'heaping', 'heaped', 'rounded', 'scant'];

function withModifiers(id: string, plural: string): string[] {
	return measureModifiers.flatMap((modifier) => [`${modifier} ${id}`, `${modifier} ${plural}`]);
}

// The library replaces a unit it is given rather than merging it, so an extension spreads the default.
function withSpellings(id: string, spellings: readonly string[]): UnitOfMeasure {
	const unit = unitsOfMeasure[id];
	if (unit === undefined) {
		throw new Error(`parse-ingredient has no unit "${id}" to extend.`);
	}

	return { ...unit, alternates: [...(unit.alternates ?? []), ...spellings] };
}

const additionalUnits = {
	teaspoon: withSpellings('teaspoon', [
		't.',
		'tsps',
		'tsps.',
		'teas',
		'teas.',
		'tea sp',
		'tea sp.',
		'tea spoon',
		'tea spoons',
		'teaspoonfuls',
		...withModifiers('teaspoon', 'teaspoons'),
	]),
	tablespoon: withSpellings('tablespoon', [
		'T.',
		'tbs',
		'tbs.',
		'tbsps',
		'tbsps.',
		'tbl',
		'tbl.',
		'tbls',
		'tbls.',
		'table spoon',
		'table spoons',
		'tablespoonfuls',
		...withModifiers('tablespoon', 'tablespoons'),
	]),
	cup: withSpellings('cup', ['cupful', 'cupfuls', ...withModifiers('cup', 'cups')]),
	// "fl oz." is read through the parser, since the library stops that spelling before its period.
	'fluid ounce': withSpellings('fluid ounce', ['fl. oz', 'fl. oz.', 'fl.oz', 'fl.oz.']),
	liter: withSpellings('liter', ['litre', 'litres']),
	milliliter: withSpellings('milliliter', ['millilitre', 'millilitres']),
	deciliter: withSpellings('deciliter', ['decilitre', 'decilitres']),
	centiliter: {
		short: 'cl',
		plural: 'centiliters',
		alternates: ['cl.', 'centilitre', 'centilitres'],
		type: 'volume',
		conversionFactor: 10,
	},
	// A dry measure on old cards: "1 pk green tomatoes".
	peck: {
		short: 'pk',
		plural: 'pecks',
		alternates: ['pk.', 'pks', 'pks.'],
		type: 'volume',
		conversionFactor: { us: 8809.7676, imperial: 9092.18 },
	},
	meter: withSpellings('meter', ['metre', 'metres']),
	centimeter: withSpellings('centimeter', ['centimetre', 'centimetres']),
	millimeter: withSpellings('millimeter', ['millimetre', 'millimetres']),
	can: withSpellings('can', ['tin', 'tins']),
	dozen: withSpellings('dozen', ['doz', 'doz.']),
	envelope: {
		short: 'env',
		plural: 'envelopes',
		alternates: ['env.', 'envs', 'envs.'],
		type: 'count',
	},
	packet: { short: 'pkt', plural: 'packets', alternates: ['pkt.', 'pkts', 'pkts.'], type: 'count' },
	jar: { short: 'jar', plural: 'jars', type: 'count' },
	// Of chocolate: "3 sq. bitter chocolate".
	square: { short: 'sq', plural: 'squares', alternates: ['sq.', 'sqs', 'sqs.'], type: 'count' },
	sheet: { short: 'sheet', plural: 'sheets', type: 'count' },
	slice: { short: 'slice', plural: 'slices', type: 'count' },
	strip: { short: 'strip', plural: 'strips', type: 'count' },
	stalk: { short: 'stalk', plural: 'stalks', type: 'count' },
	rib: { short: 'rib', plural: 'ribs', type: 'count' },
	loaf: { short: 'loaf', plural: 'loaves', type: 'count' },
	handful: { short: 'handful', plural: 'handfuls', type: 'count' },
	knob: { short: 'knob', plural: 'knobs', type: 'count' },
} satisfies UnitOfMeasureDefinitions;

// The metric units, whose amounts are written as decimals rather than fractions: "1.5 kg".
const metricUnits = [
	'milligram',
	'gram',
	'kilogram',
	'milliliter',
	'centiliter',
	'deciliter',
	'liter',
] as const;
export type MetricUnit = (typeof metricUnits)[number];

export function isMetricUnit(id: string): id is MetricUnit {
	return (metricUnits as readonly string[]).includes(id);
}

// Every unit a line may be read in, by id.
export const unitDefinitions: Readonly<UnitOfMeasureDefinitions> = {
	...unitsOfMeasure,
	...additionalUnits,
};

// What every reading passes the library. The library caches its lookups by the table's identity,
// so this one object serves every call.
export const readingOptions = {
	additionalUOMs: additionalUnits,
	ignoreUOMs: sizes,
	// Exact values, so a third is not read as 0.333.
	round: false,
} as const satisfies ExtractMeasurementsOptions;

// The marker the parser keeps at the front of a unit after an amount it is unsure of, so the recipe
// page still shows it: "1 1/2 [?] cups flour" reads in "[?] cups".
const unitMarker = `${transcriptionMarkers.unsure} `;

// Gives the library a word to read the unit before, since it reads no unit that ends a line.
const placeholderItem = 'x';

// A unit as written, or text that opens with one, apart from the marker at its front if it has one.
export function splitUnitMarker(unit: string): { marker: string; unit: string } {
	return unit.startsWith(unitMarker)
		? { marker: unitMarker, unit: unit.slice(unitMarker.length) }
		: { marker: '', unit };
}

// The id of a unit as written, such as "tablespoon" for "Tbsp", "can" for "can (14 ounces)", or
// "cup" for "[?] cups", read as the parser reads a line.
export function readUnit(unit: string): string | undefined {
	const [parsed] = parseIngredient(
		[`1 ${splitUnitMarker(unit).unit} ${placeholderItem}`],
		readingOptions
	);
	return parsed?.unitOfMeasureID ?? undefined;
}
