import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { AccountMenu } from '@/components/layout/account-menu';
import type { HeaderMember } from '@/components/layout/header-member';

const member: HeaderMember = { displayName: 'Sam', role: 'member' };

describe('AccountMenu', () => {
	it("holds the member's account and privacy, with Sign out last", async () => {
		await render(<AccountMenu member={member} />);
		await page.getByRole('button', { name: 'Account menu for Sam' }).click();

		const account = page.getByRole('menu').getByRole('group', { name: 'Signed in as Sam' });
		await expect.element(account).toBeVisible();
		expect(
			account
				.getByRole('menuitem')
				.elements()
				.map((item) => item.textContent)
		).toEqual(['Account', 'Privacy', 'Sign out']);
		await expect
			.element(account.getByRole('menuitem', { name: 'Privacy' }))
			.toHaveAttribute('href', '/privacy');
	});
});
