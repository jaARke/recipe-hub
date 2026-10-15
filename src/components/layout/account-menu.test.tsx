import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AccountMenu } from '@/components/layout/account-menu';
import type { HeaderMember } from '@/components/layout/header-member';

const member: HeaderMember = { displayName: 'Sam', role: 'member' };

describe('AccountMenu', () => {
	it("holds the member's account and privacy, with Sign out last", async () => {
		render(<AccountMenu member={member} />);
		await userEvent.click(screen.getByRole('button', { name: 'Account menu for Sam' }));

		const account = within(await screen.findByRole('menu')).getByRole('group', {
			name: 'Signed in as Sam',
		});
		expect(
			within(account)
				.getAllByRole('menuitem')
				.map((item) => item.textContent)
		).toEqual(['Account', 'Privacy', 'Sign out']);
		expect(within(account).getByRole('menuitem', { name: 'Privacy' }).getAttribute('href')).toBe(
			'/privacy'
		);
	});
});
