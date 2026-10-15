import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeaderMember } from '@/components/layout/header-member';
import { SiteMenu } from '@/components/layout/site-menu';
import { stubTabNavigation } from '@/components/recipe/testing/tab-navigation';
import { writeTabStorage } from '@/lib/browser-storage';

const location = vi.hoisted(() => ({ pathname: '/' }));

// The menu reads the pathname to mark the current section, and sign-out uses the router.
vi.mock('next/navigation', () => ({
	usePathname: () => location.pathname,
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
	location.pathname = '/';
});

afterEach(() => {
	vi.unstubAllGlobals();
	sessionStorage.clear();
});

const member: HeaderMember = { displayName: 'Sam', role: 'member' };
const admin: HeaderMember = { displayName: 'Avery', role: 'admin' };

async function openMenu(session: Promise<HeaderMember | null>) {
	render(<SiteMenu member={session} />);
	await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
	return screen.findByRole('menu');
}

function itemNames(group: HTMLElement, role: 'menuitem' | 'menuitemradio' = 'menuitem'): string[] {
	return within(group)
		.getAllByRole(role)
		.map((item) => item.textContent);
}

describe('SiteMenu', () => {
	it('offers a signed-out visitor the site, sign-in, and the theme', async () => {
		const menu = await openMenu(Promise.resolve(null));

		const account = await within(menu).findByRole('group', { name: 'Account' });
		expect(itemNames(account)).toEqual(['Sign in', 'Request access']);
		expect(itemNames(within(menu).getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
		]);
		const theme = within(menu).getByRole('group', { name: 'Theme' });
		expect(itemNames(theme, 'menuitemradio')).toEqual(['Light', 'Dark', 'System']);
	});

	it("keeps a member's account group to the account itself", async () => {
		const menu = await openMenu(Promise.resolve(member));

		const account = await within(menu).findByRole('group', { name: 'Signed in as Sam' });
		expect(itemNames(account)).toEqual(['Account', 'Sign out']);
		expect(itemNames(within(menu).getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
		]);
	});

	it("adds Admin last in an admin's navigation", async () => {
		const menu = await openMenu(Promise.resolve(admin));

		const account = await within(menu).findByRole('group', { name: 'Signed in as Avery' });
		expect(itemNames(account)).toEqual(['Account', 'Sign out']);
		expect(itemNames(within(menu).getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
			'Admin',
		]);
	});

	it('opens with its navigation before the session resolves', async () => {
		const menu = await openMenu(new Promise<HeaderMember | null>(() => {}));

		expect(itemNames(within(menu).getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
		]);
		expect(within(menu).queryByRole('menuitem', { name: 'Sign in' })).toBeNull();
		expect(within(menu).queryByRole('menuitem', { name: 'Account' })).toBeNull();
	});

	it('marks the current page', async () => {
		const menu = await openMenu(Promise.resolve(null));

		expect(
			within(menu).getByRole('menuitem', { name: 'Browse' }).getAttribute('aria-current')
		).toBe('page');
		expect(
			within(menu).getByRole('menuitem', { name: 'Add recipe' }).getAttribute('aria-current')
		).toBeNull();
	});

	it('marks the section of a page below it', async () => {
		location.pathname = '/contribute/imports/0199c7a4';
		const menu = await openMenu(Promise.resolve(admin));

		expect(
			within(menu).getByRole('menuitem', { name: 'Add recipe' }).getAttribute('aria-current')
		).toBe('true');
		expect(
			within(menu).getByRole('menuitem', { name: 'Browse' }).getAttribute('aria-current')
		).toBeNull();
		expect(
			(await within(menu).findByRole('menuitem', { name: 'Admin' })).getAttribute('aria-current')
		).toBeNull();
	});

	it('marks Favorites as the section of a recipe opened from Favorites', async () => {
		location.pathname = '/recipes/lemon-bars';
		const favoritesUrl = `${window.location.origin}/favorites?page=2`;
		stubTabNavigation([favoritesUrl, `${window.location.origin}/recipes/lemon-bars`]);
		writeTabStorage('opened-from:/recipes/lemon-bars', favoritesUrl);
		const menu = await openMenu(Promise.resolve(null));

		expect(
			within(menu).getByRole('menuitem', { name: 'Favorites' }).getAttribute('aria-current')
		).toBe('true');
		expect(
			within(menu).getByRole('menuitem', { name: 'Browse' }).getAttribute('aria-current')
		).toBeNull();
	});
});
