import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import {
	ConfirmActionDialog,
	useConfirmActionDialogOpener,
} from '@/components/forms/confirm-action-dialog';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { heldResult } from '@/components/forms/testing/held-result';
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

function dialog() {
	return page.getByRole('alertdialog');
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
		const { promise, resolve } = heldResult<FormState>({ status: 'success' });
		const action = vi.fn<FormAction>(() => promise);
		await render(declineDialog(action));
		// Read while closed: the open dialog takes the rest of the page out of the accessibility tree.
		const trigger = page.getByRole('button', { name: 'Decline' }).element();

		await page.getByRole('button', { name: 'Decline' }).click();
		await dialog().getByRole('button', { name: 'Decline request' }).click();
		const confirming = dialog().getByRole('button', { name: 'Declining' });
		// Named by its pending label alone, which says it waits, without its spinner's "Loading".
		await expect.element(confirming).toHaveAccessibleName('Declining');
		// Focus stays on the confirming button as it waits, where a key could press it again.
		await expect.element(confirming).toHaveFocus();
		await userEvent.keyboard('{Enter}');
		await userEvent.keyboard('{Escape}');

		await expect.element(dialog().getByRole('button', { name: 'Keep request' })).toBeDisabled();
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		// Ended before the count is read, since a second submit would wait in React's queue until then.
		resolve({ status: 'success' });
		await expect.element(dialog()).not.toBeInTheDocument();
		expect(action).toHaveBeenCalledOnce();
	});

	it('closes as its page hides, so a return through history finds it closed', async () => {
		const action = vi.fn<FormAction>();
		const keptPage = await renderKeptPage(declineDialog(action));

		await page.getByRole('button', { name: 'Decline' }).click();
		await expect.element(dialog()).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await expect.element(dialog()).not.toBeInTheDocument();
		expect(action).not.toHaveBeenCalled();
	});

	it('stays open while its action runs as its page hides, and shows a refusal that arrives meanwhile', async () => {
		const { promise, resolve } = heldResult<FormState>({ status: 'success' });
		const keptPage = await renderKeptPage(declineDialog(() => promise));

		await page.getByRole('button', { name: 'Decline' }).click();
		await dialog().getByRole('button', { name: 'Decline request' }).click();
		await keptPage.hide();
		resolve({ status: 'error', message: 'Sam’s request was withdrawn.', fieldErrors: {} });
		await expect.poll(() => document.body.textContent).toContain('Sam’s request was withdrawn.');
		await keptPage.show();

		await expect.element(dialog().getByText('Sam’s request was withdrawn.')).toBeVisible();
	});

	it('opens from another control without a button of its own, and returns focus where its opener says', async () => {
		const action = vi.fn<FormAction>(async () => ({ status: 'success' }));
		await render(<OpenedElsewhere action={action} />);
		expect(
			page
				.getByRole('button')
				.elements()
				.map((button) => button.textContent)
		).toEqual(['Ask', 'More']);

		await page.getByRole('button', { name: 'Ask' }).click();
		await dialog().getByRole('button', { name: 'Keep request' }).click();

		await expect.element(page.getByRole('button', { name: 'More' })).toHaveFocus();
		expect(action).not.toHaveBeenCalled();
	});
});
