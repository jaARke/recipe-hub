import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
	ConfirmActionDialog,
	useConfirmActionDialogOpener,
} from '@/components/forms/confirm-action-dialog';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { renderKeptPage } from '@/components/forms/testing/kept-page';

const declineProps = {
	variant: 'destructive',
	title: 'Decline Sam’s request?',
	description: 'Sam won’t be told.',
	cancelLabel: 'Keep request',
	confirmLabel: 'Decline request',
	pendingLabel: 'Declining',
	successMessage: 'Request declined',
	failureMessage: 'We couldn’t decline that request.',
} as const;

function declineDialog(action: FormAction) {
	return (
		<ConfirmActionDialog {...declineProps} trigger="Decline" action={action}>
			<input type="hidden" name="requestId" value="request-1" />
		</ConfirmActionDialog>
	);
}

function renderDialog(action: FormAction) {
	render(declineDialog(action));
	return screen.getByRole('button', { name: 'Decline' });
}

// Opened by one control, as a menu's item opens it, with focus to return to another, as the menu's
// button takes it back.
function OpenedElsewhere({ action }: { action: FormAction }) {
	const returnHere = React.useRef<HTMLButtonElement>(null);
	const opener = useConfirmActionDialogOpener(returnHere);
	return (
		<>
			<button type="button" onClick={() => opener.handle.open(null)}>
				Ask
			</button>
			<button ref={returnHere} type="button">
				More
			</button>
			<ConfirmActionDialog {...declineProps} opener={opener} action={action}>
				<input type="hidden" name="requestId" value="request-1" />
			</ConfirmActionDialog>
		</>
	);
}

describe('ConfirmActionDialog', () => {
	it('stays open while the action runs, so it cannot be confirmed twice', async () => {
		const { promise, resolve } = Promise.withResolvers<FormState>();
		const action = vi.fn<FormAction>(() => promise);
		const user = userEvent.setup();
		const trigger = renderDialog(action);

		await user.click(trigger);
		await user.click(await screen.findByRole('button', { name: 'Decline request' }));
		await user.keyboard('{Escape}');
		await user.click(screen.getByRole('button', { name: 'Keep request' }));

		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		await user.click(screen.getByRole('button', { name: /Declining$/ }));
		expect(action).toHaveBeenCalledOnce();
		// Ended, since React holds back every later transition, a later test's among them, until it ends.
		await act(async () => resolve({ status: 'success' }));
	});

	it('closes as its page hides, so a return through history finds it closed', async () => {
		const action = vi.fn<FormAction>();
		const user = userEvent.setup();
		const page = renderKeptPage(declineDialog(action));
		const trigger = screen.getByRole('button', { name: 'Decline' });

		await user.click(trigger);
		expect(await screen.findByRole('alertdialog')).toBeDefined();
		await page.hide();
		await page.show();

		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
		expect(action).not.toHaveBeenCalled();
	});

	it('stays open while its action runs as its page hides, and shows a refusal that arrives meanwhile', async () => {
		const { promise, resolve } = Promise.withResolvers<FormState>();
		const user = userEvent.setup();
		const page = renderKeptPage(declineDialog(() => promise));
		const trigger = screen.getByRole('button', { name: 'Decline' });

		await user.click(trigger);
		await user.click(await screen.findByRole('button', { name: 'Decline request' }));
		await page.hide();
		await act(async () =>
			resolve({ status: 'error', message: 'Sam’s request was withdrawn.', fieldErrors: {} })
		);
		await page.show();

		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(
			within(screen.getByRole('alertdialog')).getByText('Sam’s request was withdrawn.')
		).toBeDefined();
	});

	it('opens from another control without a button of its own, and returns focus where its opener says', async () => {
		const action = vi.fn<FormAction>(async () => ({ status: 'success' }));
		const user = userEvent.setup();
		render(<OpenedElsewhere action={action} />);
		expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
			'Ask',
			'More',
		]);

		await user.click(screen.getByRole('button', { name: 'Ask' }));
		await user.click(
			within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep request' })
		);

		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More' }))
		);
		expect(action).not.toHaveBeenCalled();
	});
});
