import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, type Locator } from 'vitest/browser';
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
	if (definition === null) {
		return '';
	}
	const items = page.elementLocator(definition).getByRole('listitem').elements();
	return items.length === 0
		? (definition.textContent ?? '')
		: items.map((item) => item.textContent).join(', ');
}

// Each row of the header's ruled block, its cells as "label: value".
function ruledRows(): string[][] {
	return Array.from(document.querySelectorAll('header dl'), (row) =>
		page
			.elementLocator(row)
			.getByRole('term')
			.elements()
			.map((term) => `${term.textContent}: ${cellText(term.nextElementSibling)}`)
	);
}

describe('RecipeDetail’s ruled block', () => {
	it('holds a row each for the times and yield, who added the recipe and when, and its tags', async () => {
		await render(<RecipeDetail recipe={soup()} headingLevel={1} />);

		expect(ruledRows()).toEqual([
			['Prep: 15 min', 'Cook: 35 min', 'Total: 50 min', 'Serves: 6'],
			['Added by: Ada', 'Added: October 1, 2026', 'Edited: October 5, 2026'],
			['Tags: Soup, Weeknight'],
		]);
		await expect.element(page.getByRole('link', { name: 'Soup' })).toBeInTheDocument();
	});

	it('labels what a recipe makes by its verb', async () => {
		await render(
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

	it('leaves out a cell or a row with nothing to show', async () => {
		const { rerender } = await render(
			<RecipeDetail
				recipe={soup({ times: { cookMinutes: 90 }, yield: undefined })}
				headingLevel={1}
			/>
		);

		expect(ruledRows()[0]).toEqual(['Cook: 1 hr 30 min', 'Total: 1 hr 30 min']);

		await rerender(
			<RecipeDetail recipe={soup({ times: {}, yield: undefined, tags: [] })} headingLevel={1} />
		);

		expect(ruledRows()).toEqual([
			['Added by: Ada', 'Added: October 1, 2026', 'Edited: October 5, 2026'],
		]);
	});

	it('shows no edit made the day the recipe was added, as the site’s time zone counts days', async () => {
		const createdAt = new Date('2026-10-12T14:00:00.000Z');
		// 11:30 PM on October 12 in New York.
		const { rerender } = await render(
			<RecipeDetail
				recipe={soup({ createdAt, updatedAt: new Date('2026-10-13T03:30:00.000Z') })}
				headingLevel={1}
			/>
		);

		expect(ruledRows()[1]).toEqual(['Added by: Ada', 'Added: October 12, 2026']);

		// 12:30 AM on October 13 in New York.
		await rerender(
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
	it('names a source that is not a web address as written', async () => {
		await render(<RecipeDetail recipe={soup({ source: 'Aunt June' })} headingLevel={1} />);

		await expect.element(page.getByText('From Aunt June')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: /example|Aunt June/ }))
			.not.toBeInTheDocument();
	});

	it('links a source written as a web address once, by its host', async () => {
		await render(
			<RecipeDetail
				recipe={publicRecipe('weeknight-chicken-soup', {
					...sampleChickenSoup,
					source: 'https://example.com/soup',
				})}
				headingLevel={1}
			/>
		);

		await expect
			.element(page.getByText('From example.com').getByRole('link', { name: 'example.com' }))
			.toHaveAttribute('href', 'https://example.com/soup');
	});

	it('adds the host of the page an import read after a named source', async () => {
		await render(
			<RecipeDetail
				recipe={soup({
					source: 'Grandma’s cookbook',
					sourceUrl: 'https://www.example.com/soup',
				})}
				headingLevel={1}
			/>
		);

		const link = page
			.getByText('From Grandma’s cookbook (www.example.com)')
			.getByRole('link', { name: 'www.example.com' });
		await expect.element(link).toHaveAttribute('href', 'https://www.example.com/soup');
		await expect.element(link).toHaveAttribute('rel', 'nofollow noopener noreferrer');
	});

	it('names an import with no source by its host', async () => {
		await render(
			<RecipeDetail
				recipe={soup({ source: undefined, sourceUrl: 'https://example.com/soup' })}
				headingLevel={1}
			/>
		);

		await expect
			.element(page.getByText('From example.com').getByRole('link', { name: 'example.com' }))
			.toHaveAttribute('href', 'https://example.com/soup');
	});

	it('shows no credit without a source', async () => {
		await render(<RecipeDetail recipe={soup({ source: undefined })} headingLevel={1} />);

		await expect.element(page.getByText(/^From /)).not.toBeInTheDocument();
	});
});

// The shape an image's box is laid out in, its width over its height.
function shapeOf(trigger: Locator): number {
	const { width, height } = trigger.element().getBoundingClientRect();
	return width / height;
}

function sizesOf(trigger: Locator): string | null | undefined {
	return trigger.element().querySelector('img')?.getAttribute('sizes');
}

// How the image fills its box, as the browser draws it.
function fitOf(trigger: Locator): string | undefined {
	const image = trigger.element().querySelector('img');
	return image === null ? undefined : getComputedStyle(image).objectFit;
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

	it('lays each photo in a row out in its own shape, fetched as wide as the row’s height makes it', async () => {
		await render(<RecipeDetail recipe={soupWith([wideSoup, squarerSoup])} headingLevel={1} />);

		const photos = page.getByRole('button', { name: /^View photo/ }).all();
		expect(photos.map(shapeOf)).toEqual([expect.closeTo(1600 / 1066), expect.closeTo(1600 / 1200)]);
		// 320 and 240 tall, from sm and on phones, and no wider than 82% of the column.
		expect(photos.map(sizesOf)).toEqual([
			'(min-width: 640px) min(481px, 512px), min(361px, 82vw)',
			'(min-width: 640px) min(427px, 512px), min(320px, 82vw)',
		]);
	});

	it('gives a photo stored before sizes a 3:2 box, and shows it whole in it', async () => {
		await render(<RecipeDetail recipe={soupWith([dishPhoto, wideSoup])} headingLevel={1} />);

		const unsized = page.getByRole('button', { name: 'View photo 1 of 2' });
		const sized = page.getByRole('button', { name: 'View photo 2 of 2' });
		expect(shapeOf(unsized)).toBeCloseTo(3 / 2);
		expect(sizesOf(unsized)).toBe('(min-width: 640px) min(480px, 512px), min(360px, 82vw)');
		expect([fitOf(unsized), fitOf(sized)]).toEqual(['contain', 'cover']);
	});

	it('shows a lone photo across the column, fetched no wider than its shape allows at its tallest', async () => {
		await render(<RecipeDetail recipe={soupWith([wideSoup])} headingLevel={1} />);

		const photo = page.getByRole('button', { name: 'View photo' });
		expect(photo.element().getBoundingClientRect().width).toBe(
			page.getByRole('article').element().getBoundingClientRect().width
		);
		expect(shapeOf(photo)).toBeCloseTo(1600 / 1066);
		// At most 576 tall, so 865 wide, within the 624px column.
		expect(sizesOf(photo)).toBe('(min-width: 672px) min(624px, 865px), min(100vw, 865px)');
	});

	it('shows the original’s pages in a lower row', async () => {
		const card = { ...cardFront, size: { width: 1600, height: 908 } };
		await render(<RecipeDetail recipe={soupWith([card, cardBack])} headingLevel={1} />);

		const sized = page.getByRole('button', { name: 'View page 1 of 2' });
		const unsized = page.getByRole('button', { name: 'View page 2 of 2' });
		// 288 and 208 tall, from sm and on phones.
		expect(sizesOf(sized)).toBe('(min-width: 640px) min(508px, 512px), min(367px, 82vw)');
		// The 3:2 page fits the column at the row's full height, where a dish photo's row is 240.
		expect(unsized.element().getBoundingClientRect().height).toBeCloseTo(208, 1);
	});
});

describe('RecipeDetail’s original recipe', () => {
	it('shows the scans with their page count before the ingredients', async () => {
		await render(
			<RecipeDetail recipe={soupWith([cardFront, dishPhoto, cardBack])} headingLevel={1} />
		);

		const heading = page.getByRole('heading', { level: 2, name: 'Original recipe' });
		await expect.element(page.getByText('2 pages')).toBeInTheDocument();
		const pages = page.getByRole('button', { name: /^View page/ }).elements();
		expect(pages.map((scan) => scan.getAttribute('aria-label'))).toEqual([
			'View page 1 of 2',
			'View page 2 of 2',
		]);
		// Through the image optimizer, so a phone downloads a thumbnail's size rather than the scan.
		expect(pages.map((scan) => scan.querySelector('img')?.getAttribute('src'))).toEqual([
			expect.stringMatching(/^\/_next\/image\?url=%2Fapi%2Fimages%2Fscan%2Fseed%2Fsoup-card-front/),
			expect.stringMatching(/^\/_next\/image\?url=%2Fapi%2Fimages%2Fscan%2Fseed%2Fsoup-card-back/),
		]);
		const ingredients = page.getByRole('heading', { level: 2, name: 'Ingredients' });
		expect(heading.element().compareDocumentPosition(ingredients.element())).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
		// The dish photo alone is the cover.
		await expect.element(page.getByRole('button', { name: 'View photo' })).toBeInTheDocument();
	});

	it('counts a single page', async () => {
		await render(<RecipeDetail recipe={soupWith([cardFront])} headingLevel={1} />);

		await expect.element(page.getByText('1 page')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'View page' })).toBeInTheDocument();
	});

	it('shows no section without scans', async () => {
		await render(<RecipeDetail recipe={soupWith([dishPhoto])} headingLevel={1} />);

		await expect
			.element(page.getByRole('heading', { name: 'Original recipe' }))
			.not.toBeInTheDocument();
	});

	it('opens a page in the viewer, which links to it at full size', async () => {
		await render(<RecipeDetail recipe={soupWith([cardFront, cardBack])} headingLevel={1} />);

		await page.getByRole('button', { name: 'View page 2 of 2' }).click();

		// The viewer's body loads as it opens.
		await expect
			.element(
				page
					.getByRole('dialog', { name: 'Original recipe' })
					.getByRole('link', { name: 'Full size, opens in a new tab' })
			)
			.toHaveAttribute('href', `/api/images/${cardBack.pathname}`);
	});

	it('gives a dish photo’s viewer no Full size', async () => {
		await render(<RecipeDetail recipe={soupWith([dishPhoto])} headingLevel={1} />);

		await page.getByRole('button', { name: 'View photo' }).click();

		const viewer = page.getByRole('dialog');
		await expect.element(viewer.getByRole('region', { name: 'Photos' })).toBeInTheDocument();
		await expect.element(viewer.getByRole('link', { name: /^Full size/ })).not.toBeInTheDocument();
	});
});
