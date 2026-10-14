import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompletedInviteDto } from '@/application/access/access-dtos';
import { signInWithCode } from '@/components/auth/email-codes';
import { InviteFlow } from '@/components/auth/invite-flow';
import { useSignOut } from '@/components/auth/use-sign-out';
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
	},
}));

vi.mock('@/components/auth/use-sign-out', () => ({
	useSignOut: vi.fn(() => ({ signOut: vi.fn(), pending: false })),
}));

const token = 'invite-token';

type Complete = (token: string) => Promise<FormState<CompletedInviteDto>>;

type BindEmail = (token: string, email: string) => Promise<FormState<{ email: string }>>;

const bindAnyEmail: BindEmail = async (_token, email) => ({ status: 'success', email });

function inviteFlow(complete: Complete, signedInAs: string | null, bindEmail = bindAnyEmail) {
	return (
		<InviteFlow
			signedInAs={signedInAs}
			codeLifetimeMinutes={10}
			headingLevel={2}
			getPreview={async () => ({ displayName: 'Ada', expiresAt: new Date('2026-10-20') })}
			bindEmail={bindEmail}
			complete={complete}
		/>
	);
}

function renderFlow(complete: Complete, signedInAs: string | null = null, bindEmail?: BindEmail) {
	render(inviteFlow(complete, signedInAs, bindEmail));
}

// From the welcome step through a code that signs the invitee in.
async function signInWithInvite() {
	const user = userEvent.setup();
	await user.click(await screen.findByRole('button', { name: 'Get started' }));
	await user.type(screen.getByLabelText('Email'), 'ada@example.com');
	await user.click(screen.getByRole('button', { name: 'Email me a code' }));
	await user.type(await screen.findByLabelText('Code'), '123456');
	await user.click(screen.getByRole('button', { name: 'Create account' }));
	return user;
}

async function expectStepHeading(name: string) {
	const heading = await screen.findByRole('heading', { name });
	await waitFor(() => expect(document.activeElement).toBe(heading));
}

beforeEach(() => {
	vi.mocked(signInWithCode).mockClear();
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
			const complete = vi
				.fn<Complete>()
				.mockImplementationOnce(failure)
				.mockResolvedValueOnce({ status: 'success', account: 'created' });
			renderFlow(complete);

			const user = await signInWithInvite();
			await expectStepHeading('We couldn’t finish accepting your invite');
			await user.click(screen.getByRole('button', { name: 'Try again' }));

			await expectStepHeading('Create a passkey');
			expect(complete).toHaveBeenCalledTimes(2);
			expect(complete).toHaveBeenLastCalledWith(token);
			expect(signInWithCode).toHaveBeenCalledOnce();
		}
	);

	it('asks for an address at once when none is given, before binding the invite', async () => {
		const bindEmail = vi.fn(bindAnyEmail);
		const user = userEvent.setup();
		renderFlow(async () => ({ status: 'success', account: 'created' }), null, bindEmail);

		await user.click(await screen.findByRole('button', { name: 'Get started' }));
		await user.click(screen.getByRole('button', { name: 'Email me a code' }));

		expect(screen.getByText('Enter your email address.')).toBeDefined();
		expect(document.activeElement).toBe(screen.getByLabelText('Email'));
		expect(bindEmail).not.toHaveBeenCalled();
	});

	it('drops a failed passkey’s message once its page has been left, keeping the step', async () => {
		const page = renderKeptPage(
			inviteFlow(async () => ({ status: 'success', account: 'created' }), null)
		);

		const user = await signInWithInvite();
		await expectStepHeading('Create a passkey');
		await user.click(screen.getByRole('button', { name: 'Create a passkey' }));
		expect(await screen.findByText('No passkey was created')).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.queryByText('No passkey was created')).toBeNull();
		expect(screen.getByRole('heading', { name: 'Create a passkey' })).toBeDefined();
	});

	it('tells an invitee who already had an account so', async () => {
		renderFlow(async () => ({ status: 'success', account: 'existing' }));

		await signInWithInvite();

		await expectStepHeading('You’re all set');
		expect(screen.getByText('You already have an account, and you’re signed in.')).toBeDefined();
	});

	it('signs a signed-in visitor out to this invite, with its token back in the fragment', async () => {
		const signOut = vi.fn();
		vi.mocked(useSignOut).mockReturnValue({ signOut, pending: false });
		renderFlow(async () => ({ status: 'success', account: 'existing' }), 'Sam');

		await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign out' }));

		expect(window.location.hash).toBe('');
		expect(signOut).toHaveBeenCalledWith({ destination: `/invite#${token}` });
	});
});
