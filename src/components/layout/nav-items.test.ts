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
	it('marks Recipes as the page on the Recipes page', () => {
		expect(navItemCurrent(navItem('Recipes'), '/')).toBe('page');
	});

	it('marks Recipes as the section on a recipe and its edit page', () => {
		const recipes = navItem('Recipes');

		expect(navItemCurrent(recipes, '/recipes/sunday-pot-roast')).toBe('true');
		expect(navItemCurrent(recipes, '/recipes/sunday-pot-roast/edit')).toBe('true');
	});

	it('marks Favorites, not Recipes, as the section on a recipe opened from Favorites', () => {
		expect(navItemCurrent(navItem('Favorites'), '/recipes/sunday-pot-roast', '/favorites')).toBe(
			'true'
		);
		expect(
			navItemCurrent(navItem('Recipes'), '/recipes/sunday-pot-roast', '/favorites')
		).toBeUndefined();
	});

	it('marks Recipes as the section on a recipe opened from the Recipes page', () => {
		expect(navItemCurrent(navItem('Recipes'), '/recipes/sunday-pot-roast', '/')).toBe('true');
		expect(navItemCurrent(navItem('Favorites'), '/recipes/sunday-pot-roast', '/')).toBeUndefined();
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
		expect(navItemCurrent(navItem('Recipes'), '/account')).toBeUndefined();
		expect(navItemCurrent(navItem('Recipes'), '/contribute')).toBeUndefined();
		expect(navItemCurrent(navItem('Recipes'), '/favorites')).toBeUndefined();
		expect(navItemCurrent(navItem('Favorites'), '/recipes/sunday-pot-roast')).toBeUndefined();
		expect(navItemCurrent(navItem('Add recipe'), '/')).toBeUndefined();
	});

	it('matches a section by whole path segments, not by a shared prefix', () => {
		expect(navItemCurrent(navItem('Recipes'), '/searches')).toBeUndefined();
		expect(navItemCurrent(navItem('Recipes'), '/recipes-old')).toBeUndefined();
		expect(navItemCurrent(navItem('Add recipe'), '/contributors')).toBeUndefined();
		expect(navItemCurrent(navItem('Favorites'), '/favorites-old')).toBeUndefined();
		expect(navItemCurrent(adminNavItem, '/administrators')).toBeUndefined();
	});

	it('marks nothing without a pathname', () => {
		expect(navItemCurrent(navItem('Recipes'), undefined)).toBeUndefined();
	});
});
