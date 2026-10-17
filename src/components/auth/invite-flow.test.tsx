import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { CompletedInviteDto } from '@/application/access/access-dtos';
import { signInWithCode } from '@/components/auth/email-codes';
import { InviteFlow } from '@/components/auth/invite-flow';
import { holdPageLoads } from '@/components/auth/testing/page-loads';
import type { FormState } from '@/components/forms/form-state';
import { renderKeptPage } from '@/components/forms/testing/kept-page';

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => ({ refresh: vi.fn() }),
}));

// Stand in for the auth client's calls, so any address gets a code and any code signs in.
vi.mock('@/components/auth/email-codes', () => ({
	requestSignInCode: vi.fn(async () => ({ status: 'success' })),
	signInWithCode: vi.fn(async () => ({ status: 'success' })),
}));

// The passkey dialog is the browser's; here it closes without making one.
vi.mock('@/components/auth/auth-client', () => ({
	authClient: {
		passkey: {
			addPasskey: async () => ({ data: null, error: { status: 400, code: 'AUTH_CANCELLED' } }),
		},
		signOut: async () => ({ data: { success: true }, error: null }),
	},
}));

const token = 'invite-token';

type Complete = (token: string) => Promise<FormState<CompletedInviteDto>>;

type BindEmail = (token: string, email: string) => Promise<FormState<{ email: string }>>;

const bindAnyEmail: BindEmail = async (_token, email) => ({ status: 'success', email });

function inviteFlow(
	complete: Complete,
	signedInAs: string | null,
	bindEmail = bindAnyEmail,
	joined: CompletedInviteDto['account'] | null = null
) {
	return (
		<InviteFlow
			signedInAs={signedInAs}
			joined={joined}
			codeLifetimeMinutes={10}
			headingLevel={2}
			getPreview={async () => ({ displayName: 'Ada', expiresAt: new Date('2026-10-20') })}
			bindEmail={bindEmail}
			complete={complete}
		/>
	);
}

async function renderFlow(
	complete: Complete,
	signedInAs: string | null = null,
	bindEmail?: BindEmail,
	joined: CompletedInviteDto['account'] | null = null
) {
	await render(inviteFlow(complete, signedInAs, bindEmail, joined));
}

// From the welcome step through a code that signs the invitee in.
async function signInWithInvite() {
	await page.getByRole('button', { name: 'Get started' }).click();
	await page.getByLabelText('Email').fill('ada@example.com');
	await page.getByRole('button', { name: 'Email me a code' }).click();
	await page.getByLabelText('Code').fill('123456');
	await page.getByRole('button', { name: 'Create account' }).click();
}

async function expectStepHeading(name: string) {
	await expect.element(page.getByRole('heading', { name })).toHaveFocus();
}

beforeEach(() => {
	window.history.replaceState(null, '', `/invite#${token}`);
});

describe('InviteFlow', () => {
	it.each([
		{ how: 'by throwing', failure: () => Promise.reject(new Error('Network error')) },
		{
			how: 'with an error',
			failure: async (): Promise<FormState<CompletedInviteDto>> => ({
				status: 'error',
				message: 'Your session has ended. Sign in again to continue.',
				fieldErrors: {},
			}),
		},
	])(
		'offers to finish again without the spent code when completing fails $how',
		async ({ failure }) => {
			const loads = holdPageLoads();
			const complete = vi
				.fn<Complete>()
				.mockImplementationOnce(failure)
				.mockResolvedValueOnce({ status: 'success', account: 'created' });
			await renderFlow(complete);

			await signInWithInvite();
			await expectStepHeading('We couldn’t finish accepting your invite');
			expect(loads).toEqual([]);
			await page.getByRole('button', { name: 'Try again' }).click();

			await expect.poll(() => loads).toEqual([{ path: '/invite?account=created', type: 'push' }]);
			expect(complete).toHaveBeenCalledTimes(2);
			expect(complete).toHaveBeenLastCalledWith(token);
			expect(signInWithCode).toHaveBeenCalledOnce();
		}
	);

	it('asks for an address at once when none is given, before binding the invite', async () => {
		const bindEmail = vi.fn(bindAnyEmail);
		await renderFlow(async () => ({ status: 'success', account: 'created' }), null, bindEmail);

		await page.getByRole('button', { name: 'Get started' }).click();
		await page.getByRole('button', { name: 'Email me a code' }).click();

		await expect.element(page.getByText('Enter your email address.')).toBeVisible();
		await expect.element(page.getByLabelText('Email')).toHaveFocus();
		expect(bindEmail).not.toHaveBeenCalled();
	});

	it.each(['created', 'existing'] as const)(
		'loads the page again once the code signs the invitee in, saying the account was %s',
		async (account) => {
			const loads = holdPageLoads();
			await renderFlow(async () => ({ status: 'success', account }));

			await signInWithInvite();

			await expect
				.poll(() => loads)
				.toEqual([{ path: `/invite?account=${account}`, type: 'push' }]);
		}
	);

	it('offers a passkey on the page loaded again for a new account, and drops a failed one’s message once its page has been left', async () => {
		const keptPage = await renderKeptPage(
			inviteFlow(
				async () => ({ status: 'success', account: 'created' }),
				'Ada',
				undefined,
				'created'
			)
		);

		await page.getByRole('button', { name: 'Create a passkey' }).click();
		await expect.element(page.getByText('No passkey was created')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		expect(page.getByText('No passkey was created').query()).toBeNull();
		await expect.element(page.getByRole('heading', { name: 'Create a passkey' })).toBeVisible();
	});

	it('tells an invitee who already had an account so, on the page loaded again', async () => {
		await renderFlow(
			async () => ({ status: 'success', account: 'existing' }),
			'Ada',
			undefined,
			'existing'
		);

		await expect.element(page.getByRole('heading', { name: 'You’re all set' })).toBeVisible();
		await expect
			.element(page.getByText('You already have an account, and you’re signed in.'))
			.toBeVisible();
	});

	it('signs a signed-in visitor out to this invite, with its token back in the fragment', async () => {
		const loads = holdPageLoads();
		await renderFlow(async () => ({ status: 'success', account: 'existing' }), 'Sam');
		expect(window.location.hash).toBe('');

		await page.getByRole('button', { name: 'Sign out' }).click();

		await expect.poll(() => loads).toEqual([{ path: `/invite#${token}`, type: 'reload' }]);
	});
});
