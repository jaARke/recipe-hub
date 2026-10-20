import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { TextField } from '@/components/forms/text-field';
import { TextareaField } from '@/components/forms/textarea-field';

const note = { message: 'Check it against the original.', onConfirm: () => {} };

describe('an optional text field', () => {
	it('says so in its label, and its note names the field without it', async () => {
		await render(
			<>
				<TextField id="source" label="Source" optional note={note} />
				<TextareaField id="notes" label="Notes" optional note={note} />
			</>
		);

		await expect
			.element(page.getByRole('textbox', { name: 'Source (optional)', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('textbox', { name: 'Notes (optional)', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Looks right: Source', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Looks right: Notes', exact: true }))
			.toBeInTheDocument();
	});

	it('shows a required field’s label as it is', async () => {
		await render(<TextField id="title" label="Title" />);

		await expect
			.element(page.getByRole('textbox', { name: 'Title', exact: true }))
			.toBeInTheDocument();
	});
});
