import { describe, expect, it } from 'vitest';
import { problemsFromZodError, type Problem } from '@/domain/problem';
import { formatAmount } from '@/domain/recipe/amount-format';
import {
	importDraftFromExtractedRecipe,
	type ExtractedRecipe,
	type ExtractedYield,
	type ReviewNote,
} from '@/domain/recipe/extracted-recipe';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import { recipeContentSchema, type RecipeContentInput } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { importDraftSchema, type ImportDraft } from '@/domain/recipe/recipe-import';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';
import { sampleRecipeContents } from '@/domain/recipe/samples/sample-recipes';
import { settings } from '@/lib/settings';

const emptyExtraction: ExtractedRecipe = {
	times: {},
	ingredientSections: [],
	instructionSections: [],
	holidays: [],
	diets: [],
	reviewNotes: [],
};

const toastExtraction: ExtractedRecipe = {
	title: 'Toast',
	times: {},
	ingredientSections: [{ lines: ['1 slice bread'] }],
	instructionSections: [{ steps: ['Toast the bread.'] }],
	holidays: [],
	diets: [],
	reviewNotes: [],
};

const missingProblems = {
	title: { path: 'title', message: 'Add a title. The original doesn’t show one.' },
	ingredients: {
		path: 'ingredientSections',
		message: 'Add the ingredients. The original doesn’t show any.',
	},
	steps: { path: 'instructionSections', message: 'Add the steps. The original doesn’t show any.' },
	chapter: { path: 'chapter', message: 'Choose a chapter.' },
} satisfies Record<string, Problem>;

const chosenChapterNote: Problem = {
	path: 'chapter',
	message: 'Check the chapter. It was chosen for you.',
};

function cutMessage(max: number): string {
	return `Check this against the original. It was cut to ${max} characters, the most it can hold.`;
}

// Every draft is already in the form the schema keeps, so parsing it changes nothing.
function draftFrom(recipe: ExtractedRecipe, images: readonly RecipeImage[] = []): ImportDraft {
	const draft = importDraftFromExtractedRecipe(recipe, images);
	expect(importDraftSchema.parse(draft)).toEqual(draft);
	return draft;
}

function draftWith(changes: Partial<ExtractedRecipe>): ImportDraft {
	return draftFrom({ ...toastExtraction, ...changes });
}

function notePaths(reviewNotes: ReviewNote[], changes: Partial<ExtractedRecipe> = {}): string[] {
	return draftWith({ ...changes, reviewNotes }).problems.map(({ path }) => path);
}

// A sample as an extractor would hand it over: text as written, and the yield's amount as the form
// shows it.
function extractionFrom(sample: RecipeContentInput): ExtractedRecipe {
	const recipeYield = sample.yield;
	return {
		title: sample.title,
		description: sample.description,
		notes: sample.notes,
		source: sample.source,
		yield:
			recipeYield === undefined
				? undefined
				: {
						kind: recipeYield.kind,
						amount: formatAmount(recipeYield.amount),
						unit: recipeYield.kind === 'makes' ? recipeYield.unit : undefined,
					},
		times: sample.times,
		ingredientSections: sample.ingredientSections.map((section) => ({
			heading: section.heading,
			lines: section.lines.map((line) => line.text),
		})),
		instructionSections: sample.instructionSections.map((section) => ({
			heading: section.heading,
			steps: section.steps.map((step) => step.text),
		})),
		chapter: sample.chapter,
		holidays: sample.holidays,
		diets: sample.diets,
		reviewNotes: [],
	};
}

describe('importDraftFromExtractedRecipe', () => {
	it.each(sampleRecipeContents.map((content) => [content.title, content]))(
		'reads the sample "%s" back as stored, with notes on its filing alone',
		(_title, sample) => {
			const content = recipeContentSchema.parse(sample);
			const draft = draftFrom(extractionFrom(sample), content.images);

			expect(draft.content).toEqual(content);
			expect(draft.problems.map(({ path }) => path)).toEqual(
				(['chapter', 'holidays', 'diets'] as const).filter(
					(field) => field === 'chapter' || content[field].length > 0
				)
			);
		}
	);

	it('makes a complete extraction into content ready to save once a chapter is chosen', () => {
		const draft = draftWith({});

		expect(recipeContentSchema.safeParse({ ...draft.content, chapter: 'desserts' }).success).toBe(
			true
		);
		expect(draft.problems).toEqual([missingProblems.chapter]);
	});

	it('flags everything an empty extraction lacks', () => {
		expect(draftFrom(emptyExtraction)).toEqual({
			content: {
				times: {},
				ingredientSections: [],
				instructionSections: [],
				holidays: [],
				diets: [],
				images: [],
			},
			problems: [
				missingProblems.title,
				missingProblems.ingredients,
				missingProblems.steps,
				missingProblems.chapter,
			],
		});
	});

	it.each<[string, ExtractedRecipe]>([
		['an empty extraction', emptyExtraction],
		['no title', { ...toastExtraction, title: ' \u0000 ' }],
		['no ingredients', { ...toastExtraction, ingredientSections: [{ lines: [' '] }] }],
		['no steps', { ...toastExtraction, instructionSections: [] }],
	])('puts a problem everywhere the content falls short of a recipe: %s', (_label, recipe) => {
		const draft = draftFrom(recipe);
		const validation = recipeContentSchema.safeParse(draft.content);
		const shortfalls = validation.success ? [] : problemsFromZodError(validation.error);

		expect(shortfalls).not.toEqual([]);
		expect(draft.problems.map(({ path }) => path)).toEqual(
			expect.arrayContaining(shortfalls.map(({ path }) => path))
		);
	});

	describe('text', () => {
		it('normalizes text fields like the recipe schema, and drops those left blank', () => {
			const draft = draftWith({
				title: '  Crème brûlée\u0000 ',
				description: ' \u0002 \t\n',
				notes: 'Stir.  \r\n\tThen rest.',
				source: '\u007FTante Hélène ',
				ingredientSections: [{ heading: '  For the glaze\u0001', lines: ['1 cup sugar'] }],
				instructionSections: [{ heading: ' \u0003 ', steps: ['Whisk.'] }],
			});

			expect(draft.content).toMatchObject({
				title: 'Crème brûlée',
				notes: 'Stir.\nThen rest.',
				source: 'Tante Hélène',
				ingredientSections: [{ heading: 'For the glaze' }],
			});
			expect(draft.content.description).toBeUndefined();
			expect(draft.content.instructionSections?.[0]?.heading).toBeUndefined();
		});

		it('flags a title that is blank once normalized', () => {
			expect(draftWith({ title: '\u0000 \u0007' }).problems).toEqual([
				missingProblems.title,
				missingProblems.chapter,
			]);
		});

		it('drops the separators that end the title and the headings', () => {
			const draft = draftWith({
				title: 'Toast;',
				ingredientSections: [{ heading: 'For the toast:', lines: ['1 slice bread'] }],
				instructionSections: [{ heading: 'To serve ,', steps: ['Toast the bread.'] }],
			});

			expect(draft.content).toMatchObject({
				title: 'Toast',
				ingredientSections: [{ heading: 'For the toast' }],
				instructionSections: [{ heading: 'To serve' }],
			});
		});
	});

	describe('ingredient lines', () => {
		it('reads each line with the ingredient parser', () => {
			const lines = ['1 cup (240 ml, warm) milk, divided', 'Salt to taste', 'Juice of 1 lemon'];

			expect(draftWith({ ingredientSections: [{ lines }] }).content.ingredientSections).toEqual([
				{ lines: lines.map((line) => parseIngredientLine(line)) },
			]);
		});

		it('strips control characters before reading a line', () => {
			const draft = draftWith({ ingredientSections: [{ lines: [' 2\u0000 cups\u0007 flour '] }] });

			expect(draft.content.ingredientSections).toEqual([
				{ lines: [{ text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' }] },
			]);
		});

		it('stores each line without its list marker or closing punctuation', () => {
			const draft = draftWith({
				ingredientSections: [
					{ lines: ['2 cups flour;', '• 2 eggs', '1. 1/4 tsp.', 'Salt to taste;'] },
				],
			});

			expect(draft.content.ingredientSections).toEqual([
				{
					lines: [
						{ text: '2 cups flour', amount: { min: 2 }, unit: 'cups', item: 'flour' },
						{ text: '2 eggs', amount: { min: 2 }, item: 'eggs' },
						{ text: '1/4 tsp.', item: '1/4 tsp.' },
						{ text: 'Salt to taste', item: 'Salt', preparation: 'to taste' },
					],
				},
			]);
		});

		it('drops a line of only a list marker or punctuation, keeping notes on the lines after it', () => {
			const draft = draftWith({
				ingredientSections: [{ lines: ['•', '2 eggs', ';', '1 cup milk'] }],
				reviewNotes: [{ field: 'ingredient', section: 0, line: 3, note: 'Check the milk.' }],
			});

			expect(draft.content.ingredientSections).toEqual([
				{ lines: [parseIngredientLine('2 eggs'), parseIngredientLine('1 cup milk')] },
			]);
			expect(draft.problems).toEqual([
				{ path: 'ingredientSections.0.lines.1', message: 'Check the milk.' },
				missingProblems.chapter,
			]);
		});

		it('drops blank lines and sections left empty, headings included', () => {
			const draft = draftWith({
				ingredientSections: [
					{ heading: 'For the crust', lines: [' ', '\u0000'] },
					{ lines: ['', '2 eggs', '  '] },
					{ heading: 'For the glaze', lines: [] },
				],
			});

			expect(draft.content.ingredientSections).toEqual([
				{ lines: [parseIngredientLine('2 eggs')] },
			]);
			expect(draft.problems).toEqual([missingProblems.chapter]);
		});

		it('keeps a line at the length limit whole', () => {
			const line = 'a'.repeat(settings.recipeLimits.maxIngredientLineLength);
			const draft = draftWith({ ingredientSections: [{ lines: [line] }] });

			expect(draft.content.ingredientSections?.[0]?.lines[0]?.text).toBe(line);
			expect(draft.problems).toEqual([missingProblems.chapter]);
		});

		it('cuts a longer line to the limit and asks the member to check it', () => {
			const line = `2 cups flour, ${'sifted twice and then '.repeat(30)}`;
			const draft = draftWith({
				ingredientSections: [{ lines: ['  '] }, { lines: ['', '1 egg', line] }],
			});
			const kept = line.slice(0, settings.recipeLimits.maxIngredientLineLength).trimEnd();

			expect(draft.content.ingredientSections).toEqual([
				{ lines: [parseIngredientLine('1 egg'), parseIngredientLine(kept)] },
			]);
			expect(draft.problems).toEqual([
				{
					path: 'ingredientSections.0.lines.1',
					message: cutMessage(settings.recipeLimits.maxIngredientLineLength),
				},
				missingProblems.chapter,
			]);
		});

		it('never cuts a character written as two code units in half', () => {
			const draft = draftWith({
				ingredientSections: [
					{ lines: [`${'a'.repeat(settings.recipeLimits.maxIngredientLineLength - 1)}🥚 eggs`] },
				],
			});

			expect(draft.content.ingredientSections?.[0]?.lines[0]?.text).toBe(
				'a'.repeat(settings.recipeLimits.maxIngredientLineLength - 1)
			);
		});
	});

	describe('limits', () => {
		function pastLimit(max: number): string {
			return 'a'.repeat(max + 1);
		}

		it.each<
			[
				string,
				number,
				Partial<ExtractedRecipe>,
				string,
				(content: RecipeDraftContent) => string | undefined,
			]
		>([
			[
				'title',
				settings.recipeLimits.maxTitleLength,
				{ title: pastLimit(settings.recipeLimits.maxTitleLength) },
				'title',
				(content) => content.title,
			],
			[
				'description',
				settings.recipeLimits.maxDescriptionLength,
				{ description: pastLimit(settings.recipeLimits.maxDescriptionLength) },
				'description',
				(content) => content.description,
			],
			[
				'notes',
				settings.recipeLimits.maxNotesLength,
				{ notes: pastLimit(settings.recipeLimits.maxNotesLength) },
				'notes',
				(content) => content.notes,
			],
			[
				'source',
				settings.recipeLimits.maxSourceLength,
				{ source: pastLimit(settings.recipeLimits.maxSourceLength) },
				'source',
				(content) => content.source,
			],
			[
				'yield unit',
				settings.recipeLimits.maxYieldUnitLength,
				{
					yield: {
						kind: 'makes',
						amount: '12',
						unit: pastLimit(settings.recipeLimits.maxYieldUnitLength),
					},
				},
				'yield.unit',
				(content) => (content.yield?.kind === 'makes' ? content.yield.unit : undefined),
			],
			[
				'section heading',
				settings.recipeLimits.maxSectionHeadingLength,
				{
					instructionSections: [
						{
							heading: pastLimit(settings.recipeLimits.maxSectionHeadingLength),
							steps: ['Toast the bread.'],
						},
					],
				},
				'instructionSections.0.heading',
				(content) => content.instructionSections?.[0]?.heading,
			],
			[
				'step',
				settings.recipeLimits.maxStepLength,
				{ instructionSections: [{ steps: [pastLimit(settings.recipeLimits.maxStepLength)] }] },
				'instructionSections.0.steps.0',
				(content) => content.instructionSections?.[0]?.steps[0]?.text,
			],
		])(
			'cuts a %s past its limit to the limit, with a note, so the draft can be saved',
			(_field, max, changes, path, fieldOf) => {
				const draft = draftWith(changes);

				expect(fieldOf(draft.content)).toBe('a'.repeat(max));
				expect(draft.problems).toEqual([
					{ path, message: cutMessage(max) },
					missingProblems.chapter,
				]);
				expect(
					recipeContentSchema.safeParse({ ...draft.content, chapter: 'desserts' }).success
				).toBe(true);
			}
		);
	});

	describe('steps', () => {
		it('drops the number or bullet a step starts with, and a step of nothing else', () => {
			const draft = draftWith({
				instructionSections: [{ steps: ['1. Heat the oven.', 'Step 2', '• Bake.'] }],
			});

			expect(draft.content.instructionSections).toEqual([
				{ steps: [{ text: 'Heat the oven.' }, { text: 'Bake.' }] },
			]);
		});

		it('wraps each step and drops blank steps and sections left empty', () => {
			const draft = draftWith({
				instructionSections: [
					{ heading: 'For the glaze', steps: ['  '] },
					{ heading: ' Bake ', steps: [' Heat the oven. ', '', 'Bake.'] },
				],
			});

			expect(draft.content.instructionSections).toEqual([
				{ heading: 'Bake', steps: [{ text: 'Heat the oven.' }, { text: 'Bake.' }] },
			]);
			expect(draft.problems).toEqual([missingProblems.chapter]);
		});
	});

	describe('yield', () => {
		it.each<[string, ExtractedYield, RecipeYield]>([
			[
				'a range of servings',
				{ kind: 'servings', amount: '4 to 6' },
				{ kind: 'servings', amount: { min: 4, max: 6 } },
			],
			[
				'servings, without a unit',
				{ kind: 'servings', amount: '4', unit: 'people' },
				{ kind: 'servings', amount: { min: 4 } },
			],
			[
				'a mixed number with a unit',
				{ kind: 'makes', amount: ' 2 1/2 ', unit: ' dozen ' },
				{ kind: 'makes', amount: { min: 2.5 }, unit: 'dozen' },
			],
			[
				'a count whose unit is blank',
				{ kind: 'makes', amount: '1', unit: '\u0000' },
				{ kind: 'makes', amount: { min: 1 } },
			],
			[
				'an amount ending a sentence',
				{ kind: 'servings', amount: '4.' },
				{ kind: 'servings', amount: { min: 4 } },
			],
			[
				'a unit ending a sentence',
				{ kind: 'makes', amount: '12', unit: 'cookies.' },
				{ kind: 'makes', amount: { min: 12 }, unit: 'cookies' },
			],
		])('reads %s like the form reads its yield field', (_label, extracted, expected) => {
			const draft = draftWith({ yield: extracted });

			expect(draft.content.yield).toEqual(expected);
			expect(draft.problems).toEqual([missingProblems.chapter]);
		});

		it('leaves out a yield whose amount is blank', () => {
			const draft = draftWith({ yield: { kind: 'makes', amount: ' ', unit: 'cookies' } });

			expect(draft.content.yield).toBeUndefined();
			expect(draft.problems).toEqual([missingProblems.chapter]);
		});

		it.each<[string, ExtractedYield, RecipeYield, string]>([
			[
				'a count with its unit',
				{ kind: 'makes', amount: 'About 50', unit: 'one and a half inch cakes' },
				{ kind: 'makes', amount: { min: 50 }, unit: 'one and a half inch cakes' },
				'“About 50 one and a half inch cakes”',
			],
			[
				'an abbreviation with its period',
				{ kind: 'makes', amount: 'approx. 2', unit: ' dozen ' },
				{ kind: 'makes', amount: { min: 2 }, unit: 'dozen' },
				'“approx. 2 dozen”',
			],
			[
				'a range of servings',
				{ kind: 'servings', amount: 'Around 4 to 6', unit: 'people' },
				{ kind: 'servings', amount: { min: 4, max: 6 } },
				'“Around 4 to 6”',
			],
			[
				'a two-word phrase',
				{ kind: 'servings', amount: 'up to 8' },
				{ kind: 'servings', amount: { min: 8 } },
				'“up to 8”',
			],
			[
				'an amount ending a sentence',
				{ kind: 'servings', amount: 'About 4.' },
				{ kind: 'servings', amount: { min: 4 } },
				'“About 4.”',
			],
		])(
			'keeps the number of an approximate amount and quotes the original: %s',
			(_label, extracted, expected, quoted) => {
				const draft = draftWith({ yield: extracted });

				expect(draft.content.yield).toEqual(expected);
				expect(draft.problems).toEqual([
					{ path: 'yield.amount', message: `The original says ${quoted}. Check the yield.` },
					missingProblems.chapter,
				]);
			}
		);

		it.each<[string, ExtractedYield, string]>([
			[
				'a count with its unit',
				{ kind: 'makes', amount: 'about a dozen', unit: 'cookies' },
				'“about a dozen cookies”',
			],
			['a count without a number', { kind: 'makes', amount: 'a dozen' }, '“a dozen”'],
			['servings', { kind: 'servings', amount: 'a crowd', unit: 'people' }, '“a crowd”'],
		])(
			'leaves out an amount that is not a number and quotes the original: %s',
			(_label, extracted, quoted) => {
				const draft = draftWith({ yield: extracted });

				expect(draft.content.yield).toBeUndefined();
				expect(draft.problems).toEqual([
					{
						path: 'yield.amount',
						message: `The original says ${quoted}. Use a number, or two numbers for a range.`,
					},
					missingProblems.chapter,
				]);
			}
		);
	});

	describe('times', () => {
		it('keeps whole minutes, zero included', () => {
			const times = { prepMinutes: 0, cookMinutes: 45, totalMinutes: 60 };
			const draft = draftWith({ times });

			expect(draft.content.times).toEqual(times);
			expect(draft.problems).toEqual([missingProblems.chapter]);
		});

		it('drops minutes the recipe cannot hold and says what the original said', () => {
			const draft = draftWith({ times: { prepMinutes: 7.5, cookMinutes: -5, totalMinutes: NaN } });

			expect(draft.content.times).toEqual({});
			expect(draft.problems).toEqual([
				{
					path: 'times.prepMinutes',
					message: 'The original says 7.5 minutes. Enter whole minutes.',
				},
				{
					path: 'times.cookMinutes',
					message: 'The original says -5 minutes. Enter zero or more minutes.',
				},
				{ path: 'times.totalMinutes', message: 'Enter whole minutes.' },
				missingProblems.chapter,
			]);
		});
	});

	describe('review notes', () => {
		it.each<[ReviewNote['field'], string]>([
			['recipe', ''],
			['title', 'title'],
			['description', 'description'],
			['source', 'source'],
			['yield', 'yield'],
			['times', 'times.totalMinutes'],
			['notes', 'notes'],
			['chapter', 'chapter'],
			['holidays', 'holidays'],
			['diets', 'diets'],
		])('puts a note on %s at "%s"', (field, path) => {
			const note = 'Check this against the original.';

			expect(draftWith({ reviewNotes: [{ field, note }] }).problems).toEqual([
				{ path, message: note },
				missingProblems.chapter,
			]);
		});

		it('points ingredient and step notes at what they name once blanks are dropped', () => {
			const lists: Partial<ExtractedRecipe> = {
				ingredientSections: [
					{ lines: [''] },
					{ heading: 'For the filling', lines: ['', '2 eggs', ' ', '1 cup sugar'] },
				],
				instructionSections: [{ steps: ['Mix.'] }, { steps: ['  '] }, { steps: ['', 'Bake.'] }],
			};
			const notes: ReviewNote[] = [
				{ field: 'ingredient', section: 1, line: 3, note: 'Check the sugar.' },
				{ field: 'ingredient', section: 1, note: 'Check the filling.' },
				{ field: 'ingredient', note: 'Check the ingredients.' },
				{ field: 'step', section: 2, line: 1, note: 'Check the bake.' },
				{ field: 'step', section: 2, note: 'Check the last steps.' },
				{ field: 'step', note: 'Check the steps.' },
			];

			expect(notePaths(notes, lists)).toEqual([
				'ingredientSections.0.lines.1',
				'ingredientSections.0',
				'ingredientSections',
				'instructionSections.1.steps.0',
				'instructionSections.1',
				'instructionSections',
				'chapter',
			]);
		});

		it('moves a note whose item is gone to the section or list around it', () => {
			const lists: Partial<ExtractedRecipe> = {
				ingredientSections: [{ lines: [' '] }, { lines: ['', '2 eggs'] }],
			};
			const notes: ReviewNote[] = [
				{ field: 'ingredient', section: 1, line: 0, note: 'A blank line.' },
				{ field: 'ingredient', section: 1, line: 9, note: 'Past the last line.' },
				{ field: 'ingredient', section: 1, line: 0.5, note: 'Between lines.' },
				{ field: 'ingredient', section: 0, line: 0, note: 'In an empty section.' },
				{ field: 'ingredient', section: 4, note: 'Past the last section.' },
				{ field: 'ingredient', section: -1, note: 'Before the first section.' },
				{ field: 'ingredient', line: 1, note: 'A line in no section.' },
				{ field: 'step', section: 0, line: 3, note: 'Past the last step.' },
			];

			expect(notePaths(notes, lists)).toEqual([
				'chapter',
				'ingredientSections.0',
				'ingredientSections.0',
				'ingredientSections.0',
				'ingredientSections',
				'ingredientSections',
				'ingredientSections',
				'ingredientSections',
				'instructionSections.0',
			]);
		});

		it('uses the note as written, normalized, and skips a blank one', () => {
			const draft = draftWith({
				reviewNotes: [
					{ field: 'title', note: ' \u0000 ' },
					{ field: 'title', note: '  The title is a guess.\u0007 ' },
				],
			});

			expect(draft.problems).toEqual([
				{ path: 'title', message: 'The title is a guess.' },
				missingProblems.chapter,
			]);
		});
	});

	describe('filing', () => {
		it('files the recipe where the extractor did, with a note on each choice to check', () => {
			const draft = draftWith({
				chapter: 'cookies-candy',
				holidays: ['christmas'],
				diets: ['gluten-free'],
			});

			expect(draft.content).toMatchObject({
				chapter: 'cookies-candy',
				holidays: ['christmas'],
				diets: ['gluten-free'],
			});
			expect(draft.problems).toEqual([
				chosenChapterNote,
				{ path: 'holidays', message: 'Check the holidays. The original mentions Christmas.' },
				{
					path: 'diets',
					message: 'Check the diet. Keep gluten-free only if the original says so.',
				},
			]);
		});

		it('asks for a chapter, and notes no holidays or diets, where the extractor named none', () => {
			const draft = draftWith({});

			expect(draft.content.chapter).toBeUndefined();
			expect(draft.content).toMatchObject({ holidays: [], diets: [] });
			expect(draft.problems).toEqual([missingProblems.chapter]);
		});

		it('lists the holidays once each, in calendar order', () => {
			const draft = draftWith({
				chapter: 'desserts',
				holidays: ['christmas', 'new-years-day', 'christmas', 'easter'],
			});

			expect(draft.content.holidays).toEqual(['new-years-day', 'easter', 'christmas']);
			expect(draft.problems).toEqual([
				chosenChapterNote,
				{
					path: 'holidays',
					message:
						'Check the holidays. The original mentions New Year’s Day, Easter, and Christmas.',
				},
			]);
		});

		it('adds the diets Vegan implies, and names only the diets stated in the note', () => {
			const draft = draftWith({ chapter: 'main-dishes', diets: ['gluten-free', 'vegan'] });

			expect(draft.content.diets).toEqual(['vegetarian', 'vegan', 'gluten-free', 'dairy-free']);
			expect(draft.problems).toEqual([
				chosenChapterNote,
				{
					path: 'diets',
					message: 'Check the diet. Keep vegan and gluten-free only if the original says so.',
				},
			]);
		});

		it('makes a filed extraction into content ready to save', () => {
			const draft = draftWith({ chapter: 'breads-rolls', holidays: ['easter'], diets: ['vegan'] });

			expect(recipeContentSchema.parse(draft.content)).toMatchObject({
				chapter: 'breads-rolls',
				holidays: ['easter'],
				diets: ['vegetarian', 'vegan', 'dairy-free'],
			});
		});
	});

	describe('problem order', () => {
		it('puts what the draft could not keep before the notes on the same field', () => {
			const draft = draftWith({
				yield: { kind: 'servings', amount: 'a crowd' },
				times: { totalMinutes: 90.5 },
				ingredientSections: [
					{ lines: ['x'.repeat(settings.recipeLimits.maxIngredientLineLength + 1)] },
				],
				reviewNotes: [
					{ field: 'yield', note: 'The yield is a guess.' },
					{ field: 'times', note: 'The card gives no times.' },
					{ field: 'ingredient', section: 0, line: 0, note: 'Part of this line was hard to read.' },
				],
			});

			expect(draft.problems.map(({ path }) => path)).toEqual([
				'yield.amount',
				'times.totalMinutes',
				'ingredientSections.0.lines.0',
				'yield',
				'times.totalMinutes',
				'ingredientSections.0.lines.0',
				'chapter',
			]);
		});

		it('puts the notes before what the recipe lacks', () => {
			const draft = draftFrom({
				...emptyExtraction,
				reviewNotes: [
					{ field: 'title', note: 'The title is torn off the card.' },
					{ field: 'ingredient', note: 'The ingredients are on a page that was not included.' },
				],
			});

			expect(draft.problems).toEqual([
				{ path: 'title', message: 'The title is torn off the card.' },
				{
					path: 'ingredientSections',
					message: 'The ingredients are on a page that was not included.',
				},
				missingProblems.title,
				missingProblems.ingredients,
				missingProblems.steps,
				missingProblems.chapter,
			]);
		});

		it('puts the extractor’s notes on the filing before the import’s own', () => {
			const draft = draftWith({
				chapter: 'desserts',
				holidays: ['halloween'],
				reviewNotes: [
					{ field: 'chapter', note: 'The card doesn’t say what kind of dish it is.' },
					{ field: 'holidays', note: 'The card is decorated with pumpkins.' },
				],
			});

			expect(draft.problems).toEqual([
				{ path: 'chapter', message: 'The card doesn’t say what kind of dish it is.' },
				{ path: 'holidays', message: 'The card is decorated with pumpkins.' },
				chosenChapterNote,
				{ path: 'holidays', message: 'Check the holidays. The original mentions Halloween.' },
			]);
		});

		it('puts what the recipe lacks before a note whose item is gone', () => {
			const draft = draftWith({
				ingredientSections: [{ lines: [''] }],
				reviewNotes: [{ field: 'ingredient', section: 0, line: 0, note: 'Hard to read.' }],
			});

			expect(draft.problems).toEqual([
				missingProblems.ingredients,
				missingProblems.chapter,
				{ path: 'ingredientSections', message: 'Hard to read.' },
			]);
		});

		it('drops a problem it already has', () => {
			const note = 'Check this line against the original.';
			const draft = draftWith({
				ingredientSections: [{ lines: ['', ' ', '2 eggs'] }],
				reviewNotes: [
					{ field: 'ingredient', section: 0, line: 0, note },
					{ field: 'ingredient', section: 0, line: 1, note },
					{ field: 'notes', note: 'Check the notes.' },
					{ field: 'notes', note: ' Check the notes. ' },
				],
			});

			expect(draft.problems).toEqual([
				{ path: 'notes', message: 'Check the notes.' },
				missingProblems.chapter,
				{ path: 'ingredientSections.0', message: note },
			]);
		});
	});

	it('keeps the scans attached', () => {
		const images: RecipeImage[] = [
			{ role: 'scan', pathname: 'scan/0199c7a4/page-1.jpg' },
			{ role: 'scan', pathname: 'scan/0199c7a4/page-2.jpg' },
		];
		const draft = draftFrom(toastExtraction, images);

		expect(draft.content.images).toEqual(images);
	});
});
