import { describe, expect, it } from 'vitest';
import { problemsFromZodError } from '@/domain/problem';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { maxIngredientLineLength } from '@/domain/recipe/ingredient-limits';
import { parseRecipeContent, recipeContentSchema, recipeSchema } from '@/domain/recipe/recipe';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleRecipeContents,
} from '@/domain/recipe/samples/sample-recipes';

function problemPaths(input: unknown): string[] {
	const result = recipeContentSchema.safeParse(input);
	return result.success ? [] : problemsFromZodError(result.error).map(({ path }) => path);
}

function withLines(lines: unknown[]): unknown {
	return { ...sampleButtermilkBiscuits, ingredientSections: [{ lines }] };
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
		const longest = 'a'.repeat(maxIngredientLineLength);

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
		const images = [
			{ role: 'dish', pathname: 'dish/soup.jpg' },
			{ role: 'scan', pathname: 'scan/card.jpg' },
			{ role: 'dish', pathname: 'dish/soup.jpg', alt: 'A bowl of soup' },
		];
		expect(problemPaths({ ...sampleChickenSoup, images })).toEqual(['images.2.pathname']);
	});

	it('reads stored content that carries fields it does not know', () => {
		const [section] = sampleChickenSoup.ingredientSections;
		const stored = {
			...sampleChickenSoup,
			retiredField: 'kept by an older version',
			ingredientSections: [{ ...section, collapsed: true }],
		};

		expect(recipeContentSchema.parse(stored)).toEqual(sampleChickenSoup);
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
