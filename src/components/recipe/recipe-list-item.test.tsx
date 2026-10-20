import { describe, expect, it, onTestFinished } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { RecipeSummaryDto } from '@/application/recipes/recipe-dtos';
import { RecipeListItem, type RecipeHighlights } from '@/components/recipe/recipe-list-item';
import { Card } from '@/components/ui/card';
import { recipeIdSchema } from '@/domain/recipe/recipe';

// Tailwind's sm breakpoint, from which an item is a card.
const smViewport = { width: 640, height: 844 };

// Filed in Cookies & Candy for Christmas, vegetarian, from Great-aunt Edie, with a photo.
function cookies(changes: Partial<RecipeSummaryDto> = {}): RecipeSummaryDto {
	return {
		id: recipeIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-000000000006'),
		slug: 'molasses-spice-cookies',
		title: 'Molasses spice cookies',
		source: 'Great-aunt Edie',
		chapter: 'cookies-candy',
		holidays: ['christmas'],
		diets: ['vegetarian'],
		coverImage: { role: 'dish', pathname: 'dish/seed/molasses-spice-cookies.jpg' },
		createdAt: new Date('2026-10-01T12:00:00.000Z'),
		...changes,
	};
}

// What a search for "molasses" found in the cookies.
const molassesHighlights: RecipeHighlights = {
	title: [
		{ text: 'Molasses', highlighted: true },
		{ text: ' spice cookies', highlighted: false },
	],
	snippet: [
		{ text: '¼ cup ', highlighted: false },
		{ text: 'molasses', highlighted: true },
		{ text: ', warmed', highlighted: false },
	],
};

function renderItem({
	recipe = cookies(),
	highlights,
	namesChapter = true,
}: {
	recipe?: RecipeSummaryDto;
	highlights?: RecipeHighlights;
	namesChapter?: boolean;
} = {}) {
	return render(
		<RecipeListItem
			recipe={recipe}
			highlights={highlights}
			namesChapter={namesChapter}
			headingTag="h3"
			cardPhotoSizes="(min-width: 640px) 50vw"
		/>
	);
}

function item() {
	return page.getByRole('link', { name: 'Molasses spice cookies' });
}

function title() {
	return page.getByRole('heading', { name: 'Molasses spice cookies', level: 3 });
}

function photo(): HTMLImageElement {
	const image = item().element().querySelector('img');
	if (image === null) {
		throw new Error('The item shows no photo');
	}
	return image;
}

function markedText(): (string | null)[] {
	return Array.from(item().element().querySelectorAll('mark'), (mark) => mark.textContent);
}

describe('RecipeListItem', () => {
	it('is one link to the recipe, named by its title, so its badges are not links', async () => {
		await renderItem();

		await expect.element(title()).toBeVisible();
		await expect.element(page.getByText('Christmas')).toBeVisible();
		expect(page.getByRole('link').elements()).toHaveLength(1);
		await expect.element(item()).toHaveAttribute('href', '/recipes/molasses-spice-cookies');
	});

	it('shows the recipe’s holidays, then its diets, as badges', async () => {
		await renderItem({
			recipe: cookies({ holidays: ['easter', 'christmas'], diets: ['vegetarian', 'vegan'] }),
		});

		expect(
			page
				.getByRole('listitem')
				.elements()
				.map((badge) => badge.textContent)
		).toEqual(['Easter', 'Christmas', 'Vegetarian', 'Vegan']);
	});

	it('shows no badges for a recipe with no holiday or diet', async () => {
		await renderItem({ recipe: cookies({ holidays: [], diets: [] }) });

		await expect.element(title()).toBeVisible();
		await expect.element(page.getByRole('list')).not.toBeInTheDocument();
	});

	it('names its chapter above the title outside a chapter, which the link describes', async () => {
		await renderItem();

		const chapter = page.getByText('Cookies & Candy');
		await expect.element(chapter).toBeVisible();
		expect(chapter.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(
			title().element().getBoundingClientRect().top
		);
		await expect
			.element(item())
			.toHaveAccessibleDescription(/^Cookies & Candy From Great-aunt Edie/);
	});

	it('names no chapter within one', async () => {
		await renderItem({ namesChapter: false });

		await expect.element(title()).toBeVisible();
		await expect.element(page.getByText('Cookies & Candy')).not.toBeInTheDocument();
		await expect.element(item()).toHaveAccessibleDescription(/^From Great-aunt Edie/);
	});

	it('marks the words in its title and in the passage they matched', async () => {
		await renderItem({ highlights: molassesHighlights });

		await expect.element(title()).toBeVisible();
		await expect.element(page.getByText('¼ cup molasses, warmed')).toBeVisible();
		expect(markedText()).toEqual(['Molasses', 'molasses']);
		await expect.element(item()).toHaveAccessibleDescription(/¼ cup molasses, warmed/);
	});

	it('marks nothing without words', async () => {
		await renderItem();

		await expect.element(title()).toBeVisible();
		expect(markedText()).toEqual([]);
	});

	it('is a row below sm, its small photo beside the words, and a card from sm, its photo above them', async () => {
		await renderItem();

		await expect.element(title()).toBeVisible();
		expect(photo().getBoundingClientRect().width).toBe(112);
		expect(photo().getBoundingClientRect().right).toBeLessThanOrEqual(
			title().element().getBoundingClientRect().left
		);
		expect(photo().getAttribute('sizes')).toBe('(min-width: 640px) 50vw, 112px');

		await page.viewport(smViewport.width, smViewport.height);

		await expect
			.poll(() => photo().getBoundingClientRect().width)
			.toBe(item().element().getBoundingClientRect().width);
		expect(photo().getBoundingClientRect().bottom).toBeLessThanOrEqual(
			title().element().getBoundingClientRect().top
		);
	});

	it('brightens its edge to the text’s color when hovered, as the dark theme dims it', async () => {
		document.documentElement.classList.add('dark');
		onTestFinished(() => {
			document.documentElement.classList.remove('dark');
		});
		await renderItem();
		const card = item().element().querySelector<HTMLElement>('[data-slot="card"]');
		if (card === null) {
			throw new Error('The item has no card');
		}
		// The edge lands at once, since this checks where it lands, not how it moves: WebKit on CI can
		// go a second without a frame, which left the poll reading a color halfway there.
		card.style.transition = 'none';
		// Cards with the dimmed edge and inked in the text's color, read in this browser, so the check
		// holds however it writes the shadow's colors, and wherever an earlier test left the pointer.
		const { container } = await render(
			<>
				<Card />
				<Card className="ring-foreground" />
			</>
		);
		const [dimmed, inked] = container.querySelectorAll('[data-slot="card"]');
		if (dimmed === undefined || inked === undefined) {
			throw new Error('The references have no cards');
		}
		const textEdge = getComputedStyle(inked).boxShadow;
		expect(textEdge).not.toBe(getComputedStyle(dimmed).boxShadow);

		await item().hover();

		await expect.poll(() => getComputedStyle(card).boxShadow).toBe(textEdge);
	});
});
