import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { LiveAnnouncer, useLiveAnnouncement } from '@/components/forms/live-announcement';
import { renderKeptPage } from '@/components/forms/testing/kept-page';

function ProbeMoveButton() {
	const [announcement, announce] = useLiveAnnouncement();

	return (
		<>
			<button type="button" onClick={() => announce('Moved up.')}>
				Move up
			</button>
			<LiveAnnouncer announcement={announcement} />
		</>
	);
}

describe('useLiveAnnouncement', () => {
	it('leaves nothing to read when its page shows again, and announces the next edit', async () => {
		const keptPage = await renderKeptPage(<ProbeMoveButton />);

		await page.getByRole('button', { name: 'Move up' }).click();
		await expect.element(page.getByRole('status')).toHaveTextContent('Moved up.');
		await keptPage.hide();
		expect(document.body.textContent).not.toContain('Moved up.');
		await keptPage.show();
		await expect.element(page.getByRole('status')).toHaveTextContent('');

		await page.getByRole('button', { name: 'Move up' }).click();
		await expect.element(page.getByRole('status')).toHaveTextContent('Moved up.');
	});
});
