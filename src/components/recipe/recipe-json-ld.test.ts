import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { publicRecipe } from '@/application/testing/public-recipes';
import { RecipeJsonLd, toRecipeJsonLd } from '@/components/recipe/recipe-json-ld';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleMolassesSpiceCookies,
	sampleTomatoSalad,
} from '@/domain/recipe/samples/sample-recipes';

const siteUrl = new URL('https://recipes.example.com');

describe('toRecipeJsonLd', () => {
	it('describes a recipe with absolute URLs for the page and every dish photo', () => {
		const soup = publicRecipe('weeknight-chicken-soup', {
			...sampleChickenSoup,
			images: [
				{ role: 'dish', pathname: 'dish/seed/soup.jpg', alt: 'A bowl of soup' },
				{ role: 'dish', pathname: 'dish/seed/soup-pot.jpg' },
			],
		});

		expect(toRecipeJsonLd(soup, siteUrl)).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'Recipe',
			url: 'https://recipes.example.com/recipes/weeknight-chicken-soup',
			name: 'Weeknight chicken soup',
			image: [
				'https://recipes.example.com/api/images/dish/seed/soup.jpg',
				'https://recipes.example.com/api/images/dish/seed/soup-pot.jpg',
			],
			datePublished: '2026-10-01T12:00:00.000Z',
			dateModified: '2026-10-05T08:30:00.000Z',
			recipeYield: '6',
		});
	});

	it('names the contributor as the author, never the source', () => {
		const soup = publicRecipe('weeknight-chicken-soup', sampleChickenSoup);

		expect(toRecipeJsonLd(soup, siteUrl).author).toEqual({ '@type': 'Person', name: 'Ada' });
	});

	it('leaves out the image when the recipe has no dish photo', () => {
		const salad = publicRecipe('garden-tomato-salad', { ...sampleTomatoSalad, images: [] });

		expect(toRecipeJsonLd(salad, siteUrl).image).toBeUndefined();
	});

	it('names only the dish photos, never a scan of the original', () => {
		const soup = publicRecipe('weeknight-chicken-soup', {
			...sampleChickenSoup,
			images: [
				{ role: 'scan', pathname: 'scan/seed/soup-card.jpg', alt: 'The recipe card' },
				{ role: 'dish', pathname: 'dish/seed/soup.jpg' },
				{ role: 'scan', pathname: 'scan/seed/soup-card-back.jpg' },
			],
		});

		expect(toRecipeJsonLd(soup, siteUrl).image).toEqual([
			'https://recipes.example.com/api/images/dish/seed/soup.jpg',
		]);
	});

	it('leaves out the image when the recipe has scans but no dish photo', () => {
		const soup = publicRecipe('weeknight-chicken-soup', {
			...sampleChickenSoup,
			images: [{ role: 'scan', pathname: 'scan/seed/soup-card.jpg' }],
		});

		expect(toRecipeJsonLd(soup, siteUrl).image).toBeUndefined();
	});

	it('lists each ingredient line as written', () => {
		const pie = publicRecipe('lemon-icebox-pie', sampleLemonIceboxPie);

		expect(toRecipeJsonLd(pie, siteUrl).recipeIngredient).toEqual([
			'1½ cups graham cracker crumbs',
			'⅓ cup sugar',
			'6 tablespoons butter, melted',
			'14 ounces sweetened condensed milk',
			'4 egg yolks',
			'½ cup fresh lemon juice',
			'1 tablespoon lemon zest',
		]);
	});

	describe('yield', () => {
		it('gives servings as just a number', () => {
			const soup = publicRecipe('weeknight-chicken-soup', sampleChickenSoup);

			expect(toRecipeJsonLd(soup, siteUrl).recipeYield).toBe('6');
		});

		it('keeps the wording of a range of servings', () => {
			const soup = publicRecipe('weeknight-chicken-soup', {
				...sampleChickenSoup,
				yield: { kind: 'servings', amount: { min: 4, max: 6 } },
			});

			expect(toRecipeJsonLd(soup, siteUrl).recipeYield).toBe('Serves 4 to 6');
		});

		it('keeps the wording of a yield that makes an amount', () => {
			const biscuits = publicRecipe('buttermilk-biscuits', sampleButtermilkBiscuits);

			expect(toRecipeJsonLd(biscuits, siteUrl).recipeYield).toBe('Makes 10 biscuits');
		});
	});

	describe('times', () => {
		it('gives prep, cook, and the stated total', () => {
			const biscuits = publicRecipe('buttermilk-biscuits', sampleButtermilkBiscuits);

			expect(toRecipeJsonLd(biscuits, siteUrl)).toMatchObject({
				prepTime: 'PT15M',
				cookTime: 'PT18M',
				totalTime: 'PT35M',
			});
		});

		it('adds prep and cook for the total when none is stated', () => {
			const soup = publicRecipe('weeknight-chicken-soup', sampleChickenSoup);

			expect(toRecipeJsonLd(soup, siteUrl)).toMatchObject({
				prepTime: 'PT15M',
				cookTime: 'PT35M',
				totalTime: 'PT50M',
			});
		});

		it('gives only the total when prep or cook is missing', () => {
			const salad = publicRecipe('garden-tomato-salad', sampleTomatoSalad);
			const jsonLd = toRecipeJsonLd(salad, siteUrl);

			expect(jsonLd.prepTime).toBeUndefined();
			expect(jsonLd.cookTime).toBeUndefined();
			expect(jsonLd.totalTime).toBe('PT15M');
		});
	});

	describe('chapter, holidays, and diets', () => {
		it('gives the chapter’s courses as the category', () => {
			const cookies = publicRecipe('molasses-spice-cookies', sampleMolassesSpiceCookies);

			expect(toRecipeJsonLd(cookies, siteUrl).recipeCategory).toBe('Cookies, Candy');
		});

		it('gives no category for This & That, which is no course', () => {
			const cookies = publicRecipe('molasses-spice-cookies', {
				...sampleMolassesSpiceCookies,
				chapter: 'this-and-that',
			});

			expect(toRecipeJsonLd(cookies, siteUrl).recipeCategory).toBeUndefined();
		});

		it('names each diet schema.org has by its full URL, and Dairy-free among the keywords', () => {
			const salad = publicRecipe('garden-tomato-salad', sampleTomatoSalad);

			expect(toRecipeJsonLd(salad, siteUrl)).toMatchObject({
				suitableForDiet: [
					'https://schema.org/VegetarianDiet',
					'https://schema.org/VeganDiet',
					'https://schema.org/GlutenFreeDiet',
				],
				keywords: 'Dairy-free',
			});
		});

		it('lists the holidays among the keywords, in calendar order, before Dairy-free', () => {
			const cookies = publicRecipe('molasses-spice-cookies', {
				...sampleMolassesSpiceCookies,
				holidays: ['christmas', 'thanksgiving'],
				diets: ['dairy-free'],
			});
			const jsonLd = toRecipeJsonLd(cookies, siteUrl);

			expect(jsonLd.keywords).toBe('Thanksgiving, Christmas, Dairy-free');
			expect(jsonLd.suitableForDiet).toBeUndefined();
		});

		it('leaves out the diets and the keywords for a recipe with no holiday or diet', () => {
			const soup = publicRecipe('weeknight-chicken-soup', sampleChickenSoup);
			const jsonLd = toRecipeJsonLd(soup, siteUrl);

			expect(jsonLd.suitableForDiet).toBeUndefined();
			expect(jsonLd.keywords).toBeUndefined();
		});
	});

	describe('instructions', () => {
		it('lists the steps of an unsectioned recipe', () => {
			const salad = publicRecipe('garden-tomato-salad', sampleTomatoSalad);

			expect(toRecipeJsonLd(salad, siteUrl).recipeInstructions).toEqual([
				{ '@type': 'HowToStep', text: 'Toss the tomatoes and onion with the oil and vinegar.' },
				{
					'@type': 'HowToStep',
					text: 'Let stand 10 minutes, then scatter the basil and season with salt and pepper.',
				},
			]);
		});

		it('groups the steps of a sectioned recipe under their headings', () => {
			const pie = publicRecipe('lemon-icebox-pie', sampleLemonIceboxPie);

			expect(toRecipeJsonLd(pie, siteUrl).recipeInstructions).toEqual([
				{
					'@type': 'HowToSection',
					name: 'For the crust',
					itemListElement: [
						{ '@type': 'HowToStep', text: 'Heat the oven to 350°F.' },
						{
							'@type': 'HowToStep',
							text: 'Mix the crumbs, sugar, and butter, press into a 9-inch pie plate, and bake until fragrant, about 8 minutes.',
						},
					],
				},
				{
					'@type': 'HowToSection',
					name: 'For the filling',
					itemListElement: [
						{
							'@type': 'HowToStep',
							text: 'Whisk the condensed milk, yolks, lemon juice, and zest until smooth.',
						},
						{
							'@type': 'HowToStep',
							text: 'Pour into the warm crust and bake until just set at the edges, about 7 minutes.',
						},
						{ '@type': 'HowToStep', text: 'Cool, then chill until firm, about 4 hours.' },
					],
				},
			]);
		});

		it('keeps the steps of an unheaded section outside the named sections', () => {
			const pie = publicRecipe('lemon-icebox-pie', {
				...sampleLemonIceboxPie,
				instructionSections: [
					{ steps: [{ text: 'Heat the oven to 350°F.' }] },
					{ heading: 'For the filling', steps: [{ text: 'Whisk the filling until smooth.' }] },
				],
			});

			expect(toRecipeJsonLd(pie, siteUrl).recipeInstructions).toEqual([
				{ '@type': 'HowToStep', text: 'Heat the oven to 350°F.' },
				{
					'@type': 'HowToSection',
					name: 'For the filling',
					itemListElement: [{ '@type': 'HowToStep', text: 'Whisk the filling until smooth.' }],
				},
			]);
		});
	});
});

describe('RecipeJsonLd', () => {
	it('escapes < so recipe text cannot close the script element', () => {
		const description = 'Crisp edges </script><script>alert(1)</script>';
		const soup = publicRecipe('weeknight-chicken-soup', { ...sampleChickenSoup, description });

		const markup = renderToStaticMarkup(createElement(RecipeJsonLd, { recipe: soup, siteUrl }));
		const json = markup
			.replace(/^<script type="application\/ld\+json">/, '')
			.replace(/<\/script>$/, '');

		expect(json).not.toContain('<');
		expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(toRecipeJsonLd(soup, siteUrl))));
		expect(JSON.parse(json).description).toBe(description);
	});
});
