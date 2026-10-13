import { describe, expect, it } from 'vitest';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import type { RecipeContentInput } from '@/domain/recipe/recipe';
import { sampleEclairs } from '@/domain/recipe/samples/baking-and-desserts';
import {
	sampleButtermilkBiscuits,
	sampleSundayPotRoast,
} from '@/domain/recipe/samples/sample-recipes';
import { JsonLdPageRecipeExtractor } from '@/infrastructure/web/json-ld-page-recipe-extractor';

const pageUrl = 'https://blog.example.com/sunday-pot-roast/';

function pageWith(blocks: readonly unknown[], url = pageUrl): WebPage {
	const scripts = blocks
		.map((block) => (typeof block === 'string' ? block : JSON.stringify(block)))
		.map((json) => `<script type="application/ld+json">${json}</script>`)
		.join('\n');
	return { url, html: `<!doctype html><html><head>${scripts}</head><body></body></html>` };
}

function recipe(fields: object): object {
	return {
		'@context': 'https://schema.org',
		'@type': 'Recipe',
		name: 'Pancakes',
		recipeIngredient: ['1 cup flour'],
		recipeInstructions: [{ '@type': 'HowToStep', text: 'Mix and fry.' }],
		...fields,
	};
}

async function extracted(page: WebPage) {
	return (await new JsonLdPageRecipeExtractor().extract(page))?.recipe;
}

function lineTexts(sample: RecipeContentInput): string[] {
	return sample.ingredientSections.flatMap((section) => section.lines.map((line) => line.text));
}

function stepTexts(section: RecipeContentInput['instructionSections'][number]): string[] {
	return section.steps.map((step) => step.text);
}

// As WordPress writes text into JSON-LD.
function withEntities(text: string): string {
	return text.replaceAll("'", '&#39;').replaceAll('°', '&deg;').replaceAll('½', '&frac12;');
}

// WP Recipe Maker inside Yoast's graph: the author by reference, the yield twice, and the steps in
// sections.
function wpRecipeMakerPage(sample: RecipeContentInput): WebPage {
	const personId = 'https://blog.example.com/#/schema/person/ray';
	return pageWith([
		{
			'@context': 'https://schema.org',
			'@graph': [
				{ '@type': 'WebPage', '@id': pageUrl, name: sample.title },
				{ '@type': 'Person', '@id': personId, name: sample.source },
				{
					'@type': 'Recipe',
					'@id': `${pageUrl}#recipe`,
					name: withEntities(sample.title),
					author: { '@id': personId },
					description: withEntities(sample.description ?? ''),
					recipeYield: ['8', '8 servings'],
					prepTime: 'PT25M',
					cookTime: 'PT200M',
					totalTime: 'PT225M',
					recipeIngredient: lineTexts(sample).map(withEntities),
					recipeInstructions: sample.instructionSections.map((section) => ({
						'@type': 'HowToSection',
						name: section.heading,
						itemListElement: stepTexts(section).map((text, index) => ({
							'@type': 'HowToStep',
							text: withEntities(text),
							name: withEntities(text),
							url: `${pageUrl}#wprm-recipe-1-step-${index}`,
						})),
					})),
					mainEntityOfPage: pageUrl,
				},
			],
		},
	]);
}

// Tasty Recipes: one Recipe on its own, entities encoded twice, and a step per HowToStep.
function tastyRecipesPage(sample: RecipeContentInput): WebPage {
	return pageWith([
		{
			'@context': 'https://schema.org/',
			'@type': 'Recipe',
			name: sample.title.replace('É', '&amp;Eacute;'),
			author: { '@type': 'Person', name: 'Tante H&eacute;l&egrave;ne' },
			recipeYield: ['12', '12 &eacute;clairs'],
			prepTime: 'PT40M',
			cookTime: 'PT35M',
			recipeIngredient: lineTexts(sample),
			recipeInstructions: sample.instructionSections.flatMap(stepTexts).map((text) => ({
				'@type': 'HowToStep',
				text,
			})),
		},
	]);
}

// A blog's own JSON-LD: types as a list, the author as text, every list as one string, and times
// written out.
function plainBlogPage(sample: RecipeContentInput): WebPage {
	return pageWith([
		{ '@context': 'https://schema.org', '@type': 'Organization', name: 'June’s Kitchen' },
		{
			'@context': 'https://schema.org',
			'@type': ['Recipe', 'NewsArticle'],
			name: sample.title,
			author: sample.source,
			recipeYield: 'Makes 10 biscuits',
			prepTime: '15 minutes',
			cookTime: '18 mins',
			totalTime: 'PT35M',
			recipeIngredient: `${lineTexts(sample).join('<br />\n')}<br /><br />`,
			recipeInstructions: sample.instructionSections
				.flatMap(stepTexts)
				.map((text, index) => `${index + 1}. ${text}`)
				.join('\n'),
		},
	]);
}

describe('extract', () => {
	it('reads WP Recipe Maker in a Yoast graph', async () => {
		await expect(extracted(wpRecipeMakerPage(sampleSundayPotRoast))).resolves.toEqual({
			title: sampleSundayPotRoast.title,
			description: sampleSundayPotRoast.description,
			source: 'Uncle Ray',
			yield: { kind: 'servings', amount: '8' },
			times: { prepMinutes: 25, cookMinutes: 200, totalMinutes: 225 },
			ingredientSections: [{ lines: lineTexts(sampleSundayPotRoast) }],
			instructionSections: sampleSundayPotRoast.instructionSections.map((section) => ({
				heading: section.heading,
				steps: stepTexts(section),
			})),
			reviewNotes: [],
		});
	});

	it('reads Tasty Recipes, decoding entities encoded twice', async () => {
		await expect(extracted(tastyRecipesPage(sampleEclairs))).resolves.toEqual({
			title: sampleEclairs.title,
			source: 'Tante Hélène',
			yield: { kind: 'makes', amount: '12', unit: 'éclairs' },
			times: { prepMinutes: 40, cookMinutes: 35 },
			ingredientSections: [{ lines: lineTexts(sampleEclairs) }],
			instructionSections: [{ steps: sampleEclairs.instructionSections.flatMap(stepTexts) }],
			reviewNotes: [],
		});
	});

	it('reads a blog’s own JSON-LD, splitting lists written as one string', async () => {
		await expect(extracted(plainBlogPage(sampleButtermilkBiscuits))).resolves.toEqual({
			title: sampleButtermilkBiscuits.title,
			source: 'Aunt June',
			yield: { kind: 'makes', amount: '10', unit: 'biscuits' },
			times: { prepMinutes: 15, cookMinutes: 18, totalMinutes: 35 },
			ingredientSections: [{ lines: lineTexts(sampleButtermilkBiscuits) }],
			instructionSections: [
				{ steps: sampleButtermilkBiscuits.instructionSections.flatMap(stepTexts) },
			],
			reviewNotes: [],
		});
	});

	it('names no model or cost, since no model read the page', async () => {
		const extraction = await new JsonLdPageRecipeExtractor().extract(pageWith([recipe({})]));

		expect(Object.keys(extraction ?? {})).toEqual(['recipe']);
	});

	it.each([
		['no JSON-LD', { url: pageUrl, html: '<html><body><h1>Pancakes</h1></body></html>' }],
		['JSON-LD without a recipe', pageWith([{ '@type': 'Organization', name: 'Blog' }])],
		[
			'a recipe without ingredients or steps',
			pageWith([recipe({ recipeIngredient: [], recipeInstructions: '' })]),
		],
		['JSON-LD that does not parse', pageWith(['{"@type": "Recipe", "name": '])],
	])('finds nothing on a page with %s', async (_, page) => {
		await expect(new JsonLdPageRecipeExtractor().extract(page)).resolves.toBeNull();
	});

	it('reads JSON-LD wrapped in a comment, with raw line breaks and trailing commas', async () => {
		const json =
			'<!--{"@type": "Recipe", "name": "Pan\ncakes", "recipeIngredient": ["1 cup flour",],}-->';

		await expect(extracted(pageWith([json]))).resolves.toMatchObject({
			title: 'Pan cakes',
			ingredientSections: [{ lines: ['1 cup flour'] }],
		});
	});

	it('reads a page nesting JSON-LD or HTML far deeper than real pages, rather than failing', async () => {
		const deepJson = `${'['.repeat(20_000)}${']'.repeat(20_000)}`;
		const deepHtml = `${'<div>'.repeat(20_000)}2 eggs${'</div>'.repeat(20_000)}`;
		const page = pageWith([deepJson, recipe({ recipeIngredient: ['1 cup flour', deepHtml] })]);

		await expect(extracted(page)).resolves.toMatchObject({
			ingredientSections: [{ lines: ['1 cup flour', expect.any(String)] }],
		});
	});

	it.each([
		[
			'hold ingredients in a list inside itself',
			pageWith([
				recipe({
					recipeIngredient: {
						'@type': 'ItemList',
						'@id': '#ingredients',
						itemListElement: ['1 cup flour', { '@id': '#ingredients' }],
					},
				}),
			]),
		],
		[
			'hold steps in a section inside itself',
			pageWith([
				recipe({
					recipeInstructions: [
						{
							'@type': 'HowToSection',
							'@id': '#method',
							name: 'Method',
							itemListElement: [{ '@type': 'HowToStep', text: 'Mix.' }, { '@id': '#method' }],
						},
					],
				}),
			]),
		],
		[
			'hold steps in a list whose item is the list',
			pageWith([
				recipe({
					recipeInstructions: {
						'@type': 'ItemList',
						'@id': '#steps',
						itemListElement: [{ '@type': 'ListItem', position: 1, item: { '@id': '#steps' } }],
					},
				}),
			]),
		],
		[
			'nest far deeper than real pages',
			pageWith([
				`{"@type": "Recipe", "recipeInstructions": "Mix.", "recipeIngredient": ${'{"@type": "ItemList", "itemListElement": ['.repeat(20_000)}"2 eggs"${']}'.repeat(20_000)}}`,
			]),
		],
		[
			'multiply through references',
			pageWith([
				recipe({ recipeIngredient: { '@id': '#list-0' } }),
				...[0, 1, 2].map((level) => ({
					'@type': 'ItemList',
					'@id': `#list-${level}`,
					itemListElement: Array.from({ length: 40 }, () =>
						level === 2 ? '1 cup flour' : { '@id': `#list-${level + 1}` }
					),
				})),
			]),
		],
		[
			'hold more steps in one string than any recipe',
			pageWith([recipe({ recipeInstructions: 'Mix.\n'.repeat(140_000) })]),
		],
		[
			'hold more ingredients in one string than any recipe',
			pageWith([recipe({ recipeIngredient: '1 cup flour\n'.repeat(100_000) })]),
		],
	])('leaves a page whose lists %s to the model, rather than failing', async (_, page) => {
		await expect(new JsonLdPageRecipeExtractor().extract(page)).resolves.toBeNull();
	});

	it('reads ingredients from an ItemList in position order, and from PropertyValues', async () => {
		const page = pageWith([
			recipe({
				recipeIngredient: [
					{
						'@type': 'ItemList',
						itemListElement: [
							{ '@type': 'ListItem', position: 2, item: '2 eggs' },
							{ '@type': 'ListItem', position: 1, item: '1 cup flour' },
						],
					},
					{ '@type': 'PropertyValue', value: 250, unitText: 'ml', name: 'milk' },
				],
			}),
		]);

		await expect(extracted(page)).resolves.toMatchObject({
			ingredientSections: [{ lines: ['1 cup flour', '2 eggs', '250 ml milk'] }],
		});
	});

	it('reads steps from an ItemList, from HTML, and from directions inside a step', async () => {
		const page = pageWith([
			recipe({
				recipeInstructions: {
					'@type': 'ItemList',
					itemListElement: [
						{
							'@type': 'ListItem',
							position: 1,
							item: { '@type': 'HowToStep', text: '<p>Whisk the <b>batter</b>.</p>' },
						},
						{
							'@type': 'ListItem',
							position: 2,
							item: '<ol><li>Heat the pan.</li><li>Fry.</li></ol>',
						},
						{
							'@type': 'HowToStep',
							position: 3,
							itemListElement: [
								{ '@type': 'HowToDirection', text: 'Flip once.' },
								{ '@type': 'HowToTip', text: 'Bubbles mean it is ready.' },
							],
						},
					],
				},
			}),
		]);

		await expect(extracted(page)).resolves.toMatchObject({
			instructionSections: [
				{
					steps: [
						'Whisk the batter.',
						'Heat the pan.',
						'Fry.',
						'Flip once. Bubbles mean it is ready.',
					],
				},
			],
		});
	});

	it('keeps a step’s text over its heading, and steps around sections in sections of their own', async () => {
		const page = pageWith([
			recipe({
				recipeInstructions: [
					{ '@type': 'HowToStep', name: 'Batter', text: 'Mix the batter.' },
					{
						'@type': 'HowToSection',
						name: 'For the topping',
						itemListElement: [{ '@type': 'HowToStep', text: 'Whip the cream.' }],
					},
					'Serve warm.',
				],
			}),
		]);

		await expect(extracted(page)).resolves.toMatchObject({
			instructionSections: [
				{ steps: ['Mix the batter.'] },
				{ heading: 'For the topping', steps: ['Whip the cream.'] },
				{ steps: ['Serve warm.'] },
			],
		});
	});

	it.each([
		[6, { kind: 'servings', amount: '6' }],
		['4 to 6', { kind: 'servings', amount: '4 to 6' }],
		[['4', '4 servings'], { kind: 'servings', amount: '4' }],
		['4 serving(s)', { kind: 'servings', amount: '4' }],
		['Serves 4 as a side', { kind: 'servings', amount: '4' }],
		['Yield: 2 1/2', { kind: 'servings', amount: '2 1/2' }],
		['12 servings', { kind: 'servings', amount: '12' }],
		['1 1/2 to 2 servings', { kind: 'servings', amount: '1 1/2 to 2' }],
		['Serves 1 1/2 - 2', { kind: 'servings', amount: '1 1/2 - 2' }],
		['Makes 2 1/2 to 3 dozen', { kind: 'makes', amount: '2 1/2 to 3', unit: 'dozen' }],
		['Serves about 6', { kind: 'servings', amount: 'about 6' }],
		['Makes about 2 dozen', { kind: 'makes', amount: 'about 2 dozen' }],
		[['36', '36 cookies'], { kind: 'makes', amount: '36', unit: 'cookies' }],
		['Makes 16', { kind: 'makes', amount: '16' }],
		['2 dozen cookies', { kind: 'makes', amount: '2', unit: 'dozen cookies' }],
		[
			{ '@type': 'QuantitativeValue', value: 8, unitText: 'wedges' },
			{ kind: 'makes', amount: '8', unit: 'wedges' },
		],
		['about a dozen', { kind: 'makes', amount: 'about a dozen' }],
	])('reads the yield %j as written', async (recipeYield, expected) => {
		await expect(extracted(pageWith([recipe({ recipeYield })]))).resolves.toMatchObject({
			yield: expected,
		});
	});

	it.each([
		['PT20M', 20],
		['PT240M', 240],
		['PT1H30M', 90],
		['P0Y0M0DT0H20M0.000S', 20],
		['P1DT2H', 1560],
		['1 hour 30 minutes', 90],
		['PT0S', undefined],
		['PT', undefined],
		['P1M', undefined],
		['soon', undefined],
	])('reads the time %s as %s minutes', async (cookTime, cookMinutes) => {
		const result = await extracted(pageWith([recipe({ cookTime })]));

		expect(result?.times.cookMinutes).toBe(cookMinutes);
	});

	it.each([
		[{ author: { '@type': 'Person', name: 'Ada' } }, 'Ada'],
		[{ author: [{ name: 'Ada' }, { name: 'Grace' }, 'Ada'] }, 'Ada and Grace'],
		[{ author: ['Ada', 'Grace', 'Hedy'] }, 'Ada, Grace, and Hedy'],
		[{ publisher: { '@type': 'Organization', name: 'The Daily Kitchen' } }, 'The Daily Kitchen'],
		[{}, undefined],
	])('takes the source from %j', async (fields, source) => {
		const result = await extracted(pageWith([recipe(fields)]));

		expect(result?.source).toBe(source);
	});

	describe('on a page with several recipes', () => {
		const first = recipe({
			'@id': `${pageUrl}#first`,
			name: 'First',
			url: 'https://other.example.com/first',
		});
		const second = recipe({ '@id': `${pageUrl}#second`, name: 'Second', url: pageUrl });
		const third = recipe({ '@id': `${pageUrl}#third`, name: 'Third' });

		it('takes the one the address’s fragment names', async () => {
			const page = pageWith(
				[first, second, third, { '@type': 'WebPage', mainEntity: { '@id': `${pageUrl}#second` } }],
				`${pageUrl}#third`
			);

			await expect(extracted(page)).resolves.toMatchObject({ title: 'Third' });
		});

		it('takes the page’s mainEntity next', async () => {
			const page = pageWith([
				first,
				second,
				third,
				{ '@type': 'WebPage', mainEntity: { '@id': `${pageUrl}#third` } },
			]);

			await expect(extracted(page)).resolves.toMatchObject({ title: 'Third' });
		});

		it('takes the one whose url is the page next', async () => {
			await expect(extracted(pageWith([first, second, third]))).resolves.toMatchObject({
				title: 'Second',
			});
		});

		it('takes the first with ingredients last', async () => {
			const withoutIngredients = recipe({ name: 'Empty', recipeIngredient: [] });

			await expect(extracted(pageWith([withoutIngredients, first, third]))).resolves.toMatchObject({
				title: 'First',
			});
		});
	});
});
