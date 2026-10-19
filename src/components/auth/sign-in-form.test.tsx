import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { authClient } from '@/components/auth/auth-client';
import { SignInForm } from '@/components/auth/sign-in-form';
import { holdPageLoads } from '@/components/auth/testing/page-loads';

// Stand in for the auth client's calls, so any address gets a code and any code signs in.
vi.mock('@/components/auth/email-codes', () => ({
	requestSignInCode: vi.fn(async () => ({ status: 'success' })),
	signInWithCode: vi.fn(async () => ({ status: 'success' })),
}));

// The passkey dialog is the browser's; here it signs in with the first passkey offered.
vi.mock('@/components/auth/auth-client', () => ({
	authClient: {
		signIn: {
			passkey: vi.fn(async () => ({ data: {}, error: null })),
		},
	},
}));

// Signing in loads the page to return to as a new page, so nothing Next fetched while signed out,
// such as a member page's redirect back to sign-in, decides where the member lands.
describe('SignInForm', () => {
	it('loads the page to return to as a new page once a code signs the member in', async () => {
		const loads = holdPageLoads();
		await render(<SignInForm next="/contribute" codeLifetimeMinutes={10} />);

		await page.getByLabelText('Email').fill('ada@example.com');
		await page.getByRole('button', { name: 'Email me a code' }).click();
		await page.getByLabelText('Code').fill('123456');
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect.poll(() => loads).toEqual([{ path: '/contribute', type: 'push' }]);
	});

	it('loads the page to return to as a new page once a passkey signs the member in', async () => {
		const loads = holdPageLoads();
		await render(<SignInForm next="/contribute" codeLifetimeMinutes={10} />);

		await page.getByRole('button', { name: 'Sign in with a passkey' }).click();

		await expect.poll(() => loads).toEqual([{ path: '/contribute', type: 'push' }]);
	});

	it('asks for a passkey only once its button is pressed', async () => {
		const passkey = vi.mocked(authClient.signIn.passkey);
		passkey.mockClear();
		holdPageLoads();
		await render(<SignInForm next="/contribute" codeLifetimeMinutes={10} />);

		await page.getByLabelText('Email').click();
		expect(passkey).not.toHaveBeenCalled();

		await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
		await expect.poll(() => passkey.mock.calls.length).toBe(1);
	});
});
