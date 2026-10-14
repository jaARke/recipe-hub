import { describe, expect, it } from 'vitest';
import { problemsFromZodError } from '@/domain/problem';
import { recipeContentSchema } from '@/domain/recipe/recipe';
import { recipeDraftContentSchema, recipeDraftSchema } from '@/domain/recipe/recipe-draft';
import { sampleLemonIceboxPie } from '@/domain/recipe/samples/sample-recipes';
import { settings } from '@/lib/settings';

describe('recipeDraftContentSchema', () => {
	it('accepts empty content', () => {
		expect(recipeDraftContentSchema.parse({})).toEqual({});
	});

	it('accepts partial content with empty sections and bare lines and steps', () => {
		const content = {
			title: 'Lemon icebox pie',
			ingredientSections: [{ lines: [{ text: '1 can of milk' }] }, { lines: [] }],
			instructionSections: [
				{ heading: 'For the filling', steps: [] },
				{ steps: [{ text: 'Chill.' }] },
			],
			tags: [],
		};

		expect(recipeDraftContentSchema.parse(content)).toEqual(content);
	});

	it('accepts any valid recipe content', () => {
		expect(recipeDraftContentSchema.safeParse(sampleLemonIceboxPie).success).toBe(true);
	});

	it('reads a stored draft past the limits, which saving it then names', () => {
		const content = {
			title: 'a'.repeat(settings.recipeLimits.maxTitleLength + 1),
			instructionSections: [
				{ steps: [{ text: 'a'.repeat(settings.recipeLimits.maxStepLength + 1) }] },
			],
		};

		expect(recipeDraftContentSchema.parse(content)).toEqual(content);
	});

	it('still rejects malformed values that are present', () => {
		expect(recipeDraftContentSchema.safeParse({ title: '' }).success).toBe(false);
		expect(
			recipeDraftContentSchema.safeParse({ ingredientSections: [{ lines: [{ item: 'flour' }] }] })
				.success
		).toBe(false);
	});
});

describe('recipeDraftSchema', () => {
	it('carries the problems that keep its content from being a recipe', () => {
		const content = {
			title: 'Lemon icebox pie',
			times: {},
			ingredientSections: [{ lines: [{ text: '4 eggs' }] }],
			tags: [],
			images: [],
		};
		const validation = recipeContentSchema.safeParse(content);
		const problems = validation.success ? [] : problemsFromZodError(validation.error);

		const draft = recipeDraftSchema.parse({
			content,
			provenance: { entryMode: 'photo' },
			problems,
		});

		expect(draft.problems.map(({ path }) => path)).toEqual([
			'ingredientSections.0.lines.0.item',
			'instructionSections',
		]);
	});
});
