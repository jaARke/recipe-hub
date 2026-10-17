import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { DeviceFavoritesNote } from '@/components/favorites/device-favorites-note';

describe('DeviceFavoritesNote', () => {
	it('says the list is kept in a cookie on this device until sign-in, and links to privacy', async () => {
		const { locator } = await render(<DeviceFavoritesNote />);

		await expect
			.element(locator)
			.toHaveTextContent(
				'Your favorites are kept in a cookie on this device until you sign in. Read what we store and why.'
			);
		await expect
			.element(page.getByRole('link', { name: 'what we store and why' }))
			.toHaveAttribute('href', '/privacy');
	});
});
