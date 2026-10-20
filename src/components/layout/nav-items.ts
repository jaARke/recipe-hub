import { adminPath } from '@/components/auth/auth-paths';
import {
	contributePath,
	favoritesPath,
	recipeListPath,
	recipePagesPath,
} from '@/components/recipe/recipe-paths';

export type NavItem = {
	href: string;
	label: string;
	// Where else the section's pages live, besides at and below href.
	otherPaths?: readonly string[];
	// Shows the member's draft count beside the label.
	showsDraftCount?: boolean;
};

// The site's sections, in the header's row and the phone menu. Signed out, Add recipe leads to
// sign-in, which the proxy sends it to and which says why. Recipes holds every search too.
export const navItems: readonly NavItem[] = [
	{ href: recipeListPath, label: 'Recipes', otherPaths: [recipePagesPath] },
	{ href: favoritesPath, label: 'Favorites' },
	{ href: contributePath, label: 'Add recipe', showsDraftCount: true },
];

// Admins only, and last wherever it appears, so nothing moves when it streams in with the session.
export const adminNavItem: NavItem = { href: adminPath, label: 'Admin' };

// The root is matched alone, since every path is below it.
function isAtOrBelow(pathname: string, path: string): boolean {
	return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
}

// A section link's aria-current, as GOV.UK's service navigation sets it: "page" on the section's own
// page and "true" anywhere else in the section. A recipe opened from a list is in that list's
// section, given listPathname, the list's pathname, so one opened from Favorites marks Favorites.
// Without a pathname, no link is current.
export function navItemCurrent(
	item: NavItem,
	pathname: string | undefined,
	listPathname?: string
): 'page' | 'true' | undefined {
	if (pathname === undefined) {
		return undefined;
	}
	if (pathname === item.href) {
		return 'page';
	}
	const sectionPathname = listPathname ?? pathname;
	const sectionPaths = [item.href, ...(item.otherPaths ?? [])];
	return sectionPaths.some((path) => isAtOrBelow(sectionPathname, path)) ? 'true' : undefined;
}
