import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompletedInviteDto } from '@/application/access/access-dtos';
import { signInWithCode } from '@/components/auth/email-codes';
import { InviteFlow } from '@/components/auth/invite-flow';
import type { FormState } from '@/components/forms/form-state';

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => ({ refresh: vi.fn() }),
}));

// Stand in for the auth client's calls, so any address gets a code and any code signs in.
vi.mock('@/components/auth/email-codes', () => ({
	requestSignInCode: vi.fn(async () => ({ status: 'success' })),
	signInWithCode: vi.fn(async () => ({ status: 'success' })),
}));

const token = 'invite-token';

type Complete = (token: string) => Promise<FormState<CompletedInviteDto>>;

function renderFlow(complete: Complete) {
	render(
		<InviteFlow
			signedInAs={null}
			codeLifetimeMinutes={10}
			headingLevel={2}
			getPreview={async () => ({ displayName: 'Ada', expiresAt: new Date('2026-10-20') })}
			bindEmail={async (_token, email) => ({ status: 'success', email })}
			complete={complete}
		/>
	);
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

	it('tells an invitee who already had an account so', async () => {
		renderFlow(async () => ({ status: 'success', account: 'existing' }));

		await signInWithInvite();

		await expectStepHeading('You’re all set');
		expect(screen.getByText('You already have an account, and you’re signed in.')).toBeDefined();
	});
});
