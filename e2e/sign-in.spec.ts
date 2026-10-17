import type { Page } from '@playwright/test';
import { accountPath, signInPath } from '@/components/auth/auth-paths';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import type { Member } from '@/domain/member/member';
import { authCookiePrefix } from '@/lib/auth-cookies';
import { expect, test } from './support/fixtures';

// The account page shows the member's address only to the member, and sends anyone else to sign in.
async function expectSignedInAs(page: Page, member: Member) {
	await page.goto(accountPath);
	await expect(page.getByRole('region', { name: 'Profile' }).getByText(member.email)).toBeVisible();
}

test('a passkey added on the account signs the member in again', async ({
	page,
	context,
	member,
	signIn,
}) => {
	// Playwright's virtual authenticator, which answers every WebAuthn request in this context.
	await context.credentials.install();
	await signIn();
	await page.goto(accountPath);
	const passkeys = page.getByRole('region', { name: 'Passkeys' });
	await expect(passkeys.getByText('You haven’t added a passkey yet.')).toBeVisible();
	await passkeys.getByRole('button', { name: 'Add a passkey' }).click();
	await expect(passkeys.getByRole('listitem')).toHaveCount(1);

	await page
		.getByRole('region', { name: 'Sign out' })
		.getByRole('button', { name: 'Sign out' })
		.click();
	await expect(page).toHaveURL(recipeListPath);
	await expect
		.poll(async () => (await context.cookies()).map(({ name }) => name))
		.not.toContain(`${authCookiePrefix(false)}.session_token`);

	// The authenticator answers the email field's autofill request at once, so the page signs in as it
	// loads, as picking the passkey from the autofill would.
	await page.goto(signInPath);
	await expect(page).toHaveURL(recipeListPath);
	await expectSignedInAs(page, member);
});

// Sends an email, so it runs only by name: `pnpm test:e2e --project=email`. It goes to Resend's test
// inbox, so it reaches no one.
test.describe(() => {
	test.use({ memberInbox: 'resendTest' });

	test(
		'an emailed code signs the member in',
		{ tag: '@email' },
		async ({ page, member, develop }) => {
			await page.goto(signInPath);
			await page.getByRole('textbox', { name: 'Email' }).fill(member.email);
			await page.getByRole('button', { name: 'Email me a code' }).click();
			const codeField = page.getByRole('textbox', { name: 'Code' });
			await expect(codeField).toBeVisible();

			// The dev server stores the code as it sends it, and the suites' Better Auth reads it back.
			await expect.poll(() => develop.auth.signInCode(member.email)).not.toBeNull();
			await codeField.fill((await develop.auth.signInCode(member.email)) ?? '');
			await page.getByRole('button', { name: 'Sign in', exact: true }).click();

			await expect(page).toHaveURL(recipeListPath);
			await expectSignedInAs(page, member);
		}
	);
});
