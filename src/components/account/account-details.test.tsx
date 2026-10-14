import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountDetails } from '@/components/account/account-details';

// The member has no passkeys, so the Passkeys section renders without the auth endpoint.
vi.mock('@/components/auth/auth-client', () => ({
	authClient: {
		useListPasskeys: () => ({ data: [], error: null, isPending: false, refetch: vi.fn() }),
	},
}));

describe('AccountDetails', () => {
	it('shows the email above the display name, so the name’s Save ends the Profile section', () => {
		render(
			<AccountDetails
				displayName="Ada"
				email="ada@example.com"
				renameAction={async () => ({ status: 'success' })}
			/>
		);

		const profile = screen.getByRole('region', { name: 'Profile' }).textContent ?? '';
		expect(profile.indexOf('ada@example.com')).toBeLessThan(profile.indexOf('Display name'));
		expect(profile.endsWith('Save name')).toBe(true);
	});
});
