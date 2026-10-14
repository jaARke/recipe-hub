import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignOutButton } from '@/components/auth/sign-out-button';

vi.mock('@/components/auth/auth-client', () => ({
	authClient: { signOut: vi.fn(async () => ({ data: { success: true }, error: null })) },
}));

// Stands in for the browser's page loads, which happy-dom would attempt.
function stubPageLoads() {
	return {
		assign: vi.spyOn(window.location, 'assign').mockImplementation(() => {}),
		reload: vi.spyOn(window.location, 'reload').mockImplementation(() => {}),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('SignOutButton', () => {
	it('loads the destination as a new page once signed out', async () => {
		window.history.replaceState(null, '', '/account');
		const { assign, reload } = stubPageLoads();
		render(<SignOutButton destination="/" />);

		await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));

		await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
		expect(reload).not.toHaveBeenCalled();
	});

	it('loads this page again at a destination that differs from it only in its fragment', async () => {
		window.history.replaceState(null, '', '/invite');
		const { assign, reload } = stubPageLoads();
		render(<SignOutButton destination={() => '/invite#invite-token'} />);

		await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));

		await waitFor(() => expect(reload).toHaveBeenCalledOnce());
		expect(`${window.location.pathname}${window.location.hash}`).toBe('/invite#invite-token');
		expect(assign).not.toHaveBeenCalled();
	});
});
