import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeMoveButton />);

		await user.click(screen.getByRole('button', { name: 'Move up' }));
		expect(screen.getByRole('status').textContent).toBe('Moved up.');
		await page.hide();
		expect(document.body.textContent).not.toContain('Moved up.');
		await page.show();
		expect(screen.getByRole('status').textContent).toBe('');

		await user.click(screen.getByRole('button', { name: 'Move up' }));
		expect(screen.getByRole('status').textContent).toBe('Moved up.');
	});
});
