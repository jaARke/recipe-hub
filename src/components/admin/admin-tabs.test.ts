import { describe, expect, it } from 'vitest';
import { adminTabHref, parseAdminTab } from '@/components/admin/admin-tabs';

describe('parseAdminTab', () => {
	it.each([
		['tab=requests', 'requests'],
		['tab=invites', 'invites'],
		['tab=members', 'members'],
		['tab=members&sort=newest', 'members'],
	])('opens the tab %j names', (query, expected) => {
		expect(parseAdminTab(new URLSearchParams(query))).toBe(expected);
	});

	it.each([[''], ['tab='], ['tab=Members'], ['tab=settings'], ['tab=members&tab=invites']])(
		'opens Requests for %j',
		(query) => {
			expect(parseAdminTab(new URLSearchParams(query))).toBe('requests');
		}
	);
});

describe('adminTabHref', () => {
	it('leaves the default tab out of the URL and names any other', () => {
		expect(adminTabHref('requests')).toBe('/admin');
		expect(adminTabHref('invites')).toBe('/admin?tab=invites');
		expect(adminTabHref('members')).toBe('/admin?tab=members');
	});
});
