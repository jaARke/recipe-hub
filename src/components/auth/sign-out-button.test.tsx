import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { holdPageLoads } from '@/components/auth/testing/page-loads';

vi.mock('@/components/auth/auth-client', () => ({
	authClient: { signOut: vi.fn(async () => ({ data: { success: true }, error: null })) },
}));

afterEach(() => {
	localStorage.clear();
});

describe('SignOutButton', () => {
	it('removes what this browser kept for the member and loads the destination as a new page', async () => {
		window.history.replaceState(null, '', '/account');
		const loads = holdPageLoads();
		localStorage.setItem('member:recipe-form:new', '{}');
		localStorage.setItem('theme', 'dark');
		await render(<SignOutButton destination="/" />);

		await page.getByRole('button', { name: 'Sign out' }).click();

		await expect.poll(() => loads).toEqual([{ path: '/', type: 'push' }]);
		expect(localStorage.getItem('member:recipe-form:new')).toBeNull();
		expect(localStorage.getItem('theme')).toBe('dark');
	});

	it('loads this page again at a destination that differs from it only in its fragment', async () => {
		window.history.replaceState(null, '', '/invite');
		const loads = holdPageLoads();
		await render(<SignOutButton destination={() => '/invite#invite-token'} />);

		await page.getByRole('button', { name: 'Sign out' }).click();

		await expect.poll(() => loads).toEqual([{ path: '/invite#invite-token', type: 'reload' }]);
	});
});
