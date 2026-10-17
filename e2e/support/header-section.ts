import { expect, type Page } from '@playwright/test';

const headerSections = ['Browse', 'Favorites', 'Add recipe'] as const;

// The section the header marks, by its aria-current: "page" on the section's own page, and "true"
// elsewhere in it, as on a recipe opened from it.
export type HeaderSectionMark = {
	section: (typeof headerSections)[number];
	ariaCurrent: 'page' | 'true';
};

// The header marks one section as current, or none, as on Search: in the main navigation, or on a
// phone in its menu.
export async function expectHeaderSection(
	page: Page,
	isMobile: boolean,
	mark: HeaderSectionMark | undefined
) {
	if (isMobile) {
		await page.getByRole('button', { name: 'Menu' }).click();
	}
	const links = isMobile
		? page.getByRole('menu').getByRole('menuitem')
		: page.getByRole('navigation', { name: 'Main' }).getByRole('link');
	for (const section of headerSections) {
		const link = links.filter({ hasText: section });
		if (section === mark?.section) {
			await expect(link).toHaveAttribute('aria-current', mark.ariaCurrent);
		} else {
			await expect(link).not.toHaveAttribute('aria-current');
		}
	}
	if (isMobile) {
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menu')).toBeHidden();
	}
}
