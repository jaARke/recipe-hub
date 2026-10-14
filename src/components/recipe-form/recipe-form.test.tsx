import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/components/forms/form-state';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import type { Problem } from '@/domain/problem';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';

const uploadFolders = { dish: 'dish/development/', scan: 'scan/development/' };

const lemonBars: RecipeDraftContent = {
	title: 'Lemon bars',
	ingredientSections: [{ lines: [{ text: '1 cup flour' }, { text: '2 eggs' }] }],
	instructionSections: [{ steps: [{ text: 'Mix.' }] }],
};

const threeNotes: Problem[] = [
	{ path: 'title', message: 'Check the title.' },
	{ path: 'ingredientSections.0.lines.1', message: 'Check this line.' },
	{ path: 'instructionSections.0.steps.0', message: 'Check this step.' },
];

// Refuses every save, so the form stays and shows what came back.
const refuse: FormAction = async () => ({
	status: 'error',
	fieldErrors: { 'ingredientSections.0.lines.0': 'Enter an amount.' },
});

function renderForm(
	content: RecipeDraftContent,
	problems: readonly Problem[] = [],
	action: FormAction = refuse
) {
	render(
		<RecipeForm
			initial={recipeFormValues(content, problems)}
			action={action}
			uploadFolders={uploadFolders}
			tagLabels={[]}
			uploader={vi.fn()}
			submitLabel="Save recipe"
		/>
	);
}

// The note holding this text, which is what takes focus.
function noteWith(text: string): HTMLElement {
	const note = screen.getByText(text).closest<HTMLElement>('[data-slot="alert"]');
	if (note === null) {
		throw new Error(`No note holds “${text}”.`);
	}
	return note;
}

function lookRight(name: string): HTMLElement {
	return screen.getByRole('button', { name: `Looks right: ${name}` });
}

describe('RecipeForm’s review notes', () => {
	it('shows each note under its field and an intro, with no summary or invalid field', () => {
		renderForm(lemonBars, threeNotes);

		expect(screen.getByText('3 things need a second look')).toBeDefined();
		expect(screen.getAllByText('Check')).toHaveLength(3);
		expect(screen.getAllByRole('button', { name: /^Looks right/ })).toHaveLength(3);
		expect(screen.queryByText(/^Check \d+ things?$/)).toBeNull();
		expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
		expect(
			screen.getByRole('textbox', { name: 'Ingredient 2' }).getAttribute('aria-describedby')
		).toContain(noteWith('Check this line.').id);
	});

	it('moves focus to the next open note as each looks right, and announces what is left', async () => {
		const user = userEvent.setup();
		renderForm(lemonBars, threeNotes);

		await user.click(lookRight('Ingredient 2'));
		expect(document.activeElement).toBe(noteWith('Check this step.'));
		expect(screen.getByText('Checked. 2 left.').getAttribute('role')).toBe('status');
		expect(screen.queryByText('Check this line.')).toBeNull();
		expect(screen.getByText('2 things need a second look')).toBeDefined();

		// After the last note, the first one left comes next.
		await user.click(lookRight('Step 1'));
		expect(document.activeElement).toBe(noteWith('Check the title.'));
		expect(screen.getByText('Checked. 1 left.')).toBeDefined();

		await user.click(lookRight('Title'));
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save recipe' }));
		expect(screen.getByText('Checked. Nothing left to check.')).toBeDefined();
		expect(screen.queryByText(/need a second look/)).toBeNull();
	});

	it('starts checking at the first note', async () => {
		const user = userEvent.setup();
		renderForm(lemonBars, threeNotes);

		await user.click(screen.getByRole('button', { name: 'Start checking' }));

		expect(document.activeElement).toBe(noteWith('Check the title.'));
	});

	it('clears a note when its field is edited, and offers no Looks right on an empty title', async () => {
		const user = userEvent.setup();
		renderForm({ ...lemonBars, title: undefined }, [
			{ path: 'title', message: 'Add a title. The original doesn’t show one.' },
		]);

		const note = noteWith('Add a title. The original doesn’t show one.');
		expect(within(note).queryByRole('button')).toBeNull();

		await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Lemon bars');

		expect(screen.queryByText('Add a title. The original doesn’t show one.')).toBeNull();
		expect(screen.queryByText(/need a second look/)).toBeNull();
	});

	it('asks before saving with notes open; Show me goes to the first and saves nothing', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		renderForm(lemonBars, threeNotes, action);

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));
		const dialog = await screen.findByRole('alertdialog');
		expect(within(dialog).getByText('3 things haven’t been checked')).toBeDefined();

		await user.click(within(dialog).getByRole('button', { name: 'Show me' }));

		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(noteWith('Check the title.')));
		expect(action).not.toHaveBeenCalled();
	});

	it('saves anyway when asked, and keeps the open notes when the save fails', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		renderForm(lemonBars, threeNotes, action);

		await user.click(lookRight('Step 1'));
		await user.click(screen.getByRole('button', { name: 'Save recipe' }));
		const dialog = await screen.findByRole('alertdialog');
		expect(within(dialog).getByText('2 things haven’t been checked')).toBeDefined();
		await user.click(within(dialog).getByRole('button', { name: 'Save anyway' }));

		await waitFor(() => expect(action).toHaveBeenCalledOnce());
		expect(await screen.findByText('Check 1 thing')).toBeDefined();
		expect(screen.getByText('Check the title.')).toBeDefined();
		expect(screen.getByText('Check this line.')).toBeDefined();
		expect(screen.queryByText('Check this step.')).toBeNull();
		expect(screen.getByText('2 things need a second look')).toBeDefined();
		// Only the save's error marks its field invalid.
		expect(
			Array.from(document.querySelectorAll('[aria-invalid="true"]'), (element) => element.id)
		).toEqual([screen.getByRole('textbox', { name: 'Ingredient 1' }).id]);
	});

	it('saves without asking once nothing is left to check', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		renderForm(lemonBars, [], action);

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		await waitFor(() => expect(action).toHaveBeenCalledOnce());
		expect(screen.queryByRole('alertdialog')).toBeNull();
	});

	it('marks a transcription marker left in a line, and asks before saving it', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		renderForm(
			{ ...lemonBars, ingredientSections: [{ lines: [{ text: '1 cup [illegible] flour' }] }] },
			[],
			action
		);

		const marks = Array.from(document.querySelectorAll('mark'), (mark) => mark.textContent);
		expect(marks).toEqual(['[illegible]']);
		expect(screen.getByText('1 thing needs a second look')).toBeDefined();
		expect(screen.queryByRole('button', { name: /^Looks right/ })).toBeNull();

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		const dialog = await screen.findByRole('alertdialog');
		expect(within(dialog).getByText('1 thing hasn’t been checked')).toBeDefined();
		expect(action).not.toHaveBeenCalled();
	});
});
