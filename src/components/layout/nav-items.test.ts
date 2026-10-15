import { describe, expect, it } from 'vitest';
import {
	adminNavItem,
	navItemCurrent,
	navItems,
	type NavItem,
} from '@/components/layout/nav-items';

function navItem(label: string): NavItem {
	const item = navItems.find((candidate) => candidate.label === label);
	if (item === undefined) {
		throw new Error(`No nav item is labeled ${label}.`);
	}
	return item;
}

describe('navItemCurrent', () => {
	it('marks Browse as the page on the recipe list', () => {
		expect(navItemCurrent(navItem('Browse'), '/')).toBe('page');
	});

	it('marks Browse as the section on a recipe, its edit page, and search', () => {
		const browse = navItem('Browse');

		expect(navItemCurrent(browse, '/recipes/sunday-pot-roast')).toBe('true');
		expect(navItemCurrent(browse, '/recipes/sunday-pot-roast/edit')).toBe('true');
		expect(navItemCurrent(browse, '/search')).toBe('true');
	});

	it('marks Favorites as the page on /favorites', () => {
		expect(navItemCurrent(navItem('Favorites'), '/favorites')).toBe('page');
	});

	it('marks Add recipe as the page on /contribute and the section on an import', () => {
		const addRecipe = navItem('Add recipe');

		expect(navItemCurrent(addRecipe, '/contribute')).toBe('page');
		expect(navItemCurrent(addRecipe, '/contribute/imports/0199c7a4')).toBe('true');
	});

	it('marks Admin as the page on /admin', () => {
		expect(navItemCurrent(adminNavItem, '/admin')).toBe('page');
	});

	it('leaves a section unmarked on pages outside it', () => {
		expect(navItemCurrent(navItem('Browse'), '/account')).toBeUndefined();
		expect(navItemCurrent(navItem('Browse'), '/contribute')).toBeUndefined();
		expect(navItemCurrent(navItem('Browse'), '/favorites')).toBeUndefined();
		expect(navItemCurrent(navItem('Favorites'), '/recipes/sunday-pot-roast')).toBeUndefined();
		expect(navItemCurrent(navItem('Add recipe'), '/')).toBeUndefined();
		expect(navItemCurrent(adminNavItem, '/search')).toBeUndefined();
	});

	it('matches a section by whole path segments, not by a shared prefix', () => {
		expect(navItemCurrent(navItem('Browse'), '/searches')).toBeUndefined();
		expect(navItemCurrent(navItem('Browse'), '/recipes-old')).toBeUndefined();
		expect(navItemCurrent(navItem('Add recipe'), '/contributors')).toBeUndefined();
		expect(navItemCurrent(navItem('Favorites'), '/favorites-old')).toBeUndefined();
		expect(navItemCurrent(adminNavItem, '/administrators')).toBeUndefined();
	});

	it('marks nothing without a pathname', () => {
		expect(navItemCurrent(navItem('Browse'), undefined)).toBeUndefined();
	});
});
