import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useFocusOnFailure } from '@/components/forms/use-focus-on-failure';
import { useFormAction } from '@/components/forms/use-form-action';

const messageId = 'probe-message';

// A form that shows everything its state holds: the outcome, the message, and the name's error.
function ProbeForm({ action }: { action: FormAction }) {
	const formRef = React.useRef<HTMLFormElement>(null);
	const [state, formAction, , actionResult] = useFormAction(action, 'We couldn’t save.');
	const failure = state.status === 'error' ? state : undefined;
	useFocusOnFailure(actionResult, formRef, messageId);

	return (
		<form ref={formRef} action={formAction} noValidate>
			{failure?.message !== undefined && (
				<p id={messageId} tabIndex={-1}>
					{failure.message}
				</p>
			)}
			<label htmlFor="probe-name">Name</label>
			<input
				id="probe-name"
				name="name"
				aria-invalid={failure?.fieldErrors.name === undefined ? undefined : 'true'}
				defaultValue={failure?.values?.name}
			/>
			{failure?.fieldErrors.name !== undefined && <p>{failure.fieldErrors.name}</p>}
			{state.status === 'success' && <p>Saved.</p>}
			<button type="submit">Save</button>
		</form>
	);
}

const refuse: FormAction = async () => ({
	status: 'error',
	message: 'Check the name.',
	fieldErrors: { name: 'Use 60 characters or fewer.' },
});

describe('useFormAction', () => {
	it('reads a success as idle after its page was hidden', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeForm action={async () => ({ status: 'success' })} />);

		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('Saved.')).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.queryByText('Saved.')).toBeNull();
	});

	it('keeps a refusal’s field error and typed text, not its message, after its page was hidden', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeForm action={refuse} />);

		await user.type(screen.getByLabelText('Name'), 'Ada');
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('Check the name.')).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.queryByText('Check the name.')).toBeNull();
		expect(screen.getByText('Use 60 characters or fewer.')).toBeDefined();
		expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Ada');
	});

	it('clears the message before the page shows again', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeForm action={refuse} />);

		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('Check the name.')).toBeDefined();
		await page.hide();

		expect(document.body.textContent).not.toContain('Check the name.');
	});

	it('shows a result that arrives while its page is hidden', async () => {
		const user = userEvent.setup();
		const { promise, resolve } = Promise.withResolvers<FormState>();
		const action = vi.fn<FormAction>().mockImplementationOnce(refuse).mockReturnValueOnce(promise);
		const page = renderKeptPage(<ProbeForm action={action} />);

		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(await screen.findByText('Check the name.')).toBeDefined();
		await user.click(screen.getByRole('button', { name: 'Save' }));
		await page.hide();
		await act(async () => resolve({ status: 'success' }));
		await page.show();

		expect(screen.getByText('Saved.')).toBeDefined();
	});

	it('moves focus to a refusal once, not again when its page shows', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeForm action={refuse} />);

		await user.click(screen.getByRole('button', { name: 'Save' }));
		const message = await screen.findByText('Check the name.');
		expect(document.activeElement).toBe(message);
		message.blur();
		await page.hide();
		await page.show();

		expect(document.activeElement).toBe(document.body);
	});
});
