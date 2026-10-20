import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { HeaderMember } from '@/components/layout/header-member';
import { MainNav } from '@/components/layout/main-nav';

// The links read the pathname to mark the current section.
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const member: HeaderMember = { displayName: 'Sam', role: 'member' };

const admin: HeaderMember = { displayName: 'Robin', role: 'admin' };

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

// Where the row's links end, after each change to them, which is where the search field beside them
// starts. Stops watching when the function returned is called.
function watchLinksEnd(): () => number[] {
	const list = page.getByRole('navigation', { name: 'Main' }).getByRole('list').element();
	const linksEnd = () => list.lastElementChild?.getBoundingClientRect().right ?? 0;
	const ends = [linksEnd()];
	const observer = new MutationObserver(() => {
		if (linksEnd() !== ends.at(-1)) {
			ends.push(linksEnd());
		}
	});
	observer.observe(list, { subtree: true, childList: true, characterData: true });
	return () => {
		observer.disconnect();
		return ends;
	};
}

// Shows once the read resolves, as what waits for it can, so a test knows React has seen it.
function ReadShown({ read, name }: { read: Promise<unknown>; name: string }) {
	React.use(read);
	return <p>{name} read</p>;
}

describe('MainNav', () => {
	it("shows the member's draft count beside Add recipe, 6 px from its label, read as drafts", async () => {
		await render(<MainNav member={Promise.resolve(member)} draftCount={Promise.resolve(2)} />);

		const addRecipe = page.getByRole('link', { name: /^Add recipe/ });
		await expect.element(addRecipe).toHaveTextContent('Add recipe, 2 drafts');
		expect(linkNames()).toEqual(['Recipes', 'Favorites', 'Add recipe, 2 drafts']);
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
		expect(linkNames()).toEqual(['Recipes', 'Favorites', 'Add recipe']);
	});

	it.each([
		{ order: 'the session first', first: 'Session' },
		{ order: 'the count first', first: 'Count' },
	])(
		'shows Admin and the draft count at once with $order, so the row changes once',
		async ({ first }) => {
			const reads = {
				Session: Promise.withResolvers<HeaderMember | null>(),
				Count: Promise.withResolvers<number>(),
			};
			await render(
				<>
					<MainNav member={reads.Session.promise} draftCount={reads.Count.promise} />
					{Object.entries(reads).map(([name, { promise }]) => (
						<React.Suspense key={name}>
							<ReadShown read={promise} name={name} />
						</React.Suspense>
					))}
				</>
			);
			await expect.element(page.getByRole('link', { name: 'Add recipe' })).toBeVisible();
			const stopWatching = watchLinksEnd();

			if (first === 'Session') {
				reads.Session.resolve(admin);
			} else {
				reads.Count.resolve(2);
			}
			await expect.element(page.getByText(`${first} read`)).toBeVisible();
			expect(linkNames()).toEqual(['Recipes', 'Favorites', 'Add recipe']);
			reads.Session.resolve(admin);
			reads.Count.resolve(2);

			await expect.element(page.getByRole('link', { name: 'Admin' })).toBeVisible();
			expect(linkNames()).toEqual(['Recipes', 'Favorites', 'Add recipe, 2 drafts', 'Admin']);
			expect(stopWatching()).toHaveLength(2);
		}
	);

	it('shows its links before the session and the count resolve', async () => {
		await render(
			<MainNav
				member={new Promise<HeaderMember | null>(() => {})}
				draftCount={new Promise<number>(() => {})}
			/>
		);

		await expect.element(page.getByRole('link', { name: 'Add recipe' })).toBeVisible();
		expect(linkNames()).toEqual(['Recipes', 'Favorites', 'Add recipe']);
	});
});
