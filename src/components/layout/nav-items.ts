import { adminPath } from '@/components/auth/auth-paths';
import { contributePath, recipeListPath } from '@/components/recipe/recipe-paths';

export type NavItem = { href: string; label: string };

// The site's sections, in the main nav and the phone menu.
export const navItems: readonly NavItem[] = [{ href: recipeListPath, label: 'Browse' }];

// A button beside the search field in the wide header, and a navigation item in the phone menu.
// Signed out, the proxy sends it to sign-in, which says why.
export const addRecipeNavItem: NavItem = { href: contributePath, label: 'Add recipe' };

// Admins only, and last wherever it appears, so nothing moves when it streams in with the session.
export const adminNavItem: NavItem = { href: adminPath, label: 'Admin' };
