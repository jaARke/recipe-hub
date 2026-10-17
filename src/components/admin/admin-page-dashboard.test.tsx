import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { AdminActions } from '@/components/admin/admin-forms';
import { AdminPageDashboard } from '@/components/admin/admin-page-dashboard';
import type { FormAction } from '@/components/forms/form-state';

// Stands in for Next's router, which hands every change of the address, a navigation or a call to
// history.replaceState, back to useSearchParams; the browser tells of each through the Navigation API.
vi.mock('next/navigation', async (importOriginal) => {
	const React = await import('react');
	// Only its events are read here, and TypeScript's DOM types lack the Navigation API.
	const { navigation } = globalThis as unknown as { navigation: EventTarget };
	function subscribe(listener: () => void) {
		navigation.addEventListener('currententrychange', listener);
		return () => navigation.removeEventListener('currententrychange', listener);
	}
	return {
		...(await importOriginal<typeof import('next/navigation')>()),
		useSearchParams: () => {
			const search = React.useSyncExternalStore(subscribe, () => window.location.search);
			return React.useMemo(() => new URLSearchParams(search), [search]);
		},
	};
});

function currentUrl(): string {
	return `${window.location.pathname}${window.location.search}`;
}

function selectedTab() {
	return page.getByRole('tab', { selected: true });
}

const succeed: FormAction = async () => ({ status: 'success' });

const actions: AdminActions = {
	issueInvite: async () => ({
		status: 'success',
		displayName: 'Casey',
		link: 'https://recipes.example/invite#token',
		delivery: { status: 'not-requested' },
	}),
	declineRequest: succeed,
	revokeInvite: succeed,
	makeAdmin: succeed,
	removeAdmin: succeed,
	removeMember: succeed,
};

async function renderPageDashboard() {
	await render(
		<AdminPageDashboard
			requests={[]}
			invites={[]}
			members={[]}
			actions={actions}
			headingLevel={2}
		/>
	);
}

describe('AdminPageDashboard', () => {
	afterEach(() => {
		window.history.replaceState(null, '', '/admin');
	});

	it('opens the tab the URL names', async () => {
		window.history.replaceState(null, '', '/admin?tab=members');
		await renderPageDashboard();

		await expect.element(selectedTab()).toHaveTextContent('Members');
		await expect
			.element(page.getByRole('tabpanel').getByRole('heading', { name: 'Members' }))
			.toBeVisible();
	});

	it('writes a change of tab to the URL in place, from a click or an arrow key', async () => {
		await renderPageDashboard();
		const entries = window.history.length;

		await page.getByRole('tab', { name: 'Invites' }).click();
		await expect.element(selectedTab()).toHaveTextContent('Invites');
		expect(currentUrl()).toBe('/admin?tab=invites');

		await userEvent.keyboard('{ArrowRight}');
		await expect.element(selectedTab()).toHaveTextContent('Members');
		expect(currentUrl()).toBe('/admin?tab=members');

		await page.getByRole('tab', { name: 'Requests' }).click();
		await expect.element(selectedTab()).toHaveTextContent('Requests');
		expect(currentUrl()).toBe('/admin');
		expect(window.history.length).toBe(entries);
	});

	it('opens Requests when a link leads from another tab to plain /admin', async () => {
		window.history.replaceState(null, '', '/admin?tab=members');
		await renderPageDashboard();

		// A link's navigation to another URL of the same page, which Next makes with pushState.
		window.history.pushState(null, '', '/admin');

		await expect.element(selectedTab()).toHaveTextContent('Requests');
		await expect
			.element(page.getByRole('tabpanel').getByRole('heading', { name: 'Access requests' }))
			.toBeVisible();
	});
});
