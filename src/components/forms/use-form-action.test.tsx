import type * as React from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FieldErrors, FormAction, FormState } from '@/components/forms/form-state';
import { heldResult } from '@/components/forms/testing/held-result';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useFormAction } from '@/components/forms/use-form-action';

type ProbeFormProps = {
	action: FormAction;
	check?: () => FieldErrors;
	onSubmit?: (event: React.SubmitEvent<HTMLFormElement>) => void;
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

function nameField() {
	return page.getByRole('textbox', { name: 'Name' });
}

function saveButton() {
	return page.getByRole('button', { name: 'Save' });
}

// Types a name, so the browser's check finds nothing, then saves.
async function saveName(name = 'Ada') {
	await nameField().fill(name);
	await saveButton().click();
}

describe('useFormAction', () => {
	it('reads a success as idle after its page was hidden', async () => {
		const keptPage = await renderKeptPage(<ProbeForm action={succeed} />);

		await saveName();
		await expect.element(page.getByText('Saved.')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await expect.element(page.getByText('Saved.')).not.toBeInTheDocument();
	});

	it('keeps a refusal’s field error and typed text, not its message, after its page was hidden', async () => {
		const keptPage = await renderKeptPage(<ProbeForm action={refuse} />);

		await saveName();
		await expect.element(page.getByText('Check the name.')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await expect.element(page.getByText('Check the name.')).not.toBeInTheDocument();
		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await expect.element(nameField()).toHaveValue('Ada');
	});

	it('clears the message before the page shows again', async () => {
		const keptPage = await renderKeptPage(<ProbeForm action={refuse} />);

		await saveName();
		await expect.element(page.getByText('Check the name.')).toBeVisible();
		await keptPage.hide();

		expect(document.body.textContent).not.toContain('Check the name.');
	});

	it('shows a result that arrives while its page is hidden', async () => {
		const { promise, resolve } = heldResult<FormState>({ status: 'success' });
		const action = vi.fn<FormAction>().mockImplementationOnce(refuse).mockReturnValueOnce(promise);
		const keptPage = await renderKeptPage(<ProbeForm action={action} />);

		await saveName();
		await expect.element(page.getByText('Check the name.')).toBeVisible();
		await saveButton().click();
		await keptPage.hide();
		resolve({ status: 'success' });
		await expect.poll(() => document.body.textContent).toContain('Saved.');
		await keptPage.show();

		await expect.element(page.getByText('Saved.')).toBeVisible();
	});

	it('moves focus to a refusal once, not again when its page shows', async () => {
		const keptPage = await renderKeptPage(<ProbeForm action={refuse} />);

		await saveName();
		await expect.element(page.getByRole('alert')).toHaveFocus();
		await keptPage.hide();
		await keptPage.show();

		expect(document.activeElement).toBe(document.body);
	});

	it('moves focus to the first field the server refused', async () => {
		await render(
			<ProbeForm
				action={async () => ({
					status: 'error',
					fieldErrors: { name: 'Use 60 characters or fewer.' },
				})}
			/>
		);

		await saveName();

		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await expect.element(nameField()).toHaveFocus();
	});

	it('refuses a blank required field at once, before any request, with focus on it', async () => {
		const action = vi.fn(succeed);
		const onSubmit = vi.fn();
		await render(<ProbeForm action={action} onSubmit={onSubmit} />);

		// Blank once trimmed, as the server reads it.
		await saveName('   ');

		await expect.element(page.getByText('Enter a name.')).toBeVisible();
		await expect.element(nameField()).toHaveAttribute('aria-invalid', 'true');
		await expect.element(nameField()).toHaveFocus();
		await expect.element(nameField()).toHaveValue('   ');
		expect(action).not.toHaveBeenCalled();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('shows a custom check’s problems at once, before any request, with focus on the first', async () => {
		const action = vi.fn(succeed);
		await render(
			<ProbeForm action={action} check={() => ({ photos: 'Add at least one photo.' })} />
		);

		await saveName();

		await expect.element(page.getByText('Add at least one photo.')).toHaveFocus();
		await expect.element(page.getByText('Enter a name.')).not.toBeInTheDocument();
		expect(action).not.toHaveBeenCalled();
	});

	it('sends once the browser finds nothing, and the action’s result replaces the browser’s', async () => {
		const action = vi.fn(succeed);
		const onSubmit = vi.fn();
		await render(<ProbeForm action={action} onSubmit={onSubmit} />);

		await saveButton().click();
		await expect.element(page.getByText('Enter a name.')).toBeVisible();
		await saveName();

		await expect.element(page.getByText('Saved.')).toBeVisible();
		await expect.element(page.getByText('Enter a name.')).not.toBeInTheDocument();
		expect(onSubmit).toHaveBeenCalledOnce();
		expect(action).toHaveBeenCalledOnce();
	});

	it('clears what the browser found once it is fixed, though onSubmit stops the submit', async () => {
		const action = vi.fn(succeed);
		await render(<ProbeForm action={action} onSubmit={(event) => event.preventDefault()} />);

		await saveButton().click();
		await expect.element(page.getByText('Enter a name.')).toBeVisible();
		await saveName();

		await expect.element(page.getByText('Enter a name.')).not.toBeInTheDocument();
		await expect.element(nameField()).not.toHaveAttribute('aria-invalid');
		await expect.element(nameField()).toHaveValue('Ada');
		expect(action).not.toHaveBeenCalled();
	});

	it('keeps what the server found when onSubmit stops the next submit', async () => {
		const onSubmit = vi
			.fn<(event: React.SubmitEvent<HTMLFormElement>) => void>()
			.mockImplementationOnce(() => {})
			.mockImplementation((event) => event.preventDefault());
		await render(<ProbeForm action={refuse} onSubmit={onSubmit} />);

		await saveName();
		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await saveName('Ada L.');

		expect(onSubmit).toHaveBeenCalledTimes(2);
		await expect.element(page.getByText('Use 60 characters or fewer.')).toBeVisible();
		await expect.element(nameField()).toHaveAttribute('aria-invalid', 'true');
	});

	it('leaves a form in a popup inside it to that form', async () => {
		const outerAction = vi.fn(succeed);
		const innerAction = vi.fn<(formData: FormData) => void>();
		const reported = vi.fn();
		window.addEventListener('error', reported);
		await render(
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

		await page.getByRole('button', { name: 'Confirm' }).click();
		window.removeEventListener('error', reported);

		expect(innerAction).toHaveBeenCalledOnce();
		expect(reported).not.toHaveBeenCalled();
		await expect.element(page.getByText('Enter a name.')).not.toBeInTheDocument();
		expect(outerAction).not.toHaveBeenCalled();
	});
});
