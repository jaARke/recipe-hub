import type { Amount } from '@/domain/recipe/amount';
import { isMetricUnit, readUnit } from '@/domain/recipe/ingredient-units';

// Close enough to read as a common fraction, and under half the smallest gap between two of them.
const fractionTolerance = 0.01;

const vulgarFractions = [
	{ value: 1 / 8, glyph: '⅛' },
	{ value: 1 / 4, glyph: '¼' },
	{ value: 1 / 3, glyph: '⅓' },
	{ value: 3 / 8, glyph: '⅜' },
	{ value: 1 / 2, glyph: '½' },
	{ value: 5 / 8, glyph: '⅝' },
	{ value: 2 / 3, glyph: '⅔' },
	{ value: 3 / 4, glyph: '¾' },
	{ value: 7 / 8, glyph: '⅞' },
] as const;

// Decimal places for a metric amount that would otherwise read as a fraction: ⅛ l is 0.125 l.
const metricPlaces = 3;

function formatQuantity(value: number, metric: boolean): string {
	const nearestWhole = Math.round(value);
	// A positive amount never reads as zero, so only whole numbers from 1 absorb small differences.
	if (nearestWhole > 0 && Math.abs(value - nearestWhole) < fractionTolerance) {
		return String(nearestWhole);
	}

	const whole = Math.floor(value);
	const fraction = vulgarFractions.find(
		(candidate) => Math.abs(value - whole - candidate.value) < fractionTolerance
	);
	if (fraction !== undefined && metric) {
		return String(Number(value.toFixed(metricPlaces)));
	}

	if (fraction !== undefined) {
		return whole === 0 ? fraction.glyph : `${whole}${fraction.glyph}`;
	}

	// Two significant digits below 1, so a small amount such as 0.005 keeps its precision.
	return String(value < 1 ? Number(value.toPrecision(2)) : Math.round(value * 100) / 100);
}

// The amount as a recipe writes it, in the unit as written, if any: decimals for a metric unit.
export function formatAmount(amount: Amount, unit?: string): string {
	const id = unit === undefined ? undefined : readUnit(unit);
	const metric = id !== undefined && isMetricUnit(id);
	const min = formatQuantity(amount.min, metric);
	return amount.max === undefined ? min : `${min} to ${formatQuantity(amount.max, metric)}`;
}
