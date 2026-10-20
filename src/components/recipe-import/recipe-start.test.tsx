import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { SavedDraftId } from '@/application/drafts/saved-draft';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import { renderVisitedPage } from '@/components/forms/testing/kept-page';
import { RecipeStart } from '@/components/recipe-import/recipe-start';

// Next's bfcacheId for the page's segment, which a visit by a link or a redirect renews and back and
// forward keep.
const router = vi.hoisted(() => ({ bfcacheId: 'first-visit', replace: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const savedId = '0199d2a0-1b2c-7d3e-8f40-000000000004' as SavedDraftId;
const untitledId = '0199d2a0-1b2c-7d3e-8f40-000000000005' as SavedDraftId;

const now = new Date('2026-10-15T18:00:00.000Z');

// A draft typed in and named, then one with no title yet.
const lemonBars: DraftSummaryDto = {
	kind: 'saved',
	id: savedId,
	title: 'Lemon bars',
	savedAt: new Date('2026-10-15T17:50:00.000Z'),
	expiresAt: new Date('2027-01-13T17:50:00.000Z'),
};
const untitled: DraftSummaryDto = {
	kind: 'saved',
	id: untitledId,
	savedAt: new Date('2026-10-13T18:00:00.000Z'),
	expiresAt: new Date('2027-01-11T18:00:00.000Z'),
};

function start({ kept }: { kept?: DraftSummaryDto } = {}) {
	return (
		<RecipeStart
			kept={kept}
			drafts={[lemonBars, untitled]}
			now={now}
			memberId={memberId}
			deleteDraft={vi.fn()}
		/>
	);
}

// The notice naming the draft just left.
function keptNotice() {
	return page.getByRole('status');
}

afterEach(() => {
	router.bfcacheId = 'first-visit';
	vi.clearAllMocks();
	window.history.replaceState(null, '', '/');
});

describe('RecipeStart', () => {
	it('heads the page Add a Recipe, over the ways to start a recipe and then the member’s drafts', async () => {
		await render(start());

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Add a Recipe');
		expect(
			page
				.getByRole('heading', { level: 2 })
				.elements()
				.map((heading) => heading.textContent)
		).toEqual(['Start a new recipe', 'Your drafts']);
		await expect
			.element(
				page.getByRole('region', { name: 'Your drafts' }).getByRole('link', { name: 'Lemon bars' })
			)
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					'Only you can see your drafts until you save them as recipes. Each is kept for 90 days after you last save it, and an import you haven’t saved for 7 days.'
				)
			)
			.toBeVisible();
	});

	it('offers each way to start a recipe as a link to its page, named by its title and described by its line', async () => {
		await render(start());

		const ways = page.getByRole('region', { name: 'Start a new recipe' }).getByRole('link');
		await expect.element(ways).toHaveLength(3);
		await expect.element(ways.nth(0)).toHaveAccessibleName('Type it in');
		await expect.element(ways.nth(0)).toHaveAccessibleDescription('Fill in the recipe yourself.');
		await expect.element(ways.nth(1)).toHaveAccessibleName('From a link');
		await expect
			.element(ways.nth(1))
			.toHaveAccessibleDescription('Copy a recipe from a website by pasting its address.');
		await expect.element(ways.nth(2)).toHaveAccessibleName('From photos');
		await expect
			.element(ways.nth(2))
			.toHaveAccessibleDescription(
				'Take or choose photos of a recipe card or a cookbook page, and we’ll read it.'
			);
		expect(ways.elements().map((link) => link.getAttribute('href'))).toEqual([
			'/contribute/new',
			'/contribute/link',
			'/contribute/photos',
		]);
	});

	it('names each of its lists a list, which Safari takes for a group without markers', async () => {
		await render(start());

		const lists = page.getByRole('list').elements();
		expect(lists).toHaveLength(2);
		expect(lists.map((list) => list.getAttribute('role'))).toEqual(['list', 'list']);
	});

	it('says nothing is kept until a draft is left for it', async () => {
		await render(start());

		await expect.element(keptNotice()).not.toBeInTheDocument();
	});

	it('says the draft just left is kept, with a link that opens it again, and makes its address its own', async () => {
		window.history.replaceState(null, '', `/contribute?kept=${savedId}`);
		await render(start({ kept: lemonBars }));

		await expect
			.element(keptNotice())
			.toHaveTextContent('“Lemon bars” is kept in your drafts, on any device. Open it');
		await expect
			.element(keptNotice().getByRole('link', { name: 'Open it' }))
			.toHaveAttribute('href', `/contribute/drafts/${savedId}`);
		// A reload, or a return through history, says nothing.
		expect(`${location.pathname}${location.search}`).toBe('/contribute');
	});

	it('says so on a new page whose effects Strict Mode runs a second time', async () => {
		await render(<React.StrictMode>{start({ kept: lemonBars })}</React.StrictMode>);
		await new Promise((resolve) => setTimeout(resolve));

		await expect.element(keptNotice()).toBeVisible();
	});

	it('names an untitled draft as the list does', async () => {
		await render(start({ kept: untitled }));

		await expect
			.element(keptNotice())
			.toHaveTextContent('“Untitled recipe” is kept in your drafts, on any device. Open it');
	});

	it('shows the page without the notice when back or forward returns to it, and with it on the next visit', async () => {
		const visited = await renderVisitedPage(() => start({ kept: lemonBars }), router);
		await expect.element(keptNotice()).toBeVisible();
		await visited.leave();

		await visited.returnBy('history');
		await expect.element(page.getByRole('link', { name: 'Type it in' })).toBeVisible();
		await expect.element(keptNotice()).not.toBeInTheDocument();

		await visited.leave();
		await visited.returnBy('link');
		await expect.element(keptNotice()).toBeVisible();
	});
});
