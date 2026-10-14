import { adminPath } from '@/components/auth/auth-paths';
import {
	contributePath,
	recipeListPath,
	recipePagesPath,
	recipeSearchPath,
} from '@/components/recipe/recipe-paths';

export type NavItem = {
	href: string;
	label: string;
	// Where else the section's pages live, besides at and below href.
	otherPaths?: readonly string[];
};

// The site's sections, in the header's row and the phone menu. Signed out, Add recipe leads to
// sign-in, which the proxy sends it to and which says why.
export const navItems: readonly NavItem[] = [
	{ href: recipeListPath, label: 'Browse', otherPaths: [recipePagesPath, recipeSearchPath] },
	{ href: contributePath, label: 'Add recipe' },
];

// Admins only, and last wherever it appears, so nothing moves when it streams in with the session.
export const adminNavItem: NavItem = { href: adminPath, label: 'Admin' };

// The root is matched alone, since every path is below it.
function isAtOrBelow(pathname: string, path: string): boolean {
	return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
}

// A section link's aria-current, as GOV.UK's service navigation sets it: "page" on the section's own
// page and "true" anywhere else in the section. Without a pathname, no link is current.
export function navItemCurrent(
	item: NavItem,
	pathname: string | undefined
): 'page' | 'true' | undefined {
	if (pathname === undefined) {
		return undefined;
	}
	if (pathname === item.href) {
		return 'page';
	}
	const sectionPaths = [item.href, ...(item.otherPaths ?? [])];
	return sectionPaths.some((path) => isAtOrBelow(pathname, path)) ? 'true' : undefined;
}
