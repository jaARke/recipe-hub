import { describe, expect, it } from 'vitest';
import { problemsFromZodError } from '@/domain/problem';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import {
	parseRecipeContent,
	recipeContentSchema,
	recipeSchema,
	storedRecipeContentSchema,
} from '@/domain/recipe/recipe';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleRecipeContents,
} from '@/domain/recipe/samples/sample-recipes';
import { settings } from '@/lib/settings';

function problemPaths(input: unknown): string[] {
	const result = recipeContentSchema.safeParse(input);
	return result.success ? [] : problemsFromZodError(result.error).map(({ path }) => path);
}

function withLines(lines: unknown[]): unknown {
	return { ...sampleButtermilkBiscuits, ingredientSections: [{ lines }] };
}

function pastLimit(max: number): string {
	return 'a'.repeat(max + 1);
}

function characterLimit(path: string, max: number) {
	return { path, message: `Use ${max} characters or fewer.` };
}

// One past every text limit, as a recipe saved before the limits were lowered could be.
const pastEveryTextLimit = {
	...sampleChickenSoup,
	title: pastLimit(settings.recipeLimits.maxTitleLength),
	description: pastLimit(settings.recipeLimits.maxDescriptionLength),
	notes: pastLimit(settings.recipeLimits.maxNotesLength),
	source: pastLimit(settings.recipeLimits.maxSourceLength),
	yield: {
		kind: 'makes',
		amount: { min: 12 },
		unit: pastLimit(settings.recipeLimits.maxYieldUnitLength),
	},
	ingredientSections: [
		{
			heading: pastLimit(settings.recipeLimits.maxSectionHeadingLength),
			lines: [{ text: pastLimit(settings.recipeLimits.maxIngredientLineLength), item: 'flour' }],
		},
	],
	instructionSections: [
		{
			heading: pastLimit(settings.recipeLimits.maxSectionHeadingLength),
			steps: [{ text: pastLimit(settings.recipeLimits.maxStepLength) }],
		},
	],
	tags: [pastLimit(settings.recipeLimits.maxTagLength)],
	images: [
		{
			role: 'dish',
			pathname: 'dish/soup.jpg',
			alt: pastLimit(settings.recipeLimits.maxImageAltLength),
			size: { width: 2400, height: 1800 },
		},
	],
};

const egg = { text: '1 egg', amount: { min: 1 }, item: 'egg' };
const step = { text: 'Stir.' };

function copies<Item>(item: Item, count: number): Item[] {
	return Array.from({ length: count }, () => item);
}

describe('recipeContentSchema', () => {
	it.each(sampleRecipeContents.map((content) => [content.title, content]))(
		'accepts the sample "%s" unchanged',
		(_title, content) => {
			expect(recipeContentSchema.parse(content)).toEqual(content);
		}
	);

	it('trims text fields', () => {
		const content = recipeContentSchema.parse({
			...sampleChickenSoup,
			title: '  Weeknight chicken soup ',
		});
		expect(content.title).toBe('Weeknight chicken soup');
	});

	it('rejects a blank title', () => {
		expect(problemPaths({ ...sampleChickenSoup, title: '   ' })).toEqual(['title']);
	});

	it('rejects a blank optional text field instead of storing an empty string', () => {
		expect(problemPaths({ ...sampleChickenSoup, description: '' })).toEqual(['description']);
	});

	it('requires at least one ingredient and one step', () => {
		expect(
			problemPaths({ ...sampleChickenSoup, ingredientSections: [], instructionSections: [] })
		).toEqual(['ingredientSections', 'instructionSections']);
		expect(problemPaths(withLines([]))).toEqual(['ingredientSections.0.lines']);
		expect(problemPaths({ ...sampleChickenSoup, instructionSections: [{ steps: [] }] })).toEqual([
			'instructionSections.0.steps',
		]);
	});

	it('accepts an ingredient line up to the length limit and rejects a longer one', () => {
		const line = (text: string) => ({ text, item: text });
		const longest = 'a'.repeat(settings.recipeLimits.maxIngredientLineLength);

		expect(problemPaths(withLines([line(longest)]))).toEqual([]);
		expect(problemPaths(withLines([line(`${longest}a`)]))).toEqual([
			'ingredientSections.0.lines.0.text',
		]);
	});

	it('rejects a range whose end is not above its start', () => {
		const line = { text: '3 to 2 carrots', amount: { min: 3, max: 2 }, item: 'carrots' };
		expect(problemPaths(withLines([line]))).toEqual(['ingredientSections.0.lines.0.amount.max']);
	});

	it('collapses repeated tags to the first spelling', () => {
		const content = recipeContentSchema.parse({
			...sampleChickenSoup,
			tags: ['Soup', ' weeknight', 'SOUP', 'Weeknight '],
		});
		expect(content.tags).toEqual(['Soup', 'weeknight']);
	});

	it('rejects an image attached twice', () => {
		const size = { width: 2400, height: 1800 };
		const images = [
			{ role: 'dish', pathname: 'dish/soup.jpg', size },
			{ role: 'scan', pathname: 'scan/card.jpg', size },
			{ role: 'dish', pathname: 'dish/soup.jpg', alt: 'A bowl of soup', size },
		];
		expect(problemPaths({ ...sampleChickenSoup, images })).toEqual(['images.2.pathname']);
	});

	it('refuses text past each limit, naming its field', () => {
		const result = recipeContentSchema.safeParse(pastEveryTextLimit);

		expect(result.success ? [] : problemsFromZodError(result.error)).toEqual([
			characterLimit('title', settings.recipeLimits.maxTitleLength),
			characterLimit('description', settings.recipeLimits.maxDescriptionLength),
			characterLimit('notes', settings.recipeLimits.maxNotesLength),
			characterLimit('source', settings.recipeLimits.maxSourceLength),
			characterLimit('yield.unit', settings.recipeLimits.maxYieldUnitLength),
			characterLimit('ingredientSections.0.heading', settings.recipeLimits.maxSectionHeadingLength),
			characterLimit(
				'ingredientSections.0.lines.0.text',
				settings.recipeLimits.maxIngredientLineLength
			),
			characterLimit(
				'instructionSections.0.heading',
				settings.recipeLimits.maxSectionHeadingLength
			),
			characterLimit('instructionSections.0.steps.0.text', settings.recipeLimits.maxStepLength),
			characterLimit('tags.0', settings.recipeLimits.maxTagLength),
			characterLimit('images.0.alt', settings.recipeLimits.maxImageAltLength),
		]);
	});

	it.each([
		{
			what: 'sections',
			change: {
				ingredientSections: copies({ lines: [egg] }, settings.recipeLimits.maxSectionsPerList + 1),
			},
			problem: {
				path: 'ingredientSections',
				message: `Use ${settings.recipeLimits.maxSectionsPerList} sections or fewer.`,
			},
		},
		{
			what: 'ingredients',
			change: {
				ingredientSections: copies(
					{
						lines: copies(
							egg,
							Math.ceil((settings.recipeLimits.maxIngredientLinesPerRecipe + 1) / 2)
						),
					},
					2
				),
			},
			problem: {
				path: 'ingredientSections',
				message: `Use ${settings.recipeLimits.maxIngredientLinesPerRecipe} ingredients or fewer.`,
			},
		},
		{
			what: 'steps',
			change: {
				instructionSections: [{ steps: copies(step, settings.recipeLimits.maxStepsPerRecipe + 1) }],
			},
			problem: {
				path: 'instructionSections',
				message: `Use ${settings.recipeLimits.maxStepsPerRecipe} steps or fewer.`,
			},
		},
	])('refuses more $what than a recipe keeps, counting across sections', ({ change, problem }) => {
		const result = recipeContentSchema.safeParse({ ...sampleChickenSoup, ...change });

		expect(result.success ? [] : problemsFromZodError(result.error)).toEqual([problem]);
	});
});

describe('storedRecipeContentSchema', () => {
	it('reads stored content that carries fields it does not know', () => {
		const [section] = sampleChickenSoup.ingredientSections;
		const stored = {
			...sampleChickenSoup,
			retiredField: 'kept by an older version',
			ingredientSections: [{ ...section, collapsed: true }],
		};

		expect(storedRecipeContentSchema.parse(stored)).toEqual(sampleChickenSoup);
	});

	it('reads stored content past every limit unchanged', () => {
		const stored = {
			...pastEveryTextLimit,
			ingredientSections: copies(
				{ lines: copies(egg, 11) },
				settings.recipeLimits.maxSectionsPerList + 1
			),
			instructionSections: [{ steps: copies(step, settings.recipeLimits.maxStepsPerRecipe + 1) }],
			tags: Array.from(
				{ length: settings.recipeLimits.maxTagsPerRecipe + 1 },
				(_, index) => `Tag ${index}`
			),
		};

		expect(storedRecipeContentSchema.parse(stored)).toEqual(stored);
	});

	it('reads content stored before images had sizes, which a save then needs', () => {
		const stored = {
			...sampleChickenSoup,
			images: [{ role: 'dish', pathname: 'dish/seed/weeknight-chicken-soup.jpg' }],
		};

		expect(storedRecipeContentSchema.parse(stored)).toEqual(stored);
		expect(problemPaths(stored)).toEqual(['images.0.size']);
	});
});

describe('parseRecipeContent', () => {
	it('returns valid content', () => {
		expect(parseRecipeContent(sampleButtermilkBiscuits).title).toBe('Buttermilk biscuits');
	});

	it('throws InvalidRecipeError with dotted problem paths', () => {
		const lines = [
			{ text: '1 cup flour', amount: { min: 1 }, unit: 'cup', item: 'flour' },
			{ text: 'Salt to taste', item: 'salt' },
			{ text: '2 eggs', amount: { min: 2 } },
		];

		expect(() => parseRecipeContent(withLines(lines))).toThrow(
			expect.objectContaining({
				code: 'recipe.invalid',
				problems: [{ path: 'ingredientSections.0.lines.2.item', message: expect.any(String) }],
			})
		);
		expect(() => parseRecipeContent({})).toThrow(InvalidRecipeError);
	});
});

describe('recipeSchema', () => {
	it('accepts content with its identity, contributor, provenance, and timestamps', () => {
		const recipe = recipeSchema.parse({
			...sampleButtermilkBiscuits,
			id: '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e',
			slug: 'buttermilk-biscuits',
			contributorId: '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
			provenance: { entryMode: 'manual' },
			createdAt: new Date('2026-10-10T12:00:00Z'),
			updatedAt: new Date('2026-10-10T12:00:00Z'),
		});

		expect(recipe.slug).toBe('buttermilk-biscuits');
	});
});
