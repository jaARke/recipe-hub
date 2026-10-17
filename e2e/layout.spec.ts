import type { Page } from '@playwright/test';
import { adminTabHref } from '@/components/admin/admin-tabs';
import {
	accountPath,
	privacyPath,
	requestAccessPath,
	signInPath,
} from '@/components/auth/auth-paths';
import { withCookingStepParam } from '@/components/cooking/cooking-screens';
import {
	recipeEntryParamNames,
	type RecipeEntryTab,
} from '@/components/recipe-import/recipe-entry-paths';
import {
	contributePath,
	favoritesPath,
	recipeEditPath,
	recipeListPath,
	recipePath,
} from '@/components/recipe/recipe-paths';
import type { MemberRole } from '@/domain/member/member';
import { hrefWithParams } from '@/lib/url-query';
import { expect, test } from './support/fixtures';
import { checkLayout, minimumTargetSize, phoneWidthsToCheck } from './support/layout';
import { sampleRecipe } from './support/sample-recipe';
import { sampleSearchPath } from './support/sample-search';
import { stylesheetDeclarationsNotServed } from './support/stylesheet';

type CheckedPage = {
	name: string;
	path: string;
	// Who the page is laid out for; signed out when absent.
	signedInAs?: MemberRole;
};

// The sample's cooking view at a screen: 0 is Gather, 1 to 7 its steps, and 8 the finish.
function cookingScreenPath(screen: number): string {
	return hrefWithParams(sampleRecipe.cookPath, withCookingStepParam(new URLSearchParams(), screen));
}

function entryTabPath(tab: RecipeEntryTab): string {
	return hrefWithParams(contributePath, new URLSearchParams({ [recipeEntryParamNames.tab]: tab }));
}

const checkedPages: CheckedPage[] = [
	{ name: 'Browse', path: recipeListPath },
	{ name: 'a recipe', path: sampleRecipe.path },
	{ name: 'the cooking view’s Gather screen', path: cookingScreenPath(0) },
	{ name: 'a cooking step', path: cookingScreenPath(6) },
	{ name: 'the cooking view’s finish', path: cookingScreenPath(8) },
	{ name: 'Favorites', path: favoritesPath },
	{ name: 'search results', path: sampleSearchPath },
	{ name: 'sign-in', path: signInPath },
	{ name: 'request access', path: requestAccessPath },
	{ name: 'privacy', path: privacyPath },
	{ name: 'a missing recipe', path: recipePath('no-such-recipe') },
	{ name: 'manual entry', path: entryTabPath('manual'), signedInAs: 'member' },
	{ name: 'a link import', path: entryTabPath('url'), signedInAs: 'member' },
	{ name: 'a photo import', path: entryTabPath('photo'), signedInAs: 'member' },
	{ name: 'drafts', path: entryTabPath('drafts'), signedInAs: 'member' },
	{ name: 'the account', path: accountPath, signedInAs: 'member' },
	{ name: 'a member’s Favorites', path: favoritesPath, signedInAs: 'member' },
	{ name: 'a recipe’s editor', path: recipeEditPath(sampleRecipe.slug), signedInAs: 'admin' },
	{ name: 'admin requests', path: adminTabHref('requests'), signedInAs: 'admin' },
	{ name: 'admin invites', path: adminTabHref('invites'), signedInAs: 'admin' },
	{ name: 'admin members', path: adminTabHref('members'), signedInAs: 'admin' },
];

async function expectLaidOut(page: Page, width: number, checksTargets: boolean) {
	const findings = await checkLayout(page);
	expect.soft(findings.horizontalOverflow, `horizontal overflow at ${width} px`).toEqual([]);
	expect.soft(findings.clippedText, `clipped text at ${width} px`).toEqual([]);
	if (checksTargets) {
		expect
			.soft(findings.smallTargets, `tap targets under ${minimumTargetSize} px at ${width} px`)
			.toEqual([]);
	}
}

// A phone lays the page out at every width from 320 to 430 px, where tap targets count; a desktop at
// its own width.
async function expectPageLaidOut(page: Page, path: string, isMobile: boolean) {
	await page.goto(path);
	await page.waitForLoadState('networkidle');
	const viewport = page.viewportSize() ?? { width: 0, height: 0 };
	if (!isMobile) {
		await expectLaidOut(page, viewport.width, false);
		return;
	}
	for (const width of phoneWidthsToCheck()) {
		await page.setViewportSize({ width, height: viewport.height });
		await expectLaidOut(page, width, true);
	}
}

// The checks below measure the page as the served stylesheet lays it out, so they measure the code
// only while that stylesheet is current.
test('the dev server serves globals.css as it is now', async ({ page }) => {
	await page.goto(privacyPath);
	expect(
		await stylesheetDeclarationsNotServed(page),
		'Restart pnpm dev, which serves globals.css as it was when the server started'
	).toEqual([]);
});

function layoutTitle(name: string): string {
	return `${name} lays out without overflow, clipped text, or small tap targets`;
}

for (const { name, path, signedInAs } of checkedPages) {
	if (signedInAs === undefined) {
		test(layoutTitle(name), async ({ page, isMobile }) => {
			await expectPageLaidOut(page, path, isMobile);
		});
		continue;
	}

	test.describe(() => {
		test.use({ memberRole: signedInAs });
		test(layoutTitle(name), async ({ page, isMobile, signIn }) => {
			await signIn();
			await expectPageLaidOut(page, path, isMobile);
		});
	});
}
