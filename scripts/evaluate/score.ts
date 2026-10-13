import leven from 'leven';
import type {
	ExtractedIngredientSection,
	ExtractedInstructionSection,
	ExtractedRecipe,
	ExtractedTimes,
	ExtractedYield,
} from '@/domain/recipe/extracted-recipe';
import { parseAmountText } from '@/domain/recipe/ingredient-parser';

export const scoredFields = [
	'title',
	'description',
	'notes',
	'source',
	'yield',
	'times',
	'ingredients',
	'steps',
	'headings',
] as const;
export type ScoredField = (typeof scoredFields)[number];

// Each from 0 to 1.
export type FieldScores = Record<ScoredField, number>;

export type LinePair = {
	expected: string;
	produced: string;
};

const textFields = ['title', 'description', 'notes', 'source'] as const;

const timeFields = [
	'prepMinutes',
	'cookMinutes',
	'totalMinutes',
] as const satisfies readonly (keyof ExtractedTimes)[];

export type InventedField = (typeof textFields)[number] | 'yield' | (typeof timeFields)[number];

export type InventedValue = {
	field: InventedField;
	value: string;
};

// Signs that a reading added to or changed what the original says, reported beside the score.
export type HallucinationSignals = {
	// Ingredient lines that match no expected line.
	unmatchedLines: string[];
	// Fields the expected recipe leaves out.
	inventedFields: InventedValue[];
	// Matched ingredient lines whose numbers differ.
	numberMismatches: LinePair[];
};

export type RecipeScore = {
	// The weighted sum of the field scores, from 0 to 1.
	score: number;
	fields: FieldScores;
	// Expected ingredient lines that match no line read.
	missedLines: string[];
	signals: HallucinationSignals;
};

// Each field's share of a case's score. Ingredients and steps are most of what a member would fix.
export const fieldWeights = {
	title: 0.05,
	description: 0.05,
	notes: 0.05,
	source: 0.05,
	yield: 0.05,
	times: 0.05,
	ingredients: 0.35,
	steps: 0.3,
	headings: 0.05,
} as const satisfies FieldScores;

// Lines at least this alike are one line read with errors; below it they are different lines.
const minimumLineSimilarity = 0.6;

const noRecipeScores: FieldScores = {
	title: 0,
	description: 0,
	notes: 0,
	source: 0,
	yield: 0,
	times: 0,
	ingredients: 0,
	steps: 0,
	headings: 0,
};

// The marker a model puts after a reading it is unsure of, which is not part of the text.
const doubtMarker = /\s*\[\?\]/g;

const singleQuotes = /[\u2018\u2019\u201a\u201b\u2032]/g;

const doubleQuotes = /[\u201c-\u201f\u2033]/g;

// Hyphens, en and em dashes, and the minus sign.
const dashes = /[\u2010-\u2015\u2212]/g;

// A vulgar fraction and the whole number before it: "1½", "1 ½", or "½".
const vulgarFraction = /(?:(\d)\s*)?([\u00bc-\u00be\u2150-\u215e])/g;

const numberToken = /\d+(?:[./]\d+)?/g;

type Line = {
	text: string;
	normalized: string;
};

type LineMatch = {
	expected: Line;
	produced: Line;
	similarity: number;
};

// Text compared as a reader sees it. Case is kept. A handwritten "1½" can be typed as "1 1/2", so
// fractions take the ASCII form.
function normalizedText(text: string): string {
	return text
		.normalize('NFC')
		.replace(doubtMarker, '')
		.replace(singleQuotes, "'")
		.replace(doubleQuotes, '"')
		.replace(dashes, '-')
		.replace(vulgarFraction, (_match, whole: string | undefined, fraction: string) => {
			// Compatibility decomposition spells ½ as 1⁄2, with the fraction slash.
			const ascii = fraction.normalize('NFKD').replace('\u2044', '/');
			return whole === undefined ? ascii : `${whole} ${ascii}`;
		})
		.replace(/\s+/g, ' ')
		.trim();
}

// Normalized text, or undefined when nothing is left of it, as the draft drops blank text.
function presentText(text: string | undefined): string | undefined {
	const normalized = text === undefined ? '' : normalizedText(text);
	return normalized === '' ? undefined : normalized;
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

// Title, source, and unit score all or nothing, so case is folded: a capital alone would cost the
// whole field.
function sameName(expected: string | undefined, produced: string | undefined): boolean {
	return presentText(expected)?.toLowerCase() === presentText(produced)?.toLowerCase();
}

// Amounts the yield field reads alike are alike, so "10-12" matches "10 to 12".
function sameAmount(expected: string, produced: string): boolean {
	const expectedAmount = parseAmountText(normalizedText(expected));
	const producedAmount = parseAmountText(normalizedText(produced));
	if (expectedAmount === undefined || producedAmount === undefined) {
		return sameName(expected, produced);
	}
	return expectedAmount.min === producedAmount.min && expectedAmount.max === producedAmount.max;
}

// A serving yield has no unit, as in the draft.
function yieldScore(
	expected: ExtractedYield | undefined,
	produced: ExtractedYield | undefined
): number {
	if (expected === undefined || produced === undefined) {
		return expected === produced ? 1 : 0;
	}
	const sameUnit = expected.kind === 'servings' || sameName(expected.unit, produced.unit);
	return expected.kind === produced.kind && sameAmount(expected.amount, produced.amount) && sameUnit
		? 1
		: 0;
}

// The share of prep, cook, and total minutes that match, absent ones included.
function timesScore(expected: ExtractedTimes, produced: ExtractedTimes): number {
	return (
		timeFields.filter((field) => expected[field] === produced[field]).length / timeFields.length
	);
}

// One minus the character error rate: the edits from the expected text to the produced one, per
// expected character, at most one.
function textScore(expected: string | undefined, produced: string | undefined): number {
	const expectedText = presentText(expected) ?? '';
	const errorRate =
		leven(expectedText, presentText(produced) ?? '') / Math.max(expectedText.length, 1);
	return 1 - Math.min(errorRate, 1);
}

function similarity(first: string, second: string): number {
	const length = Math.max(first.length, second.length);
	return length === 0 ? 1 : 1 - leven(first, second) / length;
}

// Pairs each expected line with at most one produced line, the most alike pairs first.
function matchLines(expected: readonly Line[], produced: readonly Line[]): LineMatch[] {
	const candidates = expected
		.flatMap((expectedLine) =>
			produced.map((producedLine) => ({
				expected: expectedLine,
				produced: producedLine,
				similarity: similarity(expectedLine.normalized, producedLine.normalized),
			}))
		)
		.filter((candidate) => candidate.similarity >= minimumLineSimilarity)
		.sort((first, second) => second.similarity - first.similarity);

	const matched = new Set<Line>();
	return candidates.filter((candidate) => {
		if (matched.has(candidate.expected) || matched.has(candidate.produced)) {
			return false;
		}
		matched.add(candidate.expected);
		matched.add(candidate.produced);
		return true;
	});
}

// Twice the matched similarity over all lines on both sides, so a missed line and an extra one cost
// the same.
function softF1(
	matches: readonly LineMatch[],
	expectedCount: number,
	producedCount: number
): number {
	const count = expectedCount + producedCount;
	return count === 0 ? 1 : (2 * sum(matches.map((match) => match.similarity))) / count;
}

// Leaves out blank text, as the draft does.
function lines(texts: readonly (string | undefined)[]): Line[] {
	return texts.flatMap((text) => {
		const normalized = presentText(text);
		return text === undefined || normalized === undefined ? [] : [{ text, normalized }];
	});
}

function ingredientLines(recipe: ExtractedRecipe): Line[] {
	return lines(recipe.ingredientSections.flatMap((section) => section.lines));
}

// Steps split or merged differently read the same once joined.
function joinedSteps(recipe: ExtractedRecipe): string {
	return recipe.instructionSections.flatMap((section) => section.steps).join(' ');
}

function headings(
	sections: readonly (ExtractedIngredientSection | ExtractedInstructionSection)[]
): Line[] {
	return lines(sections.map((section) => section.heading));
}

// Ingredient headings match ingredient headings and step headings step headings.
function headingsScore(expected: ExtractedRecipe, produced: ExtractedRecipe): number {
	const ingredients = {
		expected: headings(expected.ingredientSections),
		produced: headings(produced.ingredientSections),
	};
	const steps = {
		expected: headings(expected.instructionSections),
		produced: headings(produced.instructionSections),
	};
	return softF1(
		[
			...matchLines(ingredients.expected, ingredients.produced),
			...matchLines(steps.expected, steps.produced),
		],
		ingredients.expected.length + steps.expected.length,
		ingredients.produced.length + steps.produced.length
	);
}

function yieldText({ kind, amount, unit }: ExtractedYield): string {
	return [kind, amount, unit].filter((part) => part !== undefined).join(' ');
}

function inventedFields(expected: ExtractedRecipe, produced: ExtractedRecipe): InventedValue[] {
	const invented: InventedValue[] = [];
	for (const field of textFields) {
		const value = presentText(produced[field]);
		if (presentText(expected[field]) === undefined && value !== undefined) {
			invented.push({ field, value });
		}
	}
	if (expected.yield === undefined && produced.yield !== undefined) {
		invented.push({ field: 'yield', value: yieldText(produced.yield) });
	}
	for (const field of timeFields) {
		const minutes = produced.times[field];
		if (expected.times[field] === undefined && minutes !== undefined) {
			invented.push({ field, value: `${minutes} minutes` });
		}
	}
	return invented;
}

function numbers(line: Line): string {
	return (line.normalized.match(numberToken) ?? []).join(' ');
}

// Scores a reading against the expected recipe. A reading without a recipe scores zero.
export function scoreRecipe(
	expected: ExtractedRecipe,
	produced: ExtractedRecipe | null
): RecipeScore {
	const expectedLines = ingredientLines(expected);
	if (produced === null) {
		return {
			score: 0,
			fields: noRecipeScores,
			missedLines: expectedLines.map((line) => line.text),
			signals: { unmatchedLines: [], inventedFields: [], numberMismatches: [] },
		};
	}

	const producedLines = ingredientLines(produced);
	const matches = matchLines(expectedLines, producedLines);
	const matched = new Set(matches.flatMap((match) => [match.expected, match.produced]));

	const fields: FieldScores = {
		title: sameName(expected.title, produced.title) ? 1 : 0,
		description: textScore(expected.description, produced.description),
		notes: textScore(expected.notes, produced.notes),
		source: sameName(expected.source, produced.source) ? 1 : 0,
		yield: yieldScore(expected.yield, produced.yield),
		times: timesScore(expected.times, produced.times),
		ingredients: softF1(matches, expectedLines.length, producedLines.length),
		steps: textScore(joinedSteps(expected), joinedSteps(produced)),
		headings: headingsScore(expected, produced),
	};

	return {
		score: sum(scoredFields.map((field) => fields[field] * fieldWeights[field])),
		fields,
		missedLines: expectedLines.filter((line) => !matched.has(line)).map((line) => line.text),
		signals: {
			unmatchedLines: producedLines.filter((line) => !matched.has(line)).map((line) => line.text),
			inventedFields: inventedFields(expected, produced),
			numberMismatches: matches
				.filter((match) => numbers(match.expected) !== numbers(match.produced))
				.map((match) => ({ expected: match.expected.text, produced: match.produced.text })),
		},
	};
}
