import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeviceFavoritesNote } from '@/components/favorites/device-favorites-note';

describe('DeviceFavoritesNote', () => {
	it('says the list is kept in a cookie on this device until sign-in, and links to privacy', () => {
		const { container } = render(<DeviceFavoritesNote />);

		expect(container.textContent).toBe(
			'Your favorites are kept in a cookie on this device until you sign in. Read what we store and why.'
		);
		expect(screen.getByRole('link', { name: 'what we store and why' }).getAttribute('href')).toBe(
			'/privacy'
		);
	});
});
