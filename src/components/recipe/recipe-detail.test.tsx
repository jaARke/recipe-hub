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

// The box an image is laid out in takes its shape from --image-ratio.
function imageRatio(trigger: HTMLElement): string | undefined {
	return trigger.parentElement?.style.getPropertyValue('--image-ratio');
}

function imageSizes(trigger: HTMLElement): string | null | undefined {
	return trigger.querySelector('img')?.getAttribute('sizes');
}

describe('RecipeDetail’s filmstrips', () => {
	const wideSoup: RecipeImage = {
		role: 'dish',
		pathname: 'dish/seed/soup-wide.jpg',
		size: { width: 1600, height: 1066 },
	};
	const squarerSoup: RecipeImage = {
		role: 'dish',
		pathname: 'dish/seed/soup-squarer.jpg',
		size: { width: 1600, height: 1200 },
	};

	it('lays each photo in a row out in its own shape, fetched as wide as the row’s height makes it', () => {
		render(<RecipeDetail recipe={soupWith([wideSoup, squarerSoup])} headingLevel={1} />);

		const photos = screen.getAllByRole('button', { name: /^View photo/ });
		expect(photos.map(imageRatio)).toEqual(['1600 / 1066', '1600 / 1200']);
		// 320 and 240 tall, from sm and on phones, and no wider than 82% of the column.
		expect(photos.map(imageSizes)).toEqual([
			'(min-width: 640px) min(481px, 512px), min(361px, 82vw)',
			'(min-width: 640px) min(427px, 512px), min(320px, 82vw)',
		]);
	});

	it('gives a photo stored before sizes a 3:2 box, and shows it whole in it', () => {
		render(<RecipeDetail recipe={soupWith([dishPhoto, wideSoup])} headingLevel={1} />);

		const [unsized, sized] = screen.getAllByRole('button', { name: /^View photo/ });
		expect(unsized && imageRatio(unsized)).toBe('3 / 2');
		expect(unsized && imageSizes(unsized)).toBe(
			'(min-width: 640px) min(480px, 512px), min(360px, 82vw)'
		);
		expect(unsized?.querySelector('img')?.classList.contains('object-contain')).toBe(true);
		expect(sized?.querySelector('img')?.classList.contains('object-cover')).toBe(true);
	});

	it('shows a lone photo across the column, fetched no wider than its shape allows at its tallest', () => {
		render(<RecipeDetail recipe={soupWith([wideSoup])} headingLevel={1} />);

		const photo = screen.getByRole('button', { name: 'View photo' });
		expect(imageRatio(photo)).toBe('1600 / 1066');
		// At most 576 tall, so 865 wide, within the 624px column.
		expect(imageSizes(photo)).toBe('(min-width: 672px) min(624px, 865px), min(100vw, 865px)');
	});

	it('shows the original’s pages in a lower row', () => {
		const card = { ...cardFront, size: { width: 1600, height: 908 } };
		render(<RecipeDetail recipe={soupWith([card, cardBack])} headingLevel={1} />);

		const [page] = screen.getAllByRole('button', { name: /^View page/ });
		// 288 and 208 tall, from sm and on phones.
		expect(page && imageSizes(page)).toBe('(min-width: 640px) min(508px, 512px), min(367px, 82vw)');
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
		// The viewer's body loads as it opens.
		const fullSize = await within(viewer).findByRole('link', {
			name: 'Full size, opens in a new tab',
		});
		expect(fullSize.getAttribute('href')).toBe(`/api/images/${cardBack.pathname}`);
	});

	it('gives a dish photo’s viewer no Full size', async () => {
		const user = userEvent.setup();
		render(<RecipeDetail recipe={soupWith([dishPhoto])} headingLevel={1} />);

		await user.click(screen.getByRole('button', { name: 'View photo' }));

		const viewer = await screen.findByRole('dialog');
		await within(viewer).findByRole('region', { name: 'Photos' });
		expect(within(viewer).queryByRole('link', { name: /^Full size/ })).toBeNull();
	});
});
