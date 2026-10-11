import { z } from 'zod';

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

function formatQuantity(value: number): string {
	const nearestWhole = Math.round(value);
	// A positive amount never reads as zero, so only whole numbers from 1 absorb small differences.
	if (nearestWhole > 0 && Math.abs(value - nearestWhole) < fractionTolerance) {
		return String(nearestWhole);
	}

	const whole = Math.floor(value);
	const fraction = vulgarFractions.find(
		(candidate) => Math.abs(value - whole - candidate.value) < fractionTolerance
	);
	if (fraction !== undefined) {
		return whole === 0 ? fraction.glyph : `${whole}${fraction.glyph}`;
	}

	// Two significant digits below 1, so a small amount such as 0.005 keeps its precision.
	return String(value < 1 ? Number(value.toPrecision(2)) : Math.round(value * 100) / 100);
}

// A single quantity, or a range when max is present.
export const amountSchema = z
	.object({
		min: z.number().positive('Enter an amount greater than zero.'),
		max: z.number().optional(),
	})
	.refine((amount) => amount.max === undefined || amount.max > amount.min, {
		message: 'Make the end of the range larger than the start.',
		path: ['max'],
	});
export type Amount = z.infer<typeof amountSchema>;

export function formatAmount(amount: Amount): string {
	const min = formatQuantity(amount.min);
	return amount.max === undefined ? min : `${min} to ${formatQuantity(amount.max)}`;
}
