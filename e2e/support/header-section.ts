import { expect, type Locator, type Page } from '@playwright/test';
import { waitForHydration } from './hydration';

const headerSections = ['Browse', 'Favorites', 'Add recipe'] as const;

// The section the header marks, by its aria-current: "page" on the section's own page, and "true"
// elsewhere in it, as on a recipe opened from it.
export type HeaderSectionMark = {
	section: (typeof headerSections)[number];
	ariaCurrent: 'page' | 'true';
};

// Checks the header's section links: in the main navigation, or on a phone in its menu, which opens
// for the check and closes after it.
async function checkHeaderSectionLinks(
	page: Page,
	isMobile: boolean,
	check: (links: Locator) => Promise<void>
) {
	if (isMobile) {
		const menuButton = page.getByRole('button', { name: 'Menu' });
		await waitForHydration(menuButton);
		await menuButton.click();
	}
	const links = isMobile
		? page.getByRole('menu').getByRole('menuitem')
		: page.getByRole('navigation', { name: 'Main' }).getByRole('link');
	await check(links);
	if (isMobile) {
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toBeHidden();
	}
}

// The header marks one section as current, or none, as on Search.
export async function expectHeaderSection(
	page: Page,
	isMobile: boolean,
	mark: HeaderSectionMark | undefined
) {
	await checkHeaderSectionLinks(page, isMobile, async (links) => {
		for (const section of headerSections) {
			const link = links.filter({ hasText: section });
			if (section === mark?.section) {
				await expect(link).toHaveAttribute('aria-current', mark.ariaCurrent);
			} else {
				await expect(link).not.toHaveAttribute('aria-current');
			}
		}
	});
}

// The header's Add recipe link reads as the text, with the member's draft count, such as "Add
// recipe, 2 drafts", or alone with none.
export async function expectAddRecipeLink(page: Page, isMobile: boolean, text: string) {
	await checkHeaderSectionLinks(page, isMobile, async (links) => {
		await expect(links.filter({ hasText: 'Add recipe' })).toHaveText(text);
	});
}
