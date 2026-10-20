import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { HeaderMember } from '@/components/layout/header-member';
import { MainNav } from '@/components/layout/main-nav';

// The links read the pathname to mark the current section.
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const member: HeaderMember = { displayName: 'Sam', role: 'member' };

function linkNames(): (string | null)[] {
	return page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link')
		.elements()
		.map((link) => link.textContent);
}

// From the end of the link's label to the start of its badge.
function badgeGap(link: HTMLElement): number {
	const label = document.createRange();
	label.selectNodeContents(link.firstChild as Node);
	const badge = link.querySelector('[data-slot="badge"]') as HTMLElement;
	return badge.getBoundingClientRect().left - label.getBoundingClientRect().right;
}

describe('MainNav', () => {
	it("shows the member's draft count beside Add recipe, 6 px from its label, read as drafts", async () => {
		await render(<MainNav member={Promise.resolve(member)} draftCount={Promise.resolve(2)} />);

		const addRecipe = page.getByRole('link', { name: /^Add recipe/ });
		await expect.element(addRecipe).toHaveTextContent('Add recipe, 2 drafts');
		expect(linkNames()).toEqual(['Browse', 'Favorites', 'Add recipe, 2 drafts']);
		expect(badgeGap(addRecipe.element() as HTMLElement)).toBeCloseTo(6, 0);
	});

	it('reads a single draft as one', async () => {
		await render(<MainNav member={Promise.resolve(member)} draftCount={Promise.resolve(1)} />);

		await expect
			.element(page.getByRole('link', { name: /^Add recipe/ }))
			.toHaveTextContent('Add recipe, 1 draft');
	});

	it('shows no count where there are no drafts, as for a signed-out visitor', async () => {
		await render(<MainNav member={Promise.resolve(null)} draftCount={Promise.resolve(0)} />);

		await expect.element(page.getByRole('link', { name: 'Add recipe' })).toBeVisible();
		expect(linkNames()).toEqual(['Browse', 'Favorites', 'Add recipe']);
	});

	it('shows its links before the session and the count resolve', async () => {
		await render(
			<MainNav
				member={new Promise<HeaderMember | null>(() => {})}
				draftCount={new Promise<number>(() => {})}
			/>
		);

		await expect.element(page.getByRole('link', { name: 'Add recipe' })).toBeVisible();
		expect(linkNames()).toEqual(['Browse', 'Favorites', 'Add recipe']);
	});
});
