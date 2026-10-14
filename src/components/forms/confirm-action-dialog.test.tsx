import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmActionDialog } from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';

function renderDialog(action: FormAction) {
	render(
		<ConfirmActionDialog
			variant="destructive"
			trigger="Decline"
			title="Decline Sam’s request?"
			description="Sam won’t be told."
			cancelLabel="Keep request"
			confirmLabel="Decline request"
			pendingLabel="Declining"
			successMessage="Request declined"
			failureMessage="We couldn’t decline that request."
			action={action}
		>
			<input type="hidden" name="requestId" value="request-1" />
		</ConfirmActionDialog>
	);
	return screen.getByRole('button', { name: 'Decline' });
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
});
