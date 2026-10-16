import { describe, expect, it } from 'vitest';
import { joinedInviteHref, safeNextPath, signInHref } from '@/components/auth/auth-paths';

describe('signInHref', () => {
	it('names the page to return to', () => {
		expect(signInHref('/account')).toBe('/sign-in?next=%2Faccount');
		expect(signInHref('/admin?tab=open')).toBe('/sign-in?next=%2Fadmin%3Ftab%3Dopen');
	});
});

describe('joinedInviteHref', () => {
	it('names whether the invite created the account', () => {
		expect(joinedInviteHref('created')).toBe('/invite?account=created');
		expect(joinedInviteHref('existing')).toBe('/invite?account=existing');
	});
});

describe('safeNextPath', () => {
	it.each(['/account', '/admin?tab=open', '/recipes/biscuits#steps', '/'])(
		'keeps the site path %j',
		(next) => {
			expect(safeNextPath(next)).toBe(next);
		}
	);

	it.each([
		['another origin', 'https://example.com/account'],
		['a protocol-relative URL', '//example.com/account'],
		['a backslash after the slash', '/\\example.com'],
		['a tab the browser drops', '/\t/example.com'],
		['a newline the browser drops', '/\n/example.com'],
		['a script URL', 'javascript:alert(1)'],
		['a relative path', 'account'],
		['dot segments that resolve to a protocol-relative URL', '/a/..//example.com'],
		['encoded dot segments', '/a/%2e%2e//example.com'],
	])('falls back to the recipe list for %s', (_, next) => {
		expect(safeNextPath(next)).toBe('/');
	});

	it('falls back to the recipe list when the parameter is absent, empty, or repeated', () => {
		expect(safeNextPath(undefined)).toBe('/');
		expect(safeNextPath('')).toBe('/');
		expect(safeNextPath(['/account', '/admin'])).toBe('/');
	});
});
