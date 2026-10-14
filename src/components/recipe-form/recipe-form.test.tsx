import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormAction } from '@/components/forms/form-state';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import type { AutosavedRecipeForm } from '@/components/recipe-form/recipe-form-autosave';
import type { EditedRecipe } from '@/components/recipe-form/recipe-form-fields';
import {
	editRecipeForm,
	recipeFormValues,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
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
	renderFormFrom(recipeFormValues(content, problems), action);
}

function renderFormFrom(initial: RecipeFormValues, action: FormAction = refuse) {
	render(
		<RecipeForm
			initial={initial}
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
		expect(screen.queryByText(/^Fix \d+ things? to save$/)).toBeNull();
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
		expect(screen.getByText('Checked. 2 left.').closest('[role="status"]')).not.toBeNull();
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

	it('moves Next to the open note after where focus last was in the form, wrapping past the last', async () => {
		const user = userEvent.setup();
		renderForm(lemonBars, threeNotes);
		const next = screen.getByRole('button', { name: 'Next' });
		const count = () => document.getElementById(next.getAttribute('aria-describedby') ?? '');
		expect(count()?.textContent).toBe('3 to check');

		await user.click(next);
		expect(document.activeElement).toBe(noteWith('Check the title.'));
		await user.click(next);
		expect(document.activeElement).toBe(noteWith('Check this line.'));
		await user.click(next);
		expect(document.activeElement).toBe(noteWith('Check this step.'));
		await user.click(next);
		expect(document.activeElement).toBe(noteWith('Check the title.'));

		await user.click(screen.getByRole('textbox', { name: 'Ingredient 1' }));
		await user.click(next);
		expect(document.activeElement).toBe(noteWith('Check this line.'));

		await user.click(lookRight('Ingredient 2'));
		expect(document.activeElement).toBe(noteWith('Check this step.'));
		expect(count()?.textContent).toBe('2 to check');
		await user.click(next);
		expect(document.activeElement).toBe(noteWith('Check the title.'));
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
		expect(await screen.findByText('Fix 1 thing to save')).toBeDefined();
		expect(screen.getByText('Check the title.')).toBeDefined();
		expect(screen.getByText('Check this line.')).toBeDefined();
		expect(screen.queryByText('Check this step.')).toBeNull();
		expect(screen.getByText('2 things need a second look')).toBeDefined();
		// Only the save's error marks its field invalid.
		expect(
			Array.from(document.querySelectorAll('[aria-invalid="true"]'), (element) => element.id)
		).toEqual([screen.getByRole('textbox', { name: 'Ingredient 1' }).id]);
	});

	it('shows what the save needs before asking about notes, and clears it as it asks once it can save', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		renderForm({ ...lemonBars, title: undefined }, threeNotes.slice(1), action);
		const title = screen.getByRole('textbox', { name: 'Title' });

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		const summary = screen.getByText('Fix 1 thing to save').closest('[role="alert"]');
		expect(document.activeElement).toBe(summary);
		expect(screen.getByRole('link', { name: 'Title: Enter a title.' })).toBeDefined();
		expect(title.getAttribute('aria-invalid')).toBe('true');
		expect(screen.queryByRole('alertdialog')).toBeNull();
		expect(action).not.toHaveBeenCalled();

		await user.type(title, 'Lemon bars');
		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		const dialog = await screen.findByRole('alertdialog');
		expect(within(dialog).getByText('2 things haven’t been checked')).toBeDefined();
		expect(screen.queryByText('Fix 1 thing to save')).toBeNull();
		expect(screen.queryByText('Enter a title.')).toBeNull();
		expect(title.getAttribute('aria-invalid')).toBeNull();
		expect(action).not.toHaveBeenCalled();
	});

	it('asks for the ingredients and steps a recipe needs before any request', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		renderForm({ title: 'Lemon bars' }, [], action);

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		expect(screen.getByText('Fix 2 things to save')).toBeDefined();
		expect(
			screen.getByRole('link', { name: 'Ingredients: Add at least one ingredient.' })
		).toBeDefined();
		expect(screen.getByRole('link', { name: 'Steps: Add at least one step.' })).toBeDefined();
		expect(action).not.toHaveBeenCalled();
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

describe('RecipeForm’s original recipe', () => {
	it('shows the stored scans beside the form and in the viewer, numbered as the viewer numbers them', async () => {
		const user = userEvent.setup();
		const saved = 'scan/development/front.jpg';
		const values = recipeFormValues({ ...lemonBars, images: [{ role: 'scan', pathname: saved }] });
		const uploaded = values.nextId;
		const failed = uploaded + 1;
		const uploading = uploaded + 2;
		const jpeg = (name: string) =>
			new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, { type: 'image/jpeg' });
		// Ahead of the saved scan: an upload done, one that failed, and one still uploading.
		const edits: RecipeFormEdit[] = [
			{ type: 'addPhotos', role: 'scan', fileNames: ['back.jpg', 'bad.jpg', 'wip.jpg'] },
			{
				type: 'startPhotoUpload',
				photoId: uploaded,
				pathname: 'scan/development/back.jpg',
				file: jpeg('back.jpg'),
			},
			{ type: 'finishPhotoUpload', photoId: uploaded },
			{ type: 'failPhoto', photoId: failed, failure: 'upload' },
			{
				type: 'startPhotoUpload',
				photoId: uploading,
				pathname: 'scan/development/wip.jpg',
				file: jpeg('wip.jpg'),
			},
			{ type: 'movePhoto', photoId: failed, toIndex: 0 },
			{ type: 'movePhoto', photoId: uploaded, toIndex: 1 },
			{ type: 'movePhoto', photoId: uploading, toIndex: 2 },
		];
		renderFormFrom(edits.reduce(editRecipeForm, values));

		// The upload shows from its file until it's saved, so it is never downloaded.
		const pane = screen.getByRole('complementary', { name: 'Original recipe' });
		expect(within(pane).getByRole('status').textContent).toBe('Page 1 of 2');
		expect(within(pane).getByRole('img').getAttribute('src')).toMatch(/^blob:/);

		await user.click(within(pane).getByRole('button', { name: 'Next page' }));
		expect(within(pane).getByRole('status').textContent).toBe('Page 2 of 2');
		expect(within(pane).getByRole('img').getAttribute('src')).toBe(`/api/images/${saved}`);

		// A row the viewer holds opens it at the place the row names; the others have no place in it.
		const rows = within(screen.getByRole('list', { name: 'Original recipe' })).getAllByRole(
			'listitem'
		);
		expect(
			rows.map((row) => ({
				name: row.querySelector('[data-slot="attachment-title"]')?.textContent,
				opens: within(row)
					.queryByRole('button', { name: /^View page/ })
					?.getAttribute('aria-label'),
			}))
		).toEqual([
			{ name: 'bad.jpg', opens: undefined },
			{ name: 'back.jpg', opens: 'View page 1 of 2' },
			{ name: 'wip.jpg', opens: undefined },
			{ name: 'Page 2', opens: 'View page 2 of 2' },
		]);
		expect(screen.getByRole('button', { name: 'View original' })).toBeDefined();
	});
});

describe('RecipeForm’s photos', () => {
	it('calls the first stored photo the cover, as saving makes it, past a failed or unfinished one', () => {
		const values = recipeFormValues({
			...lemonBars,
			images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
		});
		const uploading = values.nextId;
		const failed = uploading + 1;
		const edits: RecipeFormEdit[] = [
			{ type: 'addPhotos', role: 'dish', fileNames: ['wip.jpg', 'bad.jpg'] },
			{
				type: 'startPhotoUpload',
				photoId: uploading,
				pathname: 'dish/development/wip.jpg',
				file: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'wip.jpg', {
					type: 'image/jpeg',
				}),
			},
			{ type: 'failPhoto', photoId: failed, failure: 'upload' },
			{ type: 'movePhoto', photoId: uploading, toIndex: 0 },
			{ type: 'movePhoto', photoId: failed, toIndex: 1 },
		];
		renderFormFrom(edits.reduce(editRecipeForm, values));

		const rows = within(screen.getByRole('list', { name: 'Photos' })).getAllByRole('listitem');
		expect(
			rows.map((row) => ({
				name: row.querySelector('[data-slot="attachment-title"]')?.textContent,
				status: row.querySelector('[data-slot="attachment-description"]')?.textContent,
			}))
		).toEqual([
			{ name: 'wip.jpg', status: 'Uploading' },
			{ name: 'bad.jpg', status: 'Didn’t upload' },
			{ name: 'Photo 1', status: 'Cover photo' },
		]);
	});
});

describe('RecipeForm’s lists', () => {
	function textbox(name: string): HTMLTextAreaElement {
		const element = screen.getByRole('textbox', { name });
		if (!(element instanceof HTMLTextAreaElement)) {
			throw new Error(`${name} is no textarea.`);
		}
		return element;
	}

	// Each row as its label and its text, in order.
	function rowTexts(legend: string): string[] {
		return within(screen.getByRole('list', { name: legend }))
			.getAllByRole<HTMLTextAreaElement>('textbox')
			.map((row) => `${row.labels?.[0]?.textContent}: ${row.value}`);
	}

	function expectAnnounced(text: string) {
		expect(screen.getByText(text).closest('[role="status"]')).not.toBeNull();
	}

	async function choose(user: ReturnType<typeof userEvent.setup>, row: string, action: string) {
		await user.click(screen.getByRole('button', { name: `Actions for ${row}` }));
		await user.click(await screen.findByRole('menuitem', { name: action }));
	}

	it('shows how a line without an amount reads once tidied, and nothing when it reads as typed', () => {
		renderForm({
			...lemonBars,
			ingredientSections: [{ lines: [{ text: 'Salt to taste;' }, { text: 'Pepper to taste' }] }],
		});

		const previews = Array.from(
			screen.getByRole('list', { name: 'Ingredients' }).querySelectorAll('[id$="-preview"]'),
			(preview) => preview.textContent
		);
		expect(previews).toEqual(['Shows as Salt to taste']);
	});

	it('adds a line below on Enter and removes an empty one on Backspace, announcing each', async () => {
		const user = userEvent.setup();
		renderForm(lemonBars);

		await user.click(textbox('Ingredient 1'));
		await user.keyboard('{Enter}');

		expect(rowTexts('Ingredients')).toEqual([
			'Ingredient 1: 1 cup flour',
			'Ingredient 2: ',
			'Ingredient 3: 2 eggs',
		]);
		expect(document.activeElement).toBe(textbox('Ingredient 2'));
		expectAnnounced('Added Ingredient 2.');

		await user.keyboard('{Backspace}');

		expect(rowTexts('Ingredients')).toEqual(['Ingredient 1: 1 cup flour', 'Ingredient 2: 2 eggs']);
		const above = textbox('Ingredient 1');
		expect(document.activeElement).toBe(above);
		expect(above.selectionStart).toBe(above.value.length);
		expectAnnounced('Removed Ingredient 2.');

		// Backspace in a line with text deletes text, as it always does.
		await user.keyboard('{Backspace}');
		expect(rowTexts('Ingredients')).toEqual(['Ingredient 1: 1 cup flou', 'Ingredient 2: 2 eggs']);
	});

	it('splits a pasted list into lines and headings, without bullets, and announces it', async () => {
		const user = userEvent.setup();
		renderForm({ ...lemonBars, ingredientSections: undefined });

		await user.click(textbox('Ingredient 1'));
		await user.paste('• 2 cups flour\n• 1 teaspoon salt\n\nFor the glaze:\n1. 1 cup sugar\n');

		expect(rowTexts('Ingredients')).toEqual([
			'Ingredient 1: 2 cups flour',
			'Ingredient 2: 1 teaspoon salt',
			'Ingredient heading 1: For the glaze',
			'Ingredient 1, For the glaze: 1 cup sugar',
		]);
		expect(document.activeElement).toBe(textbox('Ingredient 1, For the glaze'));
		expectAnnounced('Pasted 3 ingredients and 1 heading.');

		// A single line pastes as usual, at the caret.
		await user.paste(', sifted');
		expect(textbox('Ingredient 1, For the glaze').value).toBe('1 cup sugar, sifted');
	});

	it('announces a message again when it repeats', async () => {
		const user = userEvent.setup();
		renderForm({ ...lemonBars, ingredientSections: undefined });

		await user.click(textbox('Ingredient 1'));
		await user.paste('2 cups flour\n1 teaspoon salt');
		const first = screen.getByText('Pasted 2 ingredients.');
		const region = first.closest('[role="status"]');
		await user.paste('2 eggs\n1 cup milk');
		const second = screen.getByText('Pasted 2 ingredients.');

		// The region stays, and the message arrives in it as a new node, which screen readers read.
		expect(second).not.toBe(first);
		expect(first.isConnected).toBe(false);
		expect(second.closest('[role="status"]')).toBe(region);
	});

	it('changes a line to a heading over the lines after it', async () => {
		const user = userEvent.setup();
		renderForm({
			...lemonBars,
			ingredientSections: [
				{ lines: [{ text: '1 cup flour' }, { text: 'For the glaze' }, { text: '1 cup sugar' }] },
			],
		});

		await choose(user, 'Ingredient 2', 'Change to heading');

		expect(rowTexts('Ingredients')).toEqual([
			'Ingredient 1: 1 cup flour',
			'Ingredient heading 1: For the glaze',
			'Ingredient 1, For the glaze: 1 cup sugar',
		]);
		expectAnnounced('Changed “For the glaze” to Ingredient heading 1.');
		// The row keeps its menu, which takes focus back and now offers the way back.
		const trigger = screen.getByRole('button', { name: 'Actions for Ingredient heading 1' });
		await waitFor(() => expect(document.activeElement).toBe(trigger));
		await user.click(trigger);
		expect(await screen.findByRole('menuitem', { name: 'Change to ingredient' })).toBeDefined();
	});

	it('keeps a removed heading’s lines, which join the lines above it', async () => {
		const user = userEvent.setup();
		renderForm({
			...lemonBars,
			ingredientSections: [
				{ lines: [{ text: '1 cup flour' }] },
				{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] },
			],
		});

		await choose(user, 'Ingredient heading 1', 'Remove');

		expect(rowTexts('Ingredients')).toEqual([
			'Ingredient 1: 1 cup flour',
			'Ingredient 2: 1 cup sugar',
		]);
		expect(document.activeElement).toBe(textbox('Ingredient 1'));
		expectAnnounced('Removed Ingredient heading 1. The ingredient under it stays.');
		const sent = document.querySelector<HTMLInputElement>('input[name="recipe"]')?.value ?? '{}';
		expect(JSON.parse(sent)).toMatchObject({
			ingredientSections: [{ lines: ['1 cup flour', '1 cup sugar'] }],
		});
	});

	it('shows a save’s problem with a heading that has nothing under it at the heading', async () => {
		const user = userEvent.setup();
		renderForm(
			{
				...lemonBars,
				ingredientSections: [
					{ lines: [{ text: '1 cup flour' }] },
					{ heading: 'For the glaze', lines: [] },
				],
			},
			[],
			async () => ({
				status: 'error',
				fieldErrors: { 'ingredientSections.1.lines': 'Add at least one ingredient.' },
			})
		);

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		const link = await screen.findByRole('link', {
			name: 'Ingredients, For the glaze: Add at least one ingredient.',
		});
		const heading = textbox('Ingredient heading 1');
		expect(link.getAttribute('href')).toBe(`#${heading.id}`);
		expect(heading.getAttribute('aria-invalid')).toBe('true');
		const description = heading.getAttribute('aria-describedby') ?? '';
		expect(description.split(' ').map((id) => document.getElementById(id)?.textContent)).toContain(
			'Add at least one ingredient.'
		);
	});
});

describe('RecipeForm’s autosave', () => {
	const newRecipeKey = 'member:recipe-form:new';
	const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
	const importId = '6d2b9f4a-8e1c-4b7d-a3f5-1c9e7d2b6a84';

	type AutosavedFormProps = {
		initial?: RecipeFormValues;
		action?: FormAction;
		editing?: EditedRecipe;
		importId?: string;
	};

	function AutosavedForm({
		initial = recipeFormValues(),
		action = refuse,
		editing,
		importId: reviewed,
	}: AutosavedFormProps) {
		return (
			<RecipeForm
				initial={initial}
				action={action}
				uploadFolders={uploadFolders}
				tagLabels={[]}
				uploader={vi.fn()}
				editing={editing}
				importId={reviewed}
				autosave
				submitLabel="Save recipe"
			/>
		);
	}

	function stored(key: string): AutosavedRecipeForm | undefined {
		const entry = localStorage.getItem(key);
		return entry === null ? undefined : (JSON.parse(entry) as AutosavedRecipeForm);
	}

	function title(): HTMLInputElement {
		return screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' });
	}

	const blankText = {
		title: '',
		description: '',
		source: '',
		notes: '',
		prepMinutes: '',
		cookMinutes: '',
		totalMinutes: '',
		yieldAmount: '',
		yieldUnit: '',
		tagDraft: '',
	};

	// A new recipe that can save, as a reload left it: a title, a line, a step, and two uploads, the
	// second of which the sweep has since removed.
	const storedNewRecipe: AutosavedRecipeForm = {
		text: { ...blankText, title: 'Lemon bars' },
		yieldKind: 'servings',
		ingredientSections: { rows: [{ kind: 'item', id: 0, text: '1 cup flour' }] },
		instructionSections: { rows: [{ kind: 'item', id: 1, text: 'Bake.' }] },
		tags: [],
		photos: {
			dish: [
				{ id: 2, fileName: 'kept.jpg', alt: 'Bars', pathname: 'dish/development/kept.jpg' },
				{ id: 3, fileName: 'swept.jpg', alt: '', pathname: 'dish/development/swept.jpg' },
			],
			scan: [],
		},
		reviewNotes: [],
		nextId: 4,
	};

	// Answers the image route's lookups: the swept upload is gone, and every other photo is stored.
	function answerLookups() {
		const fetch = vi.fn(
			async (url: string) => new Response(null, { status: url.includes('swept') ? 404 : 200 })
		);
		vi.stubGlobal('fetch', fetch);
		return fetch;
	}

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	it('offers a half-filled new recipe back as the form loads again, and Discard clears it', async () => {
		const user = userEvent.setup();
		const first = render(<AutosavedForm />);
		await user.type(title(), 'Lemon bars');
		await user.type(screen.getByRole('textbox', { name: 'Ingredient 1' }), '1 cup flour');
		expect(stored(newRecipeKey)?.text.title).toBe('Lemon bars');
		first.unmount();

		render(<AutosavedForm />);

		expect(await screen.findByText('Restored your unsaved changes')).toBeDefined();
		expect(
			screen.getByText('Restored your unsaved changes.').closest('[role="status"]')
		).not.toBeNull();
		expect(title().value).toBe('Lemon bars');
		expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ingredient 1' }).value).toBe(
			'1 cup flour'
		);

		await user.click(screen.getByRole('button', { name: 'Discard unsaved changes' }));

		expect(title().value).toBe('');
		expect(screen.queryByText('Restored your unsaved changes')).toBeNull();
		expect(screen.getByText('Discarded your unsaved changes.')).toBeDefined();
		expect(document.activeElement).toBe(title());
		expect(localStorage.getItem(newRecipeKey)).toBeNull();
	});

	it('keeps nothing for a form as it loaded, and nothing once it is back to that', async () => {
		const user = userEvent.setup();
		render(<AutosavedForm />);
		expect(localStorage.getItem(newRecipeKey)).toBeNull();

		await user.type(title(), 'L');
		expect(stored(newRecipeKey)?.text.title).toBe('L');
		await user.clear(title());
		expect(localStorage.getItem(newRecipeKey)).toBeNull();

		// A line added and removed again leaves only a higher next id.
		await user.type(screen.getByRole('textbox', { name: 'Ingredient 1' }), '{Enter}');
		expect(screen.getByRole('textbox', { name: 'Ingredient 2' })).toBeDefined();
		await user.keyboard('{Backspace}');
		expect(screen.queryByRole('textbox', { name: 'Ingredient 2' })).toBeNull();
		expect(localStorage.getItem(newRecipeKey)).toBeNull();
	});

	it('keeps the changes when a save is refused, or never reaches the site', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		localStorage.setItem(newRecipeKey, JSON.stringify(storedNewRecipe));
		answerLookups();
		render(<AutosavedForm action={action} />);
		await screen.findByText('Restored your unsaved changes');

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));
		expect(await screen.findByText('Fix 1 thing to save')).toBeDefined();
		expect(stored(newRecipeKey)?.text.title).toBe('Lemon bars');

		action.mockImplementation(async () => {
			throw new TypeError('Failed to fetch');
		});
		await user.click(screen.getByRole('button', { name: 'Save recipe' }));
		expect(
			await screen.findByText('We couldn’t save the recipe. Check your connection and try again.')
		).toBeDefined();
		expect(action).toHaveBeenCalledTimes(2);
		expect(stored(newRecipeKey)?.text.title).toBe('Lemon bars');
	});

	it('clears the changes before a save leads to the saved recipe', async () => {
		// React reports the error the page's boundary catches.
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const user = userEvent.setup();
		localStorage.setItem(newRecipeKey, JSON.stringify(storedNewRecipe));
		answerLookups();
		render(
			<LeavingPage>
				<AutosavedForm action={async () => redirect('/recipes/lemon-bars')} />
			</LeavingPage>
		);
		await screen.findByText('Restored your unsaved changes');

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		expect(await screen.findByText('Left for the recipe')).toBeDefined();
		expect(localStorage.getItem(newRecipeKey)).toBeNull();
	});

	it('shows a restored upload the sweep removed as one that didn’t upload, and saves the rest', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		localStorage.setItem(newRecipeKey, JSON.stringify(storedNewRecipe));
		const fetch = answerLookups();
		render(<AutosavedForm action={action} />);
		await screen.findByText('Restored your unsaved changes');

		expect(fetch.mock.calls.map(([url]) => url)).toEqual([
			'/api/images/dish/development/kept.jpg',
			'/api/images/dish/development/swept.jpg',
		]);
		const rows = within(screen.getByRole('list', { name: 'Photos' })).getAllByRole('listitem');
		expect(
			rows.map((row) => ({
				name: row.querySelector('[data-slot="attachment-title"]')?.textContent,
				status: row.querySelector('[data-slot="attachment-description"]')?.textContent,
			}))
		).toEqual([
			{ name: 'kept.jpg', status: 'Cover photo' },
			{ name: 'swept.jpg', status: 'Didn’t upload' },
		]);
		expect(
			within(rows[1] as HTMLElement).getByText(
				'This photo didn’t upload. Remove it and add it again.'
			)
		).toBeDefined();

		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		await waitFor(() => expect(action).toHaveBeenCalledOnce());
		const sent = action.mock.calls[0]?.[1].get('recipe');
		expect(JSON.parse(typeof sent === 'string' ? sent : '{}').images).toEqual([
			{ role: 'dish', pathname: 'dish/development/kept.jpg', alt: 'Bars' },
		]);
	});

	it('brings an edit back only to the version of the recipe it was made on', async () => {
		const user = userEvent.setup();
		const editing = (version: string) => ({ id: recipeId, version, respellableTags: [] });
		const first = render(
			<AutosavedForm
				initial={recipeFormValues(lemonBars)}
				editing={editing('2026-10-14T12:00:00.000Z')}
			/>
		);
		await user.type(title(), ' squares');
		expect(stored(`member:recipe-form:recipe:${recipeId}`)?.version).toBe(
			'2026-10-14T12:00:00.000Z'
		);
		first.unmount();

		render(
			<AutosavedForm
				initial={recipeFormValues(lemonBars)}
				editing={editing('2026-10-15T09:30:00.000Z')}
			/>
		);

		expect(title().value).toBe('Lemon bars');
		expect(screen.queryByText('Restored your unsaved changes')).toBeNull();
		expect(localStorage.getItem(`member:recipe-form:recipe:${recipeId}`)).toBeNull();
	});

	it('brings an import’s review back with its notes as they were', async () => {
		const user = userEvent.setup();
		const initial = recipeFormValues(lemonBars, threeNotes);
		const first = render(<AutosavedForm initial={initial} importId={importId} />);
		await user.click(lookRight('Ingredient 2'));
		expect(stored(`member:recipe-form:import:${importId}`)).toBeDefined();
		first.unmount();

		render(<AutosavedForm initial={initial} importId={importId} />);

		expect(await screen.findByText('Restored your unsaved changes')).toBeDefined();
		expect(screen.getByText('2 things need a second look')).toBeDefined();
		expect(screen.queryByText('Check this line.')).toBeNull();
		expect(screen.getByText('Check this step.')).toBeDefined();
	});

	it('keeps the notice while its page is hidden and shown again, and never brings back what it discarded', async () => {
		const user = userEvent.setup();
		localStorage.setItem(newRecipeKey, JSON.stringify(storedNewRecipe));
		answerLookups();
		const page = renderKeptPage(<AutosavedForm />);
		await screen.findByText('Restored your unsaved changes');

		await page.hide();
		await page.show();
		expect(screen.getByText('Restored your unsaved changes')).toBeDefined();

		await user.click(screen.getByRole('button', { name: 'Discard unsaved changes' }));
		await user.type(title(), 'Lemon tart');
		await page.hide();
		await page.show();

		expect(screen.queryByText('Restored your unsaved changes')).toBeNull();
		expect(title().value).toBe('Lemon tart');
		expect(stored(newRecipeKey)?.text.title).toBe('Lemon tart');
	});

	it('works as without it where the browser blocks storage', async () => {
		const action = vi.fn(refuse);
		const user = userEvent.setup();
		vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		});
		render(<AutosavedForm initial={recipeFormValues(lemonBars)} action={action} />);

		await user.type(title(), ' squares');
		await user.click(screen.getByRole('button', { name: 'Save recipe' }));

		await waitFor(() => expect(action).toHaveBeenCalledOnce());
		expect(screen.queryByText('Restored your unsaved changes')).toBeNull();
	});
});

// Stands in for Next's boundary, which catches the redirect a save ends with.
class LeavingPage extends React.Component<{ children: React.ReactNode }, { left: boolean }> {
	state = { left: false };

	static getDerivedStateFromError() {
		return { left: true };
	}

	render() {
		return this.state.left ? <p>Left for the recipe</p> : this.props.children;
	}
}
