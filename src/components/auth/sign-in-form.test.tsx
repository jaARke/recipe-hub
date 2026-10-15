import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignInForm } from '@/components/auth/sign-in-form';

// Stand in for the auth client's calls, so any address gets a code and any code signs in.
vi.mock('@/components/auth/email-codes', () => ({
	requestSignInCode: vi.fn(async () => ({ status: 'success' })),
	signInWithCode: vi.fn(async () => ({ status: 'success' })),
}));

// The passkey dialog is the browser's; here it signs in with the first passkey offered.
vi.mock('@/components/auth/auth-client', () => ({
	authClient: { signIn: { passkey: vi.fn(async () => ({ data: {}, error: null })) } },
}));

// Stands in for the browser's page loads, which happy-dom would attempt.
function stubPageLoads() {
	return vi.spyOn(window.location, 'assign').mockImplementation(() => {});
}

afterEach(() => {
	vi.restoreAllMocks();
});

// Signing in loads the page to return to as a new page, so nothing Next fetched while signed out,
// such as a member page's redirect back to sign-in, decides where the member lands.
describe('SignInForm', () => {
	it('loads the page to return to as a new page once a code signs the member in', async () => {
		const assign = stubPageLoads();
		const user = userEvent.setup();
		render(<SignInForm next="/contribute" codeLifetimeMinutes={10} />);

		await user.type(screen.getByLabelText('Email'), 'ada@example.com');
		await user.click(screen.getByRole('button', { name: 'Email me a code' }));
		await user.type(await screen.findByLabelText('Code'), '123456');
		await user.click(screen.getByRole('button', { name: 'Sign in' }));

		await waitFor(() => expect(assign).toHaveBeenCalledWith('/contribute'));
	});

	it('loads the page to return to as a new page once a passkey signs the member in', async () => {
		const assign = stubPageLoads();
		render(<SignInForm next="/contribute" codeLifetimeMinutes={10} />);

		await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in with a passkey' }));

		await waitFor(() => expect(assign).toHaveBeenCalledWith('/contribute'));
	});
});
