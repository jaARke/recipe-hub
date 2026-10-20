import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import { RecipeCard } from '@/components/recipe/recipe-card';
import { recipeIdSchema } from '@/domain/recipe/recipe';

// Filed in Cookies & Candy for Christmas, vegetarian, with no photo.
function cookies(changes: Partial<RecipeSummaryDto> = {}): RecipeSummaryDto {
	return {
		id: recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-000000000006'),
		slug: 'molasses-spice-cookies',
		title: 'Molasses spice cookies',
		chapter: 'cookies-candy',
		holidays: ['christmas'],
		diets: ['vegetarian'],
		createdAt: new Date('2026-10-01T12:00:00.000Z'),
		...changes,
	};
}

function renderCard(recipe: RecipeSummaryDto) {
	return render(<RecipeCard recipe={recipe} headingTag="h2" photoSizes="100vw" />);
}

describe('RecipeCard', () => {
	it('shows the recipe’s holidays, then its diets, as badges', async () => {
		await renderCard(
			cookies({ holidays: ['easter', 'christmas'], diets: ['vegetarian', 'vegan'] })
		);

		expect(
			page
				.getByRole('listitem')
				.elements()
				.map((item) => item.textContent)
		).toEqual(['Easter', 'Christmas', 'Vegetarian', 'Vegan']);
	});

	it('is one link to the recipe, so its badges are not links', async () => {
		await renderCard(cookies());

		await expect.element(page.getByText('Christmas')).toBeVisible();
		expect(page.getByRole('link').elements()).toHaveLength(1);
		await expect
			.element(page.getByRole('link', { name: 'Molasses spice cookies' }))
			.toHaveAttribute('href', '/recipes/molasses-spice-cookies');
	});

	it('shows no badges for a recipe with no holiday or diet', async () => {
		await renderCard(cookies({ holidays: [], diets: [] }));

		await expect
			.element(page.getByRole('heading', { name: 'Molasses spice cookies' }))
			.toBeVisible();
		await expect.element(page.getByRole('list')).not.toBeInTheDocument();
	});
});
