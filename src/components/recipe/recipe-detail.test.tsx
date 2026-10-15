import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { publicRecipe } from '@/application/testing/public-recipes';
import { RecipeDetail } from '@/components/recipe/recipe-detail';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import {
	sampleButtermilkBiscuits,
	sampleChickenSoup,
} from '@/domain/recipe/samples/sample-recipes';

const dishPhoto: RecipeImage = { role: 'dish', pathname: 'dish/seed/soup.jpg' };
const cardFront: RecipeImage = { role: 'scan', pathname: 'scan/seed/soup-card-front.jpg' };
const cardBack: RecipeImage = { role: 'scan', pathname: 'scan/seed/soup-card-back.jpg' };

// Added on 1 October 2026 and edited four days later, as publicRecipe gives it.
function soup(changes: Partial<PublicRecipeDto> = {}): PublicRecipeDto {
	return { ...publicRecipe('weeknight-chicken-soup', sampleChickenSoup), ...changes };
}

function soupWith(images: RecipeImage[]): PublicRecipeDto {
	return publicRecipe('weeknight-chicken-soup', { ...sampleChickenSoup, images });
}

// A cell's value as read, a list's items parted by commas.
function cellText(definition: Element | null): string {
	const items = definition?.querySelectorAll('li') ?? [];
	return items.length === 0
		? (definition?.textContent ?? '')
		: Array.from(items, (item) => item.textContent).join(', ');
}

// Each row of the header's ruled block, its cells as "label: value".
function ruledRows(): string[][] {
	return Array.from(document.querySelectorAll<HTMLElement>('header dl'), (row) =>
		within(row)
			.getAllByRole('term')
			.map((term) => `${term.textContent}: ${cellText(term.nextElementSibling)}`)
	);
}

describe('RecipeDetail’s ruled block', () => {
	it('holds a row each for the times and yield, who added the recipe and when, and its tags', () => {
		render(<RecipeDetail recipe={soup()} headingLevel={1} />);

		expect(ruledRows()).toEqual([
			['Prep: 15 min', 'Cook: 35 min', 'Total: 50 min', 'Serves: 6'],
			['Added by: Ada', 'Added: October 1, 2026', 'Edited: October 5, 2026'],
			['Tags: Soup, Weeknight'],
		]);
		expect(screen.getByRole('link', { name: 'Soup' })).toBeDefined();
	});

	it('labels what a recipe makes by its verb', () => {
		render(
			<RecipeDetail
				recipe={publicRecipe('buttermilk-biscuits', sampleButtermilkBiscuits)}
				headingLevel={1}
			/>
		);

		expect(ruledRows()[0]).toEqual([
			'Prep: 15 min',
			'Cook: 18 min',
			'Total: 35 min',
			'Makes: 10 biscuits',
		]);
	});

	it('leaves out a cell or a row with nothing to show', () => {
		const { rerender } = render(
			<RecipeDetail
				recipe={soup({ times: { cookMinutes: 90 }, yield: undefined })}
				headingLevel={1}
			/>
		);

		expect(ruledRows()[0]).toEqual(['Cook: 1 hr 30 min', 'Total: 1 hr 30 min']);

		rerender(
			<RecipeDetail recipe={soup({ times: {}, yield: undefined, tags: [] })} headingLevel={1} />
		);

		expect(ruledRows()).toEqual([
			['Added by: Ada', 'Added: October 1, 2026', 'Edited: October 5, 2026'],
		]);
	});

	it('shows no edit made the day the recipe was added, as the site’s time zone counts days', () => {
		const createdAt = new Date('2026-10-12T14:00:00.000Z');
		// 11:30 PM on October 12 in New York.
		const { rerender } = render(
			<RecipeDetail
				recipe={soup({ createdAt, updatedAt: new Date('2026-10-13T03:30:00.000Z') })}
				headingLevel={1}
			/>
		);

		expect(ruledRows()[1]).toEqual(['Added by: Ada', 'Added: October 12, 2026']);

		// 12:30 AM on October 13 in New York.
		rerender(
			<RecipeDetail
				recipe={soup({ createdAt, updatedAt: new Date('2026-10-13T04:30:00.000Z') })}
				headingLevel={1}
			/>
		);

		expect(ruledRows()[1]).toEqual([
			'Added by: Ada',
			'Added: October 12, 2026',
			'Edited: October 13, 2026',
		]);
	});
});

describe('RecipeDetail’s credit', () => {
	it('names a source that is not a web address as written', () => {
		render(<RecipeDetail recipe={soup({ source: 'Aunt June' })} headingLevel={1} />);

		expect(screen.getByText('From Aunt June')).toBeDefined();
		expect(screen.queryByRole('link', { name: /example|Aunt June/ })).toBeNull();
	});

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
	});

	it('adds the host of the page an import read after a named source', () => {
		render(
			<RecipeDetail
				recipe={soup({
					source: 'Grandma’s cookbook',
					sourceUrl: 'https://www.example.com/soup',
				})}
				headingLevel={1}
			/>
		);

		const link = screen.getByRole('link', { name: 'www.example.com' });
		expect(link.getAttribute('href')).toBe('https://www.example.com/soup');
		expect(link.getAttribute('rel')).toBe('nofollow noopener noreferrer');
		expect(link.closest('p')?.textContent).toBe('From Grandma’s cookbook (www.example.com)');
	});

	it('names an import with no source by its host', () => {
		render(
			<RecipeDetail
				recipe={soup({ source: undefined, sourceUrl: 'https://example.com/soup' })}
				headingLevel={1}
			/>
		);

		expect(screen.getByRole('link', { name: 'example.com' }).closest('p')?.textContent).toBe(
			'From example.com'
		);
	});

	it('shows no credit without a source', () => {
		render(<RecipeDetail recipe={soup({ source: undefined })} headingLevel={1} />);

		expect(screen.queryByText(/^From /)).toBeNull();
	});
});

describe('RecipeDetail’s original recipe', () => {
	it('shows the scans with their page count before the ingredients', () => {
		render(<RecipeDetail recipe={soupWith([cardFront, dishPhoto, cardBack])} headingLevel={1} />);

		const heading = screen.getByRole('heading', { level: 2, name: 'Original recipe' });
		expect(screen.getByText('2 pages')).toBeDefined();
		const pages = screen.getAllByRole('button', { name: /^View page/ });
		expect(pages.map((page) => page.getAttribute('aria-label'))).toEqual([
			'View page 1 of 2',
			'View page 2 of 2',
		]);
		// Through the image optimizer, so a phone downloads a thumbnail's size rather than the scan.
		expect(pages.map((page) => page.querySelector('img')?.getAttribute('src'))).toEqual([
			expect.stringMatching(/^\/_next\/image\?url=%2Fapi%2Fimages%2Fscan%2Fseed%2Fsoup-card-front/),
			expect.stringMatching(/^\/_next\/image\?url=%2Fapi%2Fimages%2Fscan%2Fseed%2Fsoup-card-back/),
		]);
		const ingredients = screen.getByRole('heading', { level: 2, name: 'Ingredients' });
		expect(heading.compareDocumentPosition(ingredients)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		// The dish photo alone is the cover.
		expect(screen.getByRole('button', { name: 'View photo' })).toBeDefined();
	});

	it('counts a single page', () => {
		render(<RecipeDetail recipe={soupWith([cardFront])} headingLevel={1} />);

		expect(screen.getByText('1 page')).toBeDefined();
		expect(screen.getByRole('button', { name: 'View page' })).toBeDefined();
	});

	it('shows no section without scans', () => {
		render(<RecipeDetail recipe={soupWith([dishPhoto])} headingLevel={1} />);

		expect(screen.queryByRole('heading', { name: 'Original recipe' })).toBeNull();
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
