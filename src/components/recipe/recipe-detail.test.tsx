import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { publicRecipe } from '@/application/testing/public-recipes';
import { RecipeDetail } from '@/components/recipe/recipe-detail';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { sampleChickenSoup } from '@/domain/recipe/samples/sample-recipes';

const dishPhoto: RecipeImage = { role: 'dish', pathname: 'dish/seed/soup.jpg' };
const cardFront: RecipeImage = { role: 'scan', pathname: 'scan/seed/soup-card-front.jpg' };
const cardBack: RecipeImage = { role: 'scan', pathname: 'scan/seed/soup-card-back.jpg' };

function soupWith(images: RecipeImage[]): PublicRecipeDto {
	return publicRecipe('weeknight-chicken-soup', { ...sampleChickenSoup, images });
}

describe('RecipeDetail’s original recipe', () => {
	it('shows the scans in a section of their own, which the byline links to', () => {
		render(<RecipeDetail recipe={soupWith([cardFront, dishPhoto, cardBack])} headingLevel={1} />);

		const heading = screen.getByRole('heading', { level: 2, name: 'Original recipe' });
		const link = screen.getByRole('link', { name: 'See the original' });
		const target = document.getElementById(link.getAttribute('href')?.slice(1) ?? '');
		expect(target?.contains(heading)).toBe(true);
		expect(
			within(target ?? document.body)
				.getAllByRole('button')
				.map((button) => button.getAttribute('aria-label'))
		).toEqual(['View page 1 of 2', 'View page 2 of 2']);
		// Through the image optimizer, so a phone downloads a thumbnail's size rather than the scan.
		expect(
			Array.from(target?.querySelectorAll('img') ?? [], (image) => image.getAttribute('src'))
		).toEqual([
			expect.stringMatching(/^\/_next\/image\?url=%2Fapi%2Fimages%2Fscan%2Fseed%2Fsoup-card-front/),
			expect.stringMatching(/^\/_next\/image\?url=%2Fapi%2Fimages%2Fscan%2Fseed%2Fsoup-card-back/),
		]);
		// The dish photo alone is the cover.
		expect(screen.getByRole('button', { name: 'View photo' })).toBeDefined();
	});

	it('shows neither the section nor the link without scans', () => {
		render(<RecipeDetail recipe={soupWith([dishPhoto])} headingLevel={1} />);

		expect(screen.queryByRole('heading', { name: 'Original recipe' })).toBeNull();
		expect(screen.queryByRole('link', { name: 'See the original' })).toBeNull();
	});

	it('opens a page in the viewer, which links to it at full size', async () => {
		const user = userEvent.setup();
		render(<RecipeDetail recipe={soupWith([cardFront, cardBack])} headingLevel={1} />);

		await user.click(screen.getByRole('button', { name: 'View page 2 of 2' }));

		const viewer = await screen.findByRole('dialog', { name: 'Original recipe' });
		expect(
			within(viewer)
				.getByRole('link', { name: 'Full size, opens in a new tab' })
				.getAttribute('href')
		).toBe(`/api/images/${cardBack.pathname}`);
	});

	it('gives a dish photo’s viewer no Full size', async () => {
		const user = userEvent.setup();
		render(<RecipeDetail recipe={soupWith([dishPhoto])} headingLevel={1} />);

		await user.click(screen.getByRole('button', { name: 'View photo' }));

		const viewer = await screen.findByRole('dialog');
		expect(within(viewer).queryByRole('link', { name: /^Full size/ })).toBeNull();
	});
});

describe('RecipeDetail’s byline', () => {
	it('links a source written as a web address once, by its host', () => {
		render(
			<RecipeDetail
				recipe={publicRecipe('weeknight-chicken-soup', {
					...sampleChickenSoup,
					source: 'https://example.com/soup',
				})}
				headingLevel={1}
			/>
		);

		const link = screen.getByRole('link', { name: 'example.com' });
		expect(link.getAttribute('href')).toBe('https://example.com/soup');
		expect(link.closest('p')?.textContent).toBe('From example.com');
		expect(screen.queryByText(/Imported from/)).toBeNull();
	});

	it('names a source that is not a web address as written', () => {
		render(
			<RecipeDetail
				recipe={publicRecipe('weeknight-chicken-soup', {
					...sampleChickenSoup,
					source: 'Aunt June',
				})}
				headingLevel={1}
			/>
		);

		expect(screen.getByText('From Aunt June')).toBeDefined();
		expect(screen.queryByRole('link', { name: /example|Aunt June/ })).toBeNull();
	});
});
