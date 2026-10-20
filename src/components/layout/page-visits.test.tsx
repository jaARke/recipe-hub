import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { renderVisitedPage } from '@/components/forms/testing/kept-page';
import { NewOnEachVisit, RefreshOnReturn } from '@/components/layout/page-visits';

// Next's bfcacheId for the page's segment, which a visit by a link or a redirect renews and back and
// forward keep.
const router = vi.hoisted(() => ({ bfcacheId: 'first-visit', refresh: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

function form() {
	return (
		<NewOnEachVisit>
			<label>
				Title
				<input type="text" />
			</label>
		</NewOnEachVisit>
	);
}

afterEach(() => {
	router.bfcacheId = 'first-visit';
	vi.clearAllMocks();
});

describe('NewOnEachVisit', () => {
	it('starts its content afresh when a link or a redirect shows its kept page again', async () => {
		const visited = await renderVisitedPage(form, router);
		await page.getByRole('textbox', { name: 'Title' }).fill('Pound cake');
		await visited.leave();

		await visited.returnBy('link');

		await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveValue('');
	});

	it('keeps its content as it was when back or forward shows its kept page again', async () => {
		const visited = await renderVisitedPage(form, router);
		await page.getByRole('textbox', { name: 'Title' }).fill('Pound cake');
		await visited.leave();

		await visited.returnBy('history');

		await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Pound cake');
	});
});

describe('RefreshOnReturn', () => {
	it('reads nothing again as the page first shows', async () => {
		await renderVisitedPage(() => <RefreshOnReturn />, router);

		expect(router.refresh).not.toHaveBeenCalled();
	});

	it('reads nothing again as Strict Mode runs a new page’s effects a second time', async () => {
		await render(
			<React.StrictMode>
				<RefreshOnReturn />
			</React.StrictMode>
		);
		await new Promise((resolve) => setTimeout(resolve));

		expect(router.refresh).not.toHaveBeenCalled();
	});

	it('reads the page again each time back or forward shows it', async () => {
		const visited = await renderVisitedPage(() => <RefreshOnReturn />, router);
		await visited.leave();
		await visited.returnBy('history');
		await visited.leave();
		await visited.returnBy('history');

		expect(router.refresh).toHaveBeenCalledTimes(2);
	});

	it('reads nothing again when a link or a redirect shows it, which read it already', async () => {
		const visited = await renderVisitedPage(() => <RefreshOnReturn />, router);
		await visited.leave();

		await visited.returnBy('link');

		expect(router.refresh).not.toHaveBeenCalled();
	});
});
