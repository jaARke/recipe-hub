import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, type Locator } from 'vitest/browser';
import type { HeaderMember } from '@/components/layout/header-member';
import { SiteMenu } from '@/components/layout/site-menu';
import { recipeOpenedFromValue } from '@/components/recipe/recipe-opened-from';
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

// A visitor with no drafts unless the test says otherwise, as a signed-out one counts none.
async function openMenu(
	session: Promise<HeaderMember | null>,
	draftCount: Promise<number> = Promise.resolve(0)
): Promise<Locator> {
	await render(<SiteMenu member={session} draftCount={draftCount} />);
	await page.getByRole('button', { name: 'Menu' }).click();
	const menu = page.getByRole('menu');
	await expect.element(menu).toBeVisible();
	return menu;
}

// The sections the menu marks as current, by name.
function currentSections(menu: Locator): (string | null)[] {
	return menu
		.getByRole('group', { name: 'Navigation' })
		.getByRole('menuitem')
		.elements()
		.filter((item) => item.hasAttribute('aria-current'))
		.map((item) => item.textContent);
}

// A recipe opened from the list at the URL, as the tab's history and storage record it.
function openRecipeFrom(listUrl: string, backLabel: string) {
	location.pathname = '/recipes/lemon-bars';
	const openerUrl = `${window.location.origin}${listUrl}`;
	stubTabNavigation([openerUrl, `${window.location.origin}/recipes/lemon-bars`]);
	writeTabStorage(
		'opened-from:/recipes/lemon-bars',
		recipeOpenedFromValue({ url: openerUrl, backLabel })
	);
}

function itemNames(group: Locator, role: 'menuitem' | 'menuitemradio' = 'menuitem'): string[] {
	return group
		.getByRole(role)
		.elements()
		.map((item) => item.textContent);
}

describe('SiteMenu', () => {
	it('offers a signed-out visitor the site, sign-in, privacy, and the theme', async () => {
		const menu = await openMenu(Promise.resolve(null));

		const account = menu.getByRole('group', { name: 'Account' });
		await expect.element(account).toBeVisible();
		expect(itemNames(account)).toEqual(['Sign in', 'Request access', 'Privacy']);
		await expect
			.element(account.getByRole('menuitem', { name: 'Privacy' }))
			.toHaveAttribute('href', '/privacy');
		expect(itemNames(menu.getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
		]);
		expect(itemNames(menu.getByRole('group', { name: 'Theme' }), 'menuitemradio')).toEqual([
			'Light',
			'Dark',
			'System',
		]);
	});

	it("keeps a member's account group to the account and privacy, with Sign out last", async () => {
		const menu = await openMenu(Promise.resolve(member));

		const account = menu.getByRole('group', { name: 'Signed in as Sam' });
		await expect.element(account).toBeVisible();
		expect(itemNames(account)).toEqual(['Account', 'Privacy', 'Sign out']);
		expect(itemNames(menu.getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
		]);
	});

	it("adds Admin last in an admin's navigation", async () => {
		const menu = await openMenu(Promise.resolve(admin));

		await expect.element(menu.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
		expect(itemNames(menu.getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
			'Admin',
		]);
	});

	it("shows the member's draft count beside Add recipe, read as drafts", async () => {
		const menu = await openMenu(Promise.resolve(member), Promise.resolve(2));

		await expect
			.element(menu.getByRole('menuitem', { name: /^Add recipe/ }))
			.toHaveTextContent('Add recipe, 2 drafts');
		expect(itemNames(menu.getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe, 2 drafts',
		]);
	});

	it('reads a single draft as one', async () => {
		const menu = await openMenu(Promise.resolve(member), Promise.resolve(1));

		await expect
			.element(menu.getByRole('menuitem', { name: /^Add recipe/ }))
			.toHaveTextContent('Add recipe, 1 draft');
	});

	it('shows no count for a member without drafts', async () => {
		const menu = await openMenu(Promise.resolve(member), Promise.resolve(0));

		await expect.element(menu.getByRole('group', { name: 'Signed in as Sam' })).toBeVisible();
		expect(itemNames(menu.getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
		]);
	});

	it('opens with its navigation before the session resolves', async () => {
		const menu = await openMenu(
			new Promise<HeaderMember | null>(() => {}),
			new Promise<number>(() => {})
		);

		expect(itemNames(menu.getByRole('group', { name: 'Navigation' }))).toEqual([
			'Browse',
			'Favorites',
			'Add recipe',
		]);
		await expect.element(menu.getByRole('menuitem', { name: 'Sign in' })).not.toBeInTheDocument();
		await expect.element(menu.getByRole('menuitem', { name: 'Account' })).not.toBeInTheDocument();
	});

	it('marks the current page, underlined so more than its color marks it', async () => {
		const menu = await openMenu(Promise.resolve(null));

		const browse = menu.getByRole('menuitem', { name: 'Browse' });
		await expect.element(browse).toHaveAttribute('aria-current', 'page');
		await expect.element(browse).toHaveStyle({ textDecorationLine: 'underline' });
		const addRecipe = menu.getByRole('menuitem', { name: 'Add recipe' });
		await expect.element(addRecipe).not.toHaveAttribute('aria-current');
		await expect.element(addRecipe).toHaveStyle({ textDecorationLine: 'none' });
	});

	it('marks the section of a page below it', async () => {
		location.pathname = '/contribute/imports/0199c7a4';
		const menu = await openMenu(Promise.resolve(admin));

		await expect
			.element(menu.getByRole('menuitem', { name: 'Add recipe' }))
			.toHaveAttribute('aria-current', 'true');
		await expect
			.element(menu.getByRole('menuitem', { name: 'Browse' }))
			.not.toHaveAttribute('aria-current');
		await expect.element(menu.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
		await expect
			.element(menu.getByRole('menuitem', { name: 'Admin' }))
			.not.toHaveAttribute('aria-current');
	});

	it('marks Favorites as the section of a recipe opened from Favorites', async () => {
		openRecipeFrom('/favorites?page=2', 'Back to Favorites');
		const menu = await openMenu(Promise.resolve(null));

		await expect
			.element(menu.getByRole('menuitem', { name: 'Favorites' }))
			.toHaveAttribute('aria-current', 'true');
		await expect
			.element(menu.getByRole('menuitem', { name: 'Browse' }))
			.not.toHaveAttribute('aria-current');
	});

	it('marks no section on search, where the field holding the words marks it', async () => {
		location.pathname = '/search';
		const menu = await openMenu(Promise.resolve(admin));

		await expect.element(menu.getByRole('menuitem', { name: 'Admin' })).toBeVisible();
		expect(currentSections(menu)).toEqual([]);
	});

	it('marks Browse as the section of a recipe opened from filtered Browse', async () => {
		openRecipeFrom('/?chapter=desserts', 'Back to recipes');
		const menu = await openMenu(Promise.resolve(null));

		await expect
			.element(menu.getByRole('menuitem', { name: 'Browse' }))
			.toHaveAttribute('aria-current', 'true');
		expect(currentSections(menu)).toEqual(['Browse']);
	});

	it('marks no section on a recipe opened from a search', async () => {
		openRecipeFrom('/search?q=lemon&chapter=desserts', 'Back to search results');
		const menu = await openMenu(Promise.resolve(null));

		await expect
			.element(menu.getByRole('menuitem', { name: 'Browse' }))
			.not.toHaveAttribute('aria-current');
		expect(currentSections(menu)).toEqual([]);
	});
});
