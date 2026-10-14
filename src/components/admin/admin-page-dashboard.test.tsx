import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminActions } from '@/components/admin/admin-forms';
import { AdminPageDashboard } from '@/components/admin/admin-page-dashboard';
import type { FormAction } from '@/components/forms/form-state';

// Stands in for Next's router, which hands every change of the address, a navigation or a call to
// history.replaceState, back to useSearchParams.
const router = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		announce() {
			for (const listener of listeners) {
				listener();
			}
		},
	};
});

vi.mock('next/navigation', async (importOriginal) => {
	const React = await import('react');
	return {
		...(await importOriginal<typeof import('next/navigation')>()),
		useSearchParams: () => {
			const search = React.useSyncExternalStore(router.subscribe, () => window.location.search);
			return React.useMemo(() => new URLSearchParams(search), [search]);
		},
	};
});

const replaceState = window.history.replaceState.bind(window.history);

// A link's navigation to another URL of the same page.
function navigate(url: string) {
	act(() => {
		replaceState(null, '', url);
		router.announce();
	});
}

function currentUrl(): string {
	return `${window.location.pathname}${window.location.search}`;
}

function selectedTab(): string | null {
	return screen.getByRole('tab', { selected: true }).textContent;
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

function renderPageDashboard() {
	render(
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
	beforeEach(() => {
		vi.spyOn(window.history, 'replaceState').mockImplementation((data, unused, url) => {
			replaceState(data, unused, url);
			router.announce();
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		replaceState(null, '', '/admin');
	});

	it('opens the tab the URL names', () => {
		replaceState(null, '', '/admin?tab=members');
		renderPageDashboard();

		expect(selectedTab()).toBe('Members');
		expect(
			within(screen.getByRole('tabpanel')).getByRole('heading', { name: 'Members' })
		).toBeDefined();
	});

	it('writes a change of tab to the URL in place, from a click or an arrow key', async () => {
		const user = userEvent.setup();
		renderPageDashboard();

		await user.click(screen.getByRole('tab', { name: 'Invites' }));
		expect(currentUrl()).toBe('/admin?tab=invites');
		expect(selectedTab()).toBe('Invites');

		await user.keyboard('{ArrowRight}');
		expect(currentUrl()).toBe('/admin?tab=members');
		expect(selectedTab()).toBe('Members');

		await user.click(screen.getByRole('tab', { name: 'Requests' }));
		expect(currentUrl()).toBe('/admin');
		expect(selectedTab()).toBe('Requests');
	});

	it('opens Requests when a link leads from another tab to plain /admin', async () => {
		replaceState(null, '', '/admin?tab=members');
		renderPageDashboard();

		navigate('/admin');

		expect(selectedTab()).toBe('Requests');
		// The Members panel hides once its close completes.
		await waitFor(() =>
			expect(
				within(screen.getByRole('tabpanel')).getByRole('heading', { name: 'Access requests' })
			).toBeDefined()
		);
	});
});
