import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FieldErrors, FormAction, FormState } from '@/components/forms/form-state';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useFormAction } from '@/components/forms/use-form-action';

type ProbeFormProps = {
	action: FormAction;
	check?: () => FieldErrors;
	onSubmit?: () => void;
	children?: React.ReactNode;
};

// A form that shows everything its state holds: the outcome, the message, the name's error, and the
// photos' error, which shows in place of a field as a photo field's does.
function ProbeForm({ action, check, onSubmit, children }: ProbeFormProps) {
	const [state, formProps] = useFormAction(action, 'We couldn’t save.', {
		blankMessages: { name: 'Enter a name.' },
		check,
		onSubmit,
	});
	const failure = state.status === 'error' ? state : undefined;

	return (
		<form {...formProps}>
			<FormErrorAlert message={failure?.message} />
			<label htmlFor="probe-name">Name</label>
			<input
				id="probe-name"
				name="name"
				required
				aria-invalid={failure?.fieldErrors.name === undefined ? undefined : 'true'}
				defaultValue={failure?.values?.name}
			/>
			{failure?.fieldErrors.name !== undefined && <p>{failure.fieldErrors.name}</p>}
			{failure?.fieldErrors.photos !== undefined && (
				<div data-slot="field-error" tabIndex={-1}>
					{failure.fieldErrors.photos}
				</div>
			)}
			{state.status === 'success' && <p>Saved.</p>}
			<button type="submit">Save</button>
			{children}
		</form>
	);
}

const refuse: FormAction = async () => ({
	status: 'error',
	message: 'Check the name.',
	fieldErrors: { name: 'Use 60 characters or fewer.' },
});

const succeed: FormAction = async () => ({ status: 'success' });

function nameField(): HTMLInputElement {
	return screen.getByLabelText<HTMLInputElement>('Name');
}

// Types a name, so the browser's check finds nothing, then saves.
async function saveName(user: ReturnType<typeof userEvent.setup>, name = 'Ada') {
	await user.clear(nameField());
	await user.type(nameField(), name);
	await user.click(screen.getByRole('button', { name: 'Save' }));
}

describe('useFormAction', () => {
	it('reads a success as idle after its page was hidden', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeForm action={succeed} />);

		await saveName(user);
		expect(await screen.findByText('Saved.')).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.queryByText('Saved.')).toBeNull();
	});

	it('keeps a refusal’s field error and typed text, not its message, after its page was hidden', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeForm action={refuse} />);

		await saveName(user);
		expect(await screen.findByText('Check the name.')).toBeDefined();
		await page.hide();
		await page.show();

		expect(screen.queryByText('Check the name.')).toBeNull();
		expect(screen.getByText('Use 60 characters or fewer.')).toBeDefined();
		expect(nameField().value).toBe('Ada');
	});

	it('clears the message before the page shows again', async () => {
		const user = userEvent.setup();
		const page = renderKeptPage(<ProbeForm action={refuse} />);

		await saveName(user);
		expect(await screen.findByText('Check the name.')).toBeDefined();
		await page.hide();

		expect(document.body.textContent).not.toContain('Check the name.');
	});

	it('shows a result that arrives while its page is hidden', async () => {
		const user = userEvent.setup();
		const { promise, resolve } = Promise.withResolvers<FormState>();
		const action = vi.fn<FormAction>().mockImplementationOnce(refuse).mockReturnValueOnce(promise);
		const page = renderKeptPage(<ProbeForm action={action} />);

		await saveName(user);
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

		await saveName(user);
		const message = await screen.findByRole('alert');
		expect(document.activeElement).toBe(message);
		message.blur();
		await page.hide();
		await page.show();

		expect(document.activeElement).toBe(document.body);
	});

	it('moves focus to the first field the server refused', async () => {
		const user = userEvent.setup();
		render(
			<ProbeForm
				action={async () => ({
					status: 'error',
					fieldErrors: { name: 'Use 60 characters or fewer.' },
				})}
			/>
		);

		await saveName(user);

		expect(await screen.findByText('Use 60 characters or fewer.')).toBeDefined();
		expect(document.activeElement).toBe(nameField());
	});

	it('refuses a blank required field at once, before any request, with focus on it', async () => {
		const action = vi.fn(succeed);
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(<ProbeForm action={action} onSubmit={onSubmit} />);

		// Blank once trimmed, as the server reads it.
		await saveName(user, '   ');

		expect(screen.getByText('Enter a name.')).toBeDefined();
		expect(nameField().getAttribute('aria-invalid')).toBe('true');
		expect(document.activeElement).toBe(nameField());
		expect(nameField().value).toBe('   ');
		expect(action).not.toHaveBeenCalled();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('shows a custom check’s problems at once, before any request, with focus on the first', async () => {
		const action = vi.fn(succeed);
		const user = userEvent.setup();
		render(<ProbeForm action={action} check={() => ({ photos: 'Add at least one photo.' })} />);

		await saveName(user);

		const problem = screen.getByText('Add at least one photo.');
		expect(document.activeElement).toBe(problem);
		expect(screen.queryByText('Enter a name.')).toBeNull();
		expect(action).not.toHaveBeenCalled();
	});

	it('sends once the browser finds nothing, and the action’s result replaces the browser’s', async () => {
		const action = vi.fn(succeed);
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(<ProbeForm action={action} onSubmit={onSubmit} />);

		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(screen.getByText('Enter a name.')).toBeDefined();
		await saveName(user);

		expect(await screen.findByText('Saved.')).toBeDefined();
		expect(screen.queryByText('Enter a name.')).toBeNull();
		expect(onSubmit).toHaveBeenCalledOnce();
		expect(action).toHaveBeenCalledOnce();
	});

	it('leaves a form in a popup inside it to that form', async () => {
		const outerAction = vi.fn(succeed);
		const innerAction = vi.fn<(formData: FormData) => void>();
		const reported = vi.fn();
		window.addEventListener('error', reported);
		const user = userEvent.setup();
		render(
			<ProbeForm action={outerAction}>
				{/* A dialog's form renders outside the form in the page, but inside it in React's tree. */}
				{createPortal(
					<form action={innerAction}>
						<button type="submit">Confirm</button>
					</form>,
					document.body
				)}
			</ProbeForm>
		);

		await user.click(screen.getByRole('button', { name: 'Confirm' }));
		window.removeEventListener('error', reported);

		expect(innerAction).toHaveBeenCalledOnce();
		expect(reported).not.toHaveBeenCalled();
		expect(screen.queryByText('Enter a name.')).toBeNull();
		expect(outerAction).not.toHaveBeenCalled();
	});
});
