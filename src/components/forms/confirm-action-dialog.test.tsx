import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
	ConfirmActionDialog,
	useConfirmActionDialogOpener,
} from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';

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

function renderDialog(action: FormAction) {
	render(
		<ConfirmActionDialog {...declineProps} trigger="Decline" action={action}>
			<input type="hidden" name="requestId" value="request-1" />
		</ConfirmActionDialog>
	);
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
		const action = vi.fn<FormAction>(() => new Promise(() => {}));
		const user = userEvent.setup();
		const trigger = renderDialog(action);

		await user.click(trigger);
		await user.click(await screen.findByRole('button', { name: 'Decline request' }));
		await user.keyboard('{Escape}');
		await user.click(screen.getByRole('button', { name: 'Keep request' }));

		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		await user.click(screen.getByRole('button', { name: /Declining$/ }));
		expect(action).toHaveBeenCalledOnce();
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
