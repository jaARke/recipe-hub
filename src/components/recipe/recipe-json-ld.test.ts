import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { RecipeJsonLd, toRecipeJsonLd } from '@/components/recipe/recipe-json-ld';
import {
	parseRecipeContent,
	recipeIdSchema,
	type RecipeContentInput,
} from '@/domain/recipe/recipe';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
	sampleLemonIceboxPie,
	sampleTomatoSalad,
} from '@/domain/recipe/samples/sample-recipes';

const siteUrl = new URL('https://recipes.example.com');

function publicRecipe(slug: string, content: RecipeContentInput): PublicRecipeDto {
	return {
		...parseRecipeContent(content),
		id: recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e'),
		slug,
		createdAt: new Date('2026-10-01T12:00:00.000Z'),
		updatedAt: new Date('2026-10-05T08:30:00.000Z'),
	};
}

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
			recipeYield: 'Serves 6',
			keywords: 'Soup, Weeknight',
		});
	});

	it('leaves out the image when the recipe has no dish photo', () => {
		const salad = publicRecipe('garden-tomato-salad', { ...sampleTomatoSalad, images: [] });

		expect(toRecipeJsonLd(salad, siteUrl).image).toBeUndefined();
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

	it('writes the yield the way the page does', () => {
		const biscuits = publicRecipe('buttermilk-biscuits', sampleButtermilkBiscuits);

		expect(toRecipeJsonLd(biscuits, siteUrl).recipeYield).toBe('Makes 10 biscuits');
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
