import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import type { RecipeSearchResultDto } from '@/application/search/recipe-search-dtos';
import { RecipeSearchResult } from '@/components/search/recipe-search-result';
import { recipeIdSchema } from '@/domain/recipe/recipe';

// Found by "molasses", filed in Cookies & Candy for Christmas, vegetarian, and still carrying a free
// tag, with no photo.
function cookies(changes: Partial<RecipeSummaryDto> = {}): RecipeSearchResultDto {
	return {
		recipe: {
			id: recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-000000000006'),
			slug: 'molasses-spice-cookies',
			title: 'Molasses spice cookies',
			chapter: 'cookies-candy',
			holidays: ['christmas'],
			diets: ['vegetarian'],
			tags: ['Baking'],
			createdAt: new Date('2026-10-01T12:00:00.000Z'),
			...changes,
		},
		title: [
			{ text: 'Molasses', highlighted: true },
			{ text: ' spice cookies', highlighted: false },
		],
	};
}

function renderResult(result: RecipeSearchResultDto) {
	return render(<RecipeSearchResult result={result} headingTag="h3" />);
}

describe('RecipeSearchResult', () => {
	it('shows the recipe’s holidays, then its diets, as badges, and no tags', async () => {
		await renderResult(cookies({ holidays: ['easter', 'christmas'], diets: ['gluten-free'] }));

		expect(
			page
				.getByRole('listitem')
				.elements()
				.map((item) => item.textContent)
		).toEqual(['Easter', 'Christmas', 'Gluten-free']);
		await expect.element(page.getByText('Baking')).not.toBeInTheDocument();
	});

	it('is one link to the recipe, so its badges are not links', async () => {
		await renderResult(cookies());

		await expect.element(page.getByText('Christmas')).toBeVisible();
		expect(page.getByRole('link').elements()).toHaveLength(1);
		await expect
			.element(page.getByRole('link', { name: 'Molasses spice cookies' }))
			.toHaveAttribute('href', '/recipes/molasses-spice-cookies');
	});

	it('shows no badges for a recipe with no holiday or diet', async () => {
		await renderResult(cookies({ holidays: [], diets: [] }));

		await expect
			.element(page.getByRole('heading', { name: 'Molasses spice cookies' }))
			.toBeVisible();
		await expect.element(page.getByRole('list')).not.toBeInTheDocument();
	});
});
