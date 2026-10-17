import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, type Locator } from 'vitest/browser';
import { AccountDetails } from '@/components/account/account-details';

// The member has no passkeys, so the Passkeys section renders without the auth endpoint.
vi.mock('@/components/auth/auth-client', () => ({
	authClient: {
		useListPasskeys: () => ({ data: [], error: null, isPending: false, refetch: vi.fn() }),
	},
}));

// Where the element is laid out on the screen.
function box(locator: Locator): DOMRect {
	return locator.element().getBoundingClientRect();
}

describe('AccountDetails', () => {
	it('shows the email above the display name, so the name’s Save ends the Profile section', async () => {
		await render(
			<AccountDetails
				displayName="Ada"
				email="ada@example.com"
				renameAction={async () => ({ status: 'success' })}
			/>
		);
		const profile = page.getByRole('region', { name: 'Profile' });

		expect(box(profile.getByText('ada@example.com')).bottom).toBeLessThan(
			box(profile.getByLabelText('Display name')).top
		);
		expect(box(profile.getByRole('button', { name: 'Save name' })).bottom).toBe(
			box(profile).bottom
		);
	});
});
