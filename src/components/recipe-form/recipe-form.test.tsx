import { redirect } from 'next/navigation';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { heldResult } from '@/components/forms/testing/held-result';
import { hydrate, serverRender } from '@/components/forms/testing/hydrate';
import { KeptPage, renderKeptPage } from '@/components/forms/testing/kept-page';
import { HeldDraftProvider } from '@/components/recipe-form/held-draft';
import { RecipeForm } from '@/components/recipe-form/recipe-form';
import type {
	AutosavedRecipeForm,
	ExistingRecipeFormSubjects,
} from '@/components/recipe-form/recipe-form-autosave';
import type { EditedRecipe, SavedDraftResult } from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormSnapshot,
	type RecipeFormSnapshot,
} from '@/components/recipe-form/recipe-form-snapshot';
import {
	editRecipeForm,
	recipeFormValues,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { EditedRecipeMenu, HeldDraftMenu } from '@/components/recipe-form/subject-menus';
import {
	pasteText,
	pressRedo,
	pressUndo,
	sendHistoryInput,
	textControl,
} from '@/components/recipe-form/testing/text-editing';
import type { RecipeFormDrafts } from '@/components/recipe-form/use-draft-saving';
import type { Problem } from '@/domain/problem';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import { daysInMilliseconds, formatDayAndTime } from '@/lib/dates';
import { settings } from '@/lib/settings';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
	...(await importOriginal<typeof import('next/navigation')>()),
	useRouter: () => router,
}));

const uploadFolders = { dish: 'dish/development/', scan: 'scan/development/' };

// A laptop's, from lg, where the original recipe sits beside the fields.
const laptop = { width: 1280, height: 800 };

const lemonBars: RecipeDraftContent = {
	title: 'Lemon bars',
	ingredientSections: [{ lines: [{ text: '1 cup flour' }, { text: '2 eggs' }] }],
	instructionSections: [{ steps: [{ text: 'Mix.' }] }],
	chapter: 'desserts',
};

// Sunday pot roast's steps, with its gravy under a heading of its own.
const potRoast: RecipeDraftContent = {
	...lemonBars,
	instructionSections: [
		{ steps: [{ text: 'Brown the roast.' }, { text: 'Roast until tender.' }] },
		{
			heading: 'For the gravy',
			steps: [{ text: 'Whisk in the flour.' }, { text: 'Simmer until thick.' }],
		},
	],
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

async function renderForm(
	content: RecipeDraftContent,
	problems: readonly Problem[] = [],
	action: FormAction = refuse
) {
	await renderFormFrom(recipeFormValues(content, problems), action);
}

function recipeForm(initial: RecipeFormValues, action: FormAction = refuse) {
	return (
		<RecipeForm
			initial={initial}
			action={action}
			uploadFolders={uploadFolders}
			uploader={vi.fn()}
		/>
	);
}

async function renderFormFrom(initial: RecipeFormValues, action: FormAction = refuse) {
	await render(recipeForm(initial, action));
}

function textbox(name: string | RegExp) {
	return page.getByRole('textbox', { name });
}

function title() {
	return textbox('Title');
}

// The button that adds a new recipe to the cookbook.
function saveRecipe() {
	return page.getByRole('button', { name: 'Add to cookbook' });
}

// The button that saves a published recipe's changes.
function saveChanges() {
	return page.getByRole('button', { name: 'Save changes' });
}

// The note holding this text, which is what takes focus.
function noteWith(text: string): HTMLElement {
	const note = page.getByText(text).element().closest<HTMLElement>('[data-slot="alert"]');
	if (note === null) {
		throw new Error(`No note holds “${text}”.`);
	}
	return note;
}

function lookRight(name: string) {
	return page.getByRole('button', { name: `Looks right: ${name}` });
}

// The text as a live region says it, which screen readers read as it arrives.
function announced(text: string | RegExp) {
	return page.getByRole('status').getByText(text);
}

// The save's problems, which take focus after it fails.
function problemSummary(heading: string) {
	return page.getByRole('alert').filter({ hasText: heading });
}

// The ids of the fields marked invalid, in order.
function invalidFieldIds(): string[] {
	return Array.from(document.querySelectorAll('[aria-invalid="true"]'), (element) => element.id);
}

// Each item's name and the status under it, in a list of photos.
function photoStatuses(legend: string) {
	return page
		.getByRole('list', { name: legend })
		.getByRole('listitem')
		.elements()
		.map((row) => ({
			name: row.querySelector('[data-slot="attachment-title"]')?.textContent,
			status: row.querySelector('[data-slot="attachment-description"]')?.textContent,
		}));
}

describe('RecipeForm’s review notes', () => {
	it('shows each note under its field and an intro, with no summary or invalid field', async () => {
		await renderForm(lemonBars, threeNotes);

		await expect.element(page.getByText('3 things need a second look')).toBeVisible();
		expect(page.getByText('Check')).toHaveLength(3);
		expect(page.getByRole('button', { name: /^Looks right/ })).toHaveLength(3);
		await expect
			.element(page.getByText(/^Fix \d+ things? before adding it to the cookbook$/))
			.not.toBeInTheDocument();
		expect(invalidFieldIds()).toEqual([]);
		await expect.element(textbox('Ingredient 2')).toHaveAccessibleDescription(/Check this line\./);
	});

	it('moves focus to the next open note as each looks right, and announces what is left', async () => {
		await renderForm(lemonBars, threeNotes);

		await lookRight('Ingredient 2').click();
		await expect.element(noteWith('Check this step.')).toHaveFocus();
		await expect.element(announced('Checked. 2 left.')).toBeInTheDocument();
		await expect.element(page.getByText('Check this line.')).not.toBeInTheDocument();
		await expect.element(page.getByText('2 things need a second look')).toBeVisible();

		// After the last note, the first one left comes next.
		await lookRight('Step 1').click();
		await expect.element(noteWith('Check the title.')).toHaveFocus();
		await expect.element(announced('Checked. 1 left.')).toBeInTheDocument();

		await lookRight('Title').click();
		await expect.element(saveRecipe()).toHaveFocus();
		await expect.element(announced('Checked. Nothing left to check.')).toBeInTheDocument();
		await expect.element(page.getByText(/need a second look/)).not.toBeInTheDocument();
	});

	it('moves Next to the open note after where focus last was in the form, wrapping past the last', async () => {
		await renderForm(lemonBars, threeNotes);
		const next = page.getByRole('button', { name: 'Next' });
		// The count describes Next as "3 to check", though a phone shows "3 left".
		await expect.element(next).toHaveAccessibleDescription('3 to check');

		await next.click();
		await expect.element(noteWith('Check the title.')).toHaveFocus();
		await next.click();
		await expect.element(noteWith('Check this line.')).toHaveFocus();
		await next.click();
		await expect.element(noteWith('Check this step.')).toHaveFocus();
		await next.click();
		await expect.element(noteWith('Check the title.')).toHaveFocus();

		await textbox('Ingredient 1').click();
		await next.click();
		await expect.element(noteWith('Check this line.')).toHaveFocus();

		await lookRight('Ingredient 2').click();
		await expect.element(noteWith('Check this step.')).toHaveFocus();
		await expect.element(next).toHaveAccessibleDescription('2 to check');
		await next.click();
		await expect.element(noteWith('Check the title.')).toHaveFocus();
	});

	it('starts checking at the first note', async () => {
		await renderForm(lemonBars, threeNotes);

		await page.getByRole('button', { name: 'Start checking' }).click();

		await expect.element(noteWith('Check the title.')).toHaveFocus();
	});

	it('clears a note when its field is edited, and offers no Looks right on an empty title', async () => {
		await renderForm({ ...lemonBars, title: undefined }, [
			{ path: 'title', message: 'Add a title. The original doesn’t show one.' },
		]);

		const note = page.elementLocator(noteWith('Add a title. The original doesn’t show one.'));
		await expect.element(note.getByRole('button')).not.toBeInTheDocument();

		await title().fill('Lemon bars');

		await expect
			.element(page.getByText('Add a title. The original doesn’t show one.'))
			.not.toBeInTheDocument();
		await expect.element(page.getByText(/need a second look/)).not.toBeInTheDocument();
	});

	it('asks before saving with notes open; Show me goes to the first and saves nothing', async () => {
		const action = vi.fn(refuse);
		await renderForm(lemonBars, threeNotes, action);

		await saveRecipe().click();
		const dialog = page.getByRole('alertdialog', { name: '3 things haven’t been checked' });
		await expect.element(dialog).toBeVisible();
		await expect
			.element(dialog)
			.toHaveAccessibleDescription(
				'Each has a note in the form. The notes aren’t kept once it’s added to the cookbook.'
			);

		await dialog.getByRole('button', { name: 'Show me' }).click();

		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		await expect.element(noteWith('Check the title.')).toHaveFocus();
		expect(action).not.toHaveBeenCalled();
	});

	it('closes the warning about notes as its page hides, and saves nothing', async () => {
		const action = vi.fn(refuse);
		const keptPage = await renderKeptPage(
			recipeForm(recipeFormValues(lemonBars, threeNotes), action)
		);

		await saveRecipe().click();
		await expect.element(page.getByRole('alertdialog')).toBeVisible();
		await keptPage.hide();
		await keptPage.show();

		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(action).not.toHaveBeenCalled();
	});

	it('saves anyway when asked, and keeps the open notes when the save fails', async () => {
		const action = vi.fn(refuse);
		await renderForm(lemonBars, threeNotes, action);

		await lookRight('Step 1').click();
		await saveRecipe().click();
		const dialog = page.getByRole('alertdialog', { name: '2 things haven’t been checked' });
		await dialog.getByRole('button', { name: 'Add anyway' }).click();

		await expect
			.element(problemSummary('Fix 1 thing before adding it to the cookbook'))
			.toBeVisible();
		expect(action).toHaveBeenCalledOnce();
		await expect.element(page.getByText('Check the title.')).toBeVisible();
		await expect.element(page.getByText('Check this line.')).toBeVisible();
		await expect.element(page.getByText('Check this step.')).not.toBeInTheDocument();
		await expect.element(page.getByText('2 things need a second look')).toBeVisible();
		// Only the save's error marks its field invalid.
		expect(invalidFieldIds()).toEqual([textbox('Ingredient 1').element().id]);
	});

	it('shows what the save needs before asking about notes, and clears it as it asks once it can save', async () => {
		const action = vi.fn(refuse);
		await renderForm({ ...lemonBars, title: undefined }, threeNotes.slice(1), action);
		// Found before the warning opens, since it hides the rest of the page from screen readers.
		const titleField = page.elementLocator(title().element());

		await saveRecipe().click();

		await expect
			.element(problemSummary('Fix 1 thing before adding it to the cookbook'))
			.toHaveFocus();
		await expect
			.element(page.getByRole('link', { name: 'Title: Enter a title.' }))
			.toBeInTheDocument();
		await expect.element(titleField).toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByRole('alertdialog')).not.toBeInTheDocument();
		expect(action).not.toHaveBeenCalled();

		await titleField.fill('Lemon bars');
		await saveRecipe().click();

		await expect
			.element(page.getByRole('alertdialog', { name: '2 things haven’t been checked' }))
			.toBeVisible();
		await expect
			.element(page.getByText('Fix 1 thing before adding it to the cookbook'))
			.not.toBeInTheDocument();
		await expect.element(page.getByText('Enter a title.')).not.toBeInTheDocument();
		await expect.element(titleField).not.toHaveAttribute('aria-invalid');
		expect(action).not.toHaveBeenCalled();
	});

	it('asks for the ingredients, steps, and chapter a recipe needs before any request', async () => {
		const action = vi.fn(refuse);
		await renderForm({ title: 'Lemon bars' }, [], action);

		await saveRecipe().click();

		await expect
			.element(problemSummary('Fix 3 things before adding it to the cookbook'))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Ingredients: Add at least one ingredient.' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Steps: Add at least one step.' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Chapter: Choose a chapter.' }))
			.toBeInTheDocument();
		expect(action).not.toHaveBeenCalled();
	});

	it('marks a transcription marker left in a line, and asks before saving it', async () => {
		const action = vi.fn(refuse);
		await renderForm(
			{ ...lemonBars, ingredientSections: [{ lines: [{ text: '1 cup [illegible] flour' }] }] },
			[],
			action
		);

		const marks = Array.from(document.querySelectorAll('mark'), (mark) => mark.textContent);
		expect(marks).toEqual(['[illegible]']);
		await expect.element(page.getByText('1 thing needs a second look')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: /^Looks right/ }))
			.not.toBeInTheDocument();

		await saveRecipe().click();

		await expect
			.element(page.getByRole('alertdialog', { name: '1 thing hasn’t been checked' }))
			.toBeVisible();
		expect(action).not.toHaveBeenCalled();
	});
});

describe('RecipeForm’s chapter, holidays, and diets', () => {
	function group(name: string) {
		return page.getByRole('group', { name });
	}

	function sentRecipe(action: MockInstance<FormAction>): unknown {
		const sent = action.mock.calls[0]?.[1].get('recipe');
		return JSON.parse(typeof sent === 'string' ? sent : '{}');
	}

	it('asks for a chapter at the field and in the summary before any request', async () => {
		const action = vi.fn(refuse);
		await renderForm({ ...lemonBars, chapter: undefined }, [], action);
		const chapter = group('Chapter');
		await expect.element(chapter.getByRole('radiogroup')).toHaveAttribute('aria-required', 'true');

		await saveRecipe().click();

		await expect
			.element(problemSummary('Fix 1 thing before adding it to the cookbook'))
			.toHaveFocus();
		expect(action).not.toHaveBeenCalled();
		await expect
			.element(chapter)
			.toHaveAccessibleDescription('Where the recipe goes in the cookbook. Choose a chapter.');
		await expect
			.element(chapter.getByRole('radio', { name: 'Desserts' }))
			.toHaveAttribute('aria-invalid', 'true');
		await page.getByRole('link', { name: 'Chapter: Choose a chapter.' }).click();
		await expect.element(chapter.getByText('Choose a chapter.')).toHaveFocus();

		await chapter.getByRole('radio', { name: 'Cookies & Candy' }).click();
		await saveRecipe().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(sentRecipe(action)).toMatchObject({ chapter: 'cookies-candy' });
	});

	it('shows a recipe’s choices, and sends what is chosen, holidays in calendar order', async () => {
		const action = vi.fn(refuse);
		await renderForm({ ...lemonBars, holidays: ['halloween'], diets: ['gluten-free'] }, [], action);
		const holidays = group('Holidays (optional)');
		await expect.element(group('Chapter').getByRole('radio', { name: 'Desserts' })).toBeChecked();
		await expect.element(holidays.getByRole('checkbox', { name: 'Halloween' })).toBeChecked();
		await expect
			.element(group('Diet (optional)').getByRole('checkbox', { name: 'Gluten-free' }))
			.toBeChecked();

		await holidays.getByRole('checkbox', { name: 'Christmas' }).click();
		await holidays.getByRole('checkbox', { name: 'Easter' }).click();
		await holidays.getByRole('checkbox', { name: 'Halloween' }).click();
		await saveRecipe().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(sentRecipe(action)).toMatchObject({
			chapter: 'desserts',
			holidays: ['easter', 'christmas'],
			diets: ['gluten-free'],
		});
	});

	it('ticks and holds Vegetarian and Dairy-free while Vegan is ticked, and says why', async () => {
		// Stored as a vegan recipe is, with every diet Vegan implies.
		await renderForm({ ...lemonBars, diets: ['vegetarian', 'vegan', 'dairy-free'] });
		const diet = group('Diet (optional)');
		const box = (name: string) => diet.getByRole('checkbox', { name });
		const held = ['Vegetarian', 'Dairy-free'];

		for (const name of ['Vegan', ...held]) {
			await expect.element(box(name)).toBeChecked();
		}
		for (const name of held) {
			await expect.element(box(name)).toHaveAttribute('aria-disabled', 'true');
		}
		await expect
			.element(diet)
			.toHaveAccessibleDescription('Vegan recipes are vegetarian and dairy-free too.');

		// What Vegan held goes with it, as when Vegan alone was ticked.
		await box('Vegan').click();
		for (const name of ['Vegan', ...held]) {
			await expect.element(box(name)).not.toBeChecked();
		}
		await expect.element(diet).not.toHaveAccessibleDescription();

		// What the member ticked before Vegan stays once Vegan goes.
		await box('Vegetarian').click();
		await box('Vegan').click();
		await expect.element(box('Vegetarian')).toHaveAttribute('aria-disabled', 'true');
		await box('Vegan').click();
		await expect.element(box('Vegetarian')).toBeChecked();
		await expect.element(box('Vegetarian')).not.toHaveAttribute('aria-disabled');
		await expect.element(box('Dairy-free')).not.toBeChecked();
	});

	it('announces why Vegan ticks two more diets as it is ticked, and empties once it goes', async () => {
		await renderForm(lemonBars);
		const diet = group('Diet (optional)');
		const status = diet.getByRole('status');
		await expect.element(status).toBeEmptyDOMElement();

		await diet.getByRole('checkbox', { name: 'Vegan' }).click();
		await expect
			.element(status)
			.toHaveTextContent('Vegan recipes are vegetarian and dairy-free too.');

		await userEvent.keyboard(' ');
		await expect.element(diet.getByRole('checkbox', { name: 'Vegan' })).not.toBeChecked();
		await expect.element(status).toBeEmptyDOMElement();
	});

	it('shows a draft’s note on the chapter, which Looks right clears', async () => {
		await renderForm(lemonBars, [{ path: 'chapter', message: 'Check the chapter.' }]);

		await expect
			.element(group('Chapter'))
			.toHaveAccessibleDescription('Where the recipe goes in the cookbook. Check the chapter.');
		await lookRight('Chapter').click();

		await expect.element(page.getByText('Check the chapter.')).not.toBeInTheDocument();
		await expect.element(saveRecipe()).toHaveFocus();
	});
});

describe('RecipeForm’s times', () => {
	it('names each time with its unit, as its problems name it', async () => {
		await renderForm(lemonBars);

		for (const time of ['Prep', 'Cook', 'Total']) {
			await expect.element(textbox(`${time}, in minutes`)).toBeVisible();
		}
	});
});

describe('RecipeForm’s original recipe', () => {
	it('shows the stored scans beside the form and in the viewer, numbered as the viewer numbers them', async () => {
		await page.viewport(laptop.width, laptop.height);
		const saved = 'scan/development/front.jpg';
		const values = recipeFormValues({ ...lemonBars, images: [{ role: 'scan', pathname: saved }] });
		const uploaded = values.nextId;
		const failed = uploaded + 1;
		const uploading = uploaded + 2;
		const jpeg = (name: string) =>
			new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, { type: 'image/jpeg' });
		const pageSize = { width: 2304, height: 3072 };
		// Ahead of the saved scan: an upload done, one that failed, and one still uploading.
		const edits: RecipeFormEdit[] = [
			{ type: 'addPhotos', role: 'scan', fileNames: ['back.jpg', 'bad.jpg', 'wip.jpg'] },
			{
				type: 'startPhotoUpload',
				photoId: uploaded,
				pathname: 'scan/development/back.jpg',
				size: pageSize,
				file: jpeg('back.jpg'),
			},
			{ type: 'finishPhotoUpload', photoId: uploaded },
			{ type: 'failPhoto', photoId: failed, failure: 'upload' },
			{
				type: 'startPhotoUpload',
				photoId: uploading,
				pathname: 'scan/development/wip.jpg',
				size: pageSize,
				file: jpeg('wip.jpg'),
			},
			{ type: 'movePhoto', photoId: failed, toIndex: 0 },
			{ type: 'movePhoto', photoId: uploaded, toIndex: 1 },
			{ type: 'movePhoto', photoId: uploading, toIndex: 2 },
		];
		await renderFormFrom(edits.reduce(editRecipeForm, values));

		// The upload shows from its file until it's saved, so it is never downloaded.
		const pane = page.getByRole('complementary', { name: 'Original recipe' });
		await expect.element(pane.getByRole('status')).toHaveTextContent('Page 1 of 2');
		await expect
			.element(pane.getByRole('img'))
			.toHaveAttribute('src', expect.stringMatching(/^blob:/));

		await pane.getByRole('button', { name: 'Show page 2 of 2' }).click();
		await expect.element(pane.getByRole('status')).toHaveTextContent('Page 2 of 2');
		// Through the image optimizer, at the size the page shows at its zoom.
		await expect
			.element(pane.getByRole('img'))
			.toHaveAttribute(
				'src',
				expect.stringMatching(
					/^\/_next\/image\?url=%2Fapi%2Fimages%2Fscan%2Fdevelopment%2Ffront\.jpg/
				)
			);

		// A row the viewer holds opens it at the place the row names; the others have no place in it.
		const rows = page.getByRole('list', { name: 'Original recipe' }).getByRole('listitem');
		expect(
			rows.elements().map((row) => ({
				name: row.querySelector('[data-slot="attachment-title"]')?.textContent,
				opens: page
					.elementLocator(row)
					.getByRole('button', { name: /^View page/ })
					.query()
					?.getAttribute('aria-label'),
			}))
		).toEqual([
			{ name: 'bad.jpg', opens: undefined },
			{ name: 'back.jpg', opens: 'View page 1 of 2' },
			{ name: 'wip.jpg', opens: undefined },
			{ name: 'Page 2', opens: 'View page 2 of 2' },
		]);
	});

	it('reads the original beside the fields on a laptop, and from View original on a phone', async () => {
		await renderForm({
			...lemonBars,
			images: [{ role: 'scan', pathname: 'scan/development/card.jpg' }],
		});
		const pane = page.getByRole('complementary', { name: 'Original recipe', includeHidden: true });
		const viewOriginal = page.getByRole('button', { name: 'View original', includeHidden: true });
		await expect.element(viewOriginal).toBeVisible();
		await expect.element(pane).not.toBeVisible();

		await page.viewport(laptop.width, laptop.height);

		await expect.element(pane).toBeVisible();
		await expect.element(viewOriginal).not.toBeVisible();
		expect(pane.element().getBoundingClientRect().left).toBeGreaterThanOrEqual(
			title().element().getBoundingClientRect().right
		);
	});
});

describe('RecipeForm’s action bar', () => {
	const scanPathname = 'scan/development/card.jpg';
	const withOriginal = {
		...lemonBars,
		images: [{ role: 'scan' as const, pathname: scanPathname }],
	};

	beforeEach(async () => {
		await page.viewport(laptop.width, laptop.height);
	});

	it('saves what the fields beside the original hold, from Save after them', async () => {
		const action = vi.fn(refuse);
		await renderForm(withOriginal, [], action);
		await expect
			.element(page.getByRole('complementary', { name: 'Original recipe' }))
			.toBeVisible();

		await title().fill('Lemon squares');
		await saveRecipe().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		const sent = action.mock.calls[0]?.[1].get('recipe');
		expect(JSON.parse(typeof sent === 'string' ? sent : '{}')).toMatchObject({
			title: 'Lemon squares',
			images: [{ role: 'scan', pathname: scanPathname }],
		});
	});

	it('puts the fields before the original, so Save comes after the fields and Tab reaches them first', async () => {
		await renderForm(withOriginal);

		const pane = page.getByRole('complementary', { name: 'Original recipe' }).element();
		expect(
			title().element().compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING
		).not.toBe(0);
		expect(
			pane.compareDocumentPosition(saveRecipe().element()) & Node.DOCUMENT_POSITION_FOLLOWING
		).not.toBe(0);
	});

	it('moves Next on from the last field focused, not from the original beside the fields', async () => {
		await renderForm(withOriginal, threeNotes);
		const pane = page.getByRole('complementary', { name: 'Original recipe' });

		await textbox('Ingredient 1').click();
		await pane.getByRole('button', { name: 'Zoom in' }).click();
		await page.getByRole('button', { name: 'Next' }).click();

		await expect.element(noteWith('Check this line.')).toHaveFocus();
	});
});

describe('RecipeForm’s wording for adding and editing', () => {
	const refused: FormState = {
		status: 'error',
		fieldErrors: { 'ingredientSections.0.lines.0': 'Enter an amount.' },
	};
	// A line still holding a transcription marker, which saving asks about first.
	const withMarker: RecipeDraftContent = {
		...lemonBars,
		ingredientSections: [{ lines: [{ text: '1 cup [illegible] flour' }] }],
	};

	it('adds a new recipe to the cookbook, and says so as it adds and after it fails', async () => {
		const added = heldResult(refused);
		await renderForm(withMarker, [], async () => added.promise);

		await saveRecipe().click();
		const dialog = page.getByRole('alertdialog', { name: '1 thing hasn’t been checked' });
		await expect
			.element(dialog)
			.toHaveAccessibleDescription(
				'Each has a note in the form. The notes aren’t kept once it’s added to the cookbook.'
			);
		await dialog.getByRole('button', { name: 'Add anyway' }).click();

		await expect.element(page.getByRole('button', { name: 'Adding to cookbook' })).toBeVisible();
		added.resolve(refused);
		await expect
			.element(problemSummary('Fix 1 thing before adding it to the cookbook'))
			.toHaveFocus();
		await expect.element(saveRecipe()).toBeVisible();
	});

	it('saves changes to a published recipe, and says so as it saves and after it fails', async () => {
		const saved = heldResult(refused);
		await render(
			<RecipeForm
				initial={recipeFormValues(withMarker)}
				action={async () => saved.promise}
				uploadFolders={uploadFolders}
				uploader={vi.fn()}
				editing={{ id: recipeId, version: 'a' }}
			/>
		);

		await saveChanges().click();
		const dialog = page.getByRole('alertdialog', { name: '1 thing hasn’t been checked' });
		await expect
			.element(dialog)
			.toHaveAccessibleDescription(
				'Each has a note in the form. The notes aren’t kept once the recipe is saved.'
			);
		await dialog.getByRole('button', { name: 'Save anyway' }).click();

		await expect.element(page.getByRole('button', { name: 'Saving changes' })).toBeVisible();
		saved.resolve(refused);
		await expect.element(problemSummary('Fix 1 thing to save')).toHaveFocus();
		await expect.element(saveChanges()).toBeVisible();
	});
});

describe('RecipeForm’s photos', () => {
	it('calls the first stored photo the cover, as saving makes it, past a failed or unfinished one', async () => {
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
				size: { width: 2400, height: 1800 },
				file: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'wip.jpg', {
					type: 'image/jpeg',
				}),
			},
			{ type: 'failPhoto', photoId: failed, failure: 'upload' },
			{ type: 'movePhoto', photoId: uploading, toIndex: 0 },
			{ type: 'movePhoto', photoId: failed, toIndex: 1 },
		];
		await renderFormFrom(edits.reduce(editRecipeForm, values));

		expect(photoStatuses('Photos')).toEqual([
			{ name: 'wip.jpg', status: 'Uploading' },
			{ name: 'bad.jpg', status: 'Didn’t upload' },
			{ name: 'Photo 1', status: 'Cover photo' },
		]);
	});

	it('names its photos a list, which Safari takes for a group without markers', async () => {
		await renderForm({
			...lemonBars,
			images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
		});

		await expect
			.element(page.getByRole('list', { name: 'Photos' }))
			.toHaveAttribute('role', 'list');
	});
});

describe('RecipeForm’s lists', () => {
	// Each row as its label and its text, in order.
	function rowTexts(legend: string): string[] {
		return page
			.getByRole('list', { name: legend })
			.getByRole('textbox')
			.all()
			.map((row) => `${textControl(row).labels?.[0]?.textContent}: ${textControl(row).value}`);
	}

	// The numbers shown beside the steps' fields, in order.
	function shownStepNumbers(): (string | null)[] {
		return page
			.getByRole('list', { name: 'Steps' })
			.getByText(/^\d+\.$/)
			.elements()
			.map((number) => number.textContent);
	}

	async function choose(row: string, action: string) {
		await page.getByRole('button', { name: `Actions for ${row}` }).click();
		await page.getByRole('menuitem', { name: action }).click();
	}

	it('names each list of rows a list, which Safari takes for a group without markers', async () => {
		await renderForm(lemonBars);

		for (const legend of ['Ingredients', 'Steps']) {
			await expect
				.element(page.getByRole('list', { name: legend }))
				.toHaveAttribute('role', 'list');
		}
	});

	it('shows how a line without an amount reads once tidied, and nothing when it reads as typed', async () => {
		await renderForm({
			...lemonBars,
			ingredientSections: [{ lines: [{ text: 'Salt to taste;' }, { text: 'Pepper to taste' }] }],
		});

		await expect
			.element(textbox('Ingredient 1'))
			.toHaveAccessibleDescription('Shows as Salt to taste');
		await expect.element(textbox('Ingredient 2')).toHaveAccessibleDescription('');
	});

	it('adds a line below on Enter and removes an empty one on Backspace, announcing each', async () => {
		await renderForm(lemonBars);

		await textbox('Ingredient 1').click();
		await userEvent.keyboard('{Enter}');

		await expect
			.poll(() => rowTexts('Ingredients'))
			.toEqual(['Ingredient 1: 1 cup flour', 'Ingredient 2: ', 'Ingredient 3: 2 eggs']);
		await expect.element(textbox('Ingredient 2')).toHaveFocus();
		await expect.element(announced('Added Ingredient 2.')).toBeInTheDocument();

		await userEvent.keyboard('{Backspace}');

		await expect
			.poll(() => rowTexts('Ingredients'))
			.toEqual(['Ingredient 1: 1 cup flour', 'Ingredient 2: 2 eggs']);
		await expect.element(textbox('Ingredient 1')).toHaveFocus();
		expect(textControl(textbox('Ingredient 1')).selectionStart).toBe('1 cup flour'.length);
		await expect.element(announced('Removed Ingredient 2.')).toBeInTheDocument();

		// Backspace in a line with text deletes text, as it always does.
		await userEvent.keyboard('{Backspace}');
		await expect
			.poll(() => rowTexts('Ingredients'))
			.toEqual(['Ingredient 1: 1 cup flou', 'Ingredient 2: 2 eggs']);
	});

	it('splits a pasted list into lines and headings, without bullets, and announces it', async () => {
		await renderForm({ ...lemonBars, ingredientSections: undefined });

		await textbox('Ingredient 1').click();
		await pasteText('• 2 cups flour\n• 1 teaspoon salt\n\nFor the glaze:\n1. 1 cup sugar\n');

		await expect
			.poll(() => rowTexts('Ingredients'))
			.toEqual([
				'Ingredient 1: 2 cups flour',
				'Ingredient 2: 1 teaspoon salt',
				'Ingredient heading 1: For the glaze',
				'Ingredient 1, For the glaze: 1 cup sugar',
			]);
		await expect.element(textbox('Ingredient 1, For the glaze')).toHaveFocus();
		await expect.element(announced('Pasted 3 ingredients and 1 heading.')).toBeInTheDocument();

		// A single line pastes as the browser pastes, at the caret.
		await pasteText(', sifted');
		await expect.element(textbox('Ingredient 1, For the glaze')).toHaveValue('1 cup sugar, sifted');
	});

	it('announces a message again when it repeats', async () => {
		await renderForm({ ...lemonBars, ingredientSections: undefined });

		await textbox('Ingredient 1').click();
		await pasteText('2 cups flour\n1 teaspoon salt');
		await expect.element(announced('Pasted 2 ingredients.')).toBeInTheDocument();
		const first = announced('Pasted 2 ingredients.').element();
		const region = first.closest('[role="status"]');
		await pasteText('2 eggs\n1 cup milk');

		// The region stays, and the message arrives in it as a new node, which screen readers read.
		await expect.poll(() => first.isConnected).toBe(false);
		const second = announced('Pasted 2 ingredients.').element();
		expect(second.closest('[role="status"]')).toBe(region);
	});

	it('changes a line to a heading over the lines after it', async () => {
		await renderForm({
			...lemonBars,
			ingredientSections: [
				{ lines: [{ text: '1 cup flour' }, { text: 'For the glaze' }, { text: '1 cup sugar' }] },
			],
		});

		await choose('Ingredient 2', 'Change to heading');

		await expect
			.poll(() => rowTexts('Ingredients'))
			.toEqual([
				'Ingredient 1: 1 cup flour',
				'Ingredient heading 1: For the glaze',
				'Ingredient 1, For the glaze: 1 cup sugar',
			]);
		await expect
			.element(announced('Changed “For the glaze” to Ingredient heading 1.'))
			.toBeInTheDocument();
		// The row keeps its menu, which takes focus back and now offers the way back.
		const trigger = page.getByRole('button', { name: 'Actions for Ingredient heading 1' });
		await expect.element(trigger).toHaveFocus();
		await trigger.click();
		await expect
			.element(page.getByRole('menuitem', { name: 'Change to ingredient' }))
			.toBeVisible();
	});

	it('keeps a removed heading’s lines, which join the lines above it', async () => {
		await renderForm({
			...lemonBars,
			ingredientSections: [
				{ lines: [{ text: '1 cup flour' }] },
				{ heading: 'For the glaze', lines: [{ text: '1 cup sugar' }] },
			],
		});

		await choose('Ingredient heading 1', 'Remove');

		await expect
			.poll(() => rowTexts('Ingredients'))
			.toEqual(['Ingredient 1: 1 cup flour', 'Ingredient 2: 1 cup sugar']);
		await expect.element(textbox('Ingredient 1')).toHaveFocus();
		await expect
			.element(announced('Removed Ingredient heading 1. The ingredient under it stays.'))
			.toBeInTheDocument();
		const sent = document.querySelector<HTMLInputElement>('input[name="recipe"]')?.value ?? '{}';
		expect(JSON.parse(sent)).toMatchObject({
			ingredientSections: [{ lines: ['1 cup flour', '1 cup sugar'] }],
		});
	});

	it('counts the steps straight through their headings, as the recipe page does, and names each by its number', async () => {
		await renderForm(potRoast, [
			{ path: 'instructionSections.1.steps.1', message: 'Check this step.' },
		]);

		expect(shownStepNumbers()).toEqual(['1.', '2.', '3.', '4.']);
		expect(rowTexts('Steps')).toEqual([
			'Step 1: Brown the roast.',
			'Step 2: Roast until tender.',
			'Step heading 1: For the gravy',
			'Step 3, For the gravy: Whisk in the flour.',
			'Step 4, For the gravy: Simmer until thick.',
		]);
		await expect.element(lookRight('Step 4, For the gravy')).toBeVisible();

		await textbox('Step 4, For the gravy').click();
		await userEvent.keyboard('{Enter}');

		await expect.element(announced('Added Step 5, For the gravy.')).toBeInTheDocument();
		expect(shownStepNumbers()).toEqual(['1.', '2.', '3.', '4.', '5.']);
		await userEvent.keyboard('Strain.');
		expect(shownStepNumbers()).toEqual(['1.', '2.', '3.', '4.', '5.']);
	});

	it('numbers a blank step too, so one in the middle shows a number the saved recipe will not use', async () => {
		await renderForm({
			...lemonBars,
			instructionSections: [{ steps: [{ text: 'Mix.' }, { text: '' }, { text: 'Bake.' }] }],
		});

		expect(shownStepNumbers()).toEqual(['1.', '2.', '3.']);
		expect(rowTexts('Steps')).toEqual(['Step 1: Mix.', 'Step 2: ', 'Step 3: Bake.']);

		await page.getByRole('list', { name: 'Steps' }).getByRole('textbox').nth(1).fill('Stir.');

		expect(shownStepNumbers()).toEqual(['1.', '2.', '3.']);
		expect(rowTexts('Steps')).toEqual(['Step 1: Mix.', 'Step 2: Stir.', 'Step 3: Bake.']);
	});

	it('says which fields are optional in their labels', async () => {
		await renderForm(lemonBars);

		for (const name of ['Source (optional)', 'Notes (optional)', 'Description (optional)']) {
			await expect.element(textbox(name)).toBeVisible();
		}
		for (const name of ['Times and yield (optional)', 'Photos (optional)']) {
			await expect.element(page.getByRole('group', { name })).toBeVisible();
		}
		for (const name of ['Title', 'Ingredients', 'Steps', 'Chapter']) {
			expect(page.getByText(`${name} (optional)`).elements()).toEqual([]);
		}
	});

	it('names a step by its number in a save’s problems', async () => {
		await renderForm(potRoast, [], async () => ({
			status: 'error',
			fieldErrors: { 'instructionSections.1.steps.0': 'Say what to whisk in.' },
		}));

		await saveRecipe().click();

		await expect
			.element(page.getByRole('link', { name: 'Step 3, For the gravy: Say what to whisk in.' }))
			.toHaveAttribute('href', `#${textbox('Step 3, For the gravy').element().id}`);
	});

	it('shows a save’s problem with a heading that has nothing under it at the heading', async () => {
		await renderForm(
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

		await saveRecipe().click();

		const heading = textbox('Ingredient heading 1');
		await expect
			.element(
				page.getByRole('link', {
					name: 'Ingredients, For the glaze: Add at least one ingredient.',
				})
			)
			.toHaveAttribute('href', `#${heading.element().id}`);
		await expect.element(heading).toHaveAttribute('aria-invalid', 'true');
		await expect.element(heading).toHaveAccessibleDescription('Add at least one ingredient.');
	});

	it('asks for a line under each heading of a list holding only headings, where the server does', async () => {
		const action = vi.fn(refuse);
		await renderForm(
			{
				...lemonBars,
				ingredientSections: [
					{ heading: 'For the crust', lines: [] },
					{ heading: 'For the glaze', lines: [] },
				],
			},
			[],
			action
		);

		await saveRecipe().click();

		await expect
			.element(problemSummary('Fix 2 things before adding it to the cookbook'))
			.toBeVisible();
		await expect
			.element(
				page.getByRole('link', {
					name: 'Ingredients, For the glaze: Add at least one ingredient.',
				})
			)
			.toHaveAttribute('href', `#${textbox('Ingredient heading 2').element().id}`);
		await expect
			.element(
				page.getByRole('link', {
					name: 'Ingredients, For the crust: Add at least one ingredient.',
				})
			)
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Ingredients: Add at least one ingredient.' }))
			.not.toBeInTheDocument();
		expect(action).not.toHaveBeenCalled();
	});
});

describe('RecipeForm’s undo', () => {
	it('undoes and redoes the title’s own typing, leaving a row typed in since untouched', async () => {
		await renderForm(lemonBars);
		const row = textbox('Ingredient 1');

		await title().click();
		await userEvent.keyboard(' with thyme');
		await row.click();
		await userEvent.keyboard(', sifted');
		await title().click();

		await pressUndo();
		await expect.element(title()).toHaveValue('Lemon bars');
		// With nothing left to undo here, the browser's own undo of the row never runs.
		await pressUndo();
		expect(textControl(title()).value).toBe('Lemon bars');
		expect(textControl(row).value).toBe('1 cup flour, sifted');

		await pressRedo();
		await expect.element(title()).toHaveValue('Lemon bars with thyme');

		expect(sendHistoryInput(row, 'historyUndo')).toBe(false);
		await expect.element(title()).toHaveValue('Lemon bars');
		expect(textControl(row).value).toBe('1 cup flour, sifted');
	});

	it('gives a time and a photo’s description each its own undo', async () => {
		await renderForm({
			...lemonBars,
			images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
		});
		const prep = textbox('Prep, in minutes');
		const alt = textbox(/^Describe the photo/);
		const row = textbox('Ingredient 1');
		const values = () => [prep, alt].map((field) => textControl(field).value);

		await prep.click();
		await userEvent.keyboard('15');
		await alt.click();
		await userEvent.keyboard('Bars on a plate');

		await prep.click();
		await pressUndo();
		await expect.poll(values).toEqual(['', 'Bars on a plate']);

		await alt.click();
		await pressUndo();
		await expect.poll(values).toEqual(['', '']);
		await pressRedo();
		await expect.poll(values).toEqual(['', 'Bars on a plate']);
		expect(textControl(row).value).toBe('1 cup flour');
	});
});

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const otherMemberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6c';
const recipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c10';
const otherRecipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c11';
const draftId = '0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e';

// The version of the recipe the edit form loads.
const recipeVersion = '2026-10-14T12:00:00.000Z';
const recipeKey = `member:recipe-form:${memberId}:recipe:${recipeId}`;

type AutosavedFormProps = {
	initial?: RecipeFormValues;
	action?: FormAction;
	editing?: EditedRecipe;
	member?: string;
	existing?: ExistingRecipeFormSubjects;
};

// The form editing a published recipe, which keeps its unsaved changes in this browser.
function AutosavedForm({
	initial = recipeFormValues(),
	action = refuse,
	editing = { id: recipeId, version: recipeVersion },
	member = memberId,
	existing,
}: AutosavedFormProps) {
	return (
		<RecipeForm
			initial={initial}
			action={action}
			uploadFolders={uploadFolders}
			uploader={vi.fn()}
			editing={editing}
			autosave={{ memberId: member, existing }}
		/>
	);
}

function storedEntry(key: string): AutosavedRecipeForm | undefined {
	const entry = localStorage.getItem(key);
	return entry === null ? undefined : (JSON.parse(entry) as AutosavedRecipeForm);
}

function stored(key: string): RecipeFormSnapshot | undefined {
	return storedEntry(key)?.form;
}

// The notice for changes restored from this browser, which says when they were made; its
// announcement ends with a period.
const restoredNotice = /^Restored changes made in this browser on .*M$/;

// The notice for changes kept in this browser for an earlier version, which are dropped.
const outdatedNotice = /^Changes made in this browser on .*M were for an earlier version$/;

describe('RecipeForm’s autosave', () => {
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
	};

	// When the stored changes were made.
	const writtenAt = new Date('2026-10-14T19:12:00.000Z');

	// A recipe that can save, as a reload left it: a title, a line, a step, a chapter, and two
	// uploads, the second of which the sweep has since removed.
	const storedRecipe: RecipeFormSnapshot = {
		text: { ...blankText, title: 'Lemon bars' },
		yieldKind: 'servings',
		ingredientSections: { rows: [{ kind: 'item', id: 0, text: '1 cup flour' }] },
		instructionSections: { rows: [{ kind: 'item', id: 1, text: 'Bake.' }] },
		chapter: 'desserts',
		holidays: [],
		diets: [],
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

	// The entry the form keeps for the version it loads, written at the moment given or just now.
	function entryFor(form: RecipeFormSnapshot, at: Date = new Date()): string {
		return JSON.stringify({
			version: recipeVersion,
			writtenAt: at.toISOString(),
			form,
		} satisfies AutosavedRecipeForm);
	}

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

	it('offers a half-edited recipe back as the form loads again, and Discard clears it', async () => {
		const first = await render(<AutosavedForm />);
		await title().fill('Lemon bars');
		await textbox('Ingredient 1').fill('1 cup flour');
		await expect.poll(() => stored(recipeKey)?.text.title).toBe('Lemon bars');
		await first.unmount();

		await render(<AutosavedForm />);

		await expect.element(page.getByText(restoredNotice)).toBeVisible();
		await expect
			.element(page.getByText('Discard them to go back to the recipe as it was saved.'))
			.toBeVisible();
		await expect
			.element(announced(/^Restored changes made in this browser on .*\.$/))
			.toBeInTheDocument();
		await expect.element(title()).toHaveValue('Lemon bars');
		await expect.element(textbox('Ingredient 1')).toHaveValue('1 cup flour');

		await page.getByRole('button', { name: 'Discard unsaved changes' }).click();

		await expect.element(title()).toHaveValue('');
		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
		await expect.element(page.getByText('Discarded your unsaved changes.')).toBeInTheDocument();
		await expect.element(title()).toHaveFocus();
		expect(localStorage.getItem(recipeKey)).toBeNull();
	});

	it('keeps nothing for a form as it loaded, and nothing once it is back to that', async () => {
		await render(<AutosavedForm />);
		expect(localStorage.getItem(recipeKey)).toBeNull();

		await title().fill('L');
		await expect.poll(() => stored(recipeKey)?.text.title).toBe('L');
		await title().clear();
		await expect.poll(() => localStorage.getItem(recipeKey)).toBeNull();

		// A line added and removed again leaves only a higher next id.
		await textbox('Ingredient 1').click();
		await userEvent.keyboard('{Enter}');
		await expect.element(textbox('Ingredient 2')).toHaveFocus();
		await userEvent.keyboard('{Backspace}');
		await expect.element(textbox('Ingredient 2')).not.toBeInTheDocument();
		expect(localStorage.getItem(recipeKey)).toBeNull();
	});

	it('keeps the changes when a save is refused, or never reaches the site', async () => {
		const action = vi.fn(refuse);
		localStorage.setItem(recipeKey, entryFor(storedRecipe, writtenAt));
		answerLookups();
		await render(<AutosavedForm action={action} />);
		await expect.element(page.getByText(restoredNotice)).toBeVisible();

		// The button reads "Saving changes" until the last save settles.
		await saveChanges().click();
		await expect.element(problemSummary('Fix 1 thing to save')).toBeVisible();
		expect(stored(recipeKey)?.text.title).toBe('Lemon bars');

		action.mockImplementation(async () => {
			throw new TypeError('Failed to fetch');
		});
		await saveChanges().click();
		await expect
			.element(page.getByText('We couldn’t save the recipe. Check your connection and try again.'))
			.toBeVisible();
		expect(action).toHaveBeenCalledTimes(2);
		expect(stored(recipeKey)?.text.title).toBe('Lemon bars');
	});

	it('clears the changes before a save leads to the saved recipe', async () => {
		// React reports the error the page's boundary catches.
		vi.spyOn(console, 'error').mockImplementation(() => {});
		localStorage.setItem(recipeKey, entryFor(storedRecipe, writtenAt));
		answerLookups();
		await render(
			<LeavingPage>
				<AutosavedForm action={async () => redirect('/recipes/lemon-bars')} />
			</LeavingPage>
		);
		await expect.element(page.getByText(restoredNotice)).toBeVisible();

		await saveChanges().click();

		await expect.element(page.getByText('Left for the recipe')).toBeVisible();
		expect(localStorage.getItem(recipeKey)).toBeNull();
	});

	it('shows a restored upload the sweep removed as one that didn’t upload, and saves the rest', async () => {
		const action = vi.fn(refuse);
		localStorage.setItem(recipeKey, entryFor(storedRecipe, writtenAt));
		const fetch = answerLookups();
		await render(<AutosavedForm action={action} />);
		await expect.element(page.getByText(restoredNotice)).toBeVisible();

		expect(fetch.mock.calls.map(([url]) => url)).toEqual([
			'/api/images/dish/development/kept.jpg',
			'/api/images/dish/development/swept.jpg',
		]);
		await expect
			.poll(() => photoStatuses('Photos'))
			.toEqual([
				{ name: 'kept.jpg', status: 'Cover photo' },
				{ name: 'swept.jpg', status: 'Didn’t upload' },
			]);
		await expect
			.element(
				page
					.getByRole('list', { name: 'Photos' })
					.getByRole('listitem')
					.nth(1)
					.getByText('This photo didn’t upload. Remove it and add it again.')
			)
			.toBeVisible();

		await saveChanges().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		const sent = action.mock.calls[0]?.[1].get('recipe');
		expect(JSON.parse(typeof sent === 'string' ? sent : '{}').images).toEqual([
			{ role: 'dish', pathname: 'dish/development/kept.jpg', alt: 'Bars' },
		]);
	});

	it('keeps what is typed while a restored upload is looked up, and then shows the upload gone', async () => {
		localStorage.setItem(recipeKey, entryFor(storedRecipe, writtenAt));
		// The swept upload's lookup answers only when the test says.
		const sweptLookup = Promise.withResolvers<Response>();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) =>
				url.includes('swept') ? sweptLookup.promise : new Response(null, { status: 200 })
			)
		);
		await render(<AutosavedForm />);

		await title().fill('Lemon squares');
		sweptLookup.resolve(new Response(null, { status: 404 }));

		await expect
			.poll(() => photoStatuses('Photos'))
			.toEqual([
				{ name: 'kept.jpg', status: 'Cover photo' },
				{ name: 'swept.jpg', status: 'Didn’t upload' },
			]);
		await expect.element(title()).toHaveValue('Lemon squares');
		await expect.poll(() => stored(recipeKey)?.text.title).toBe('Lemon squares');
		expect(stored(recipeKey)?.photos.dish.map(({ pathname }) => pathname)).toEqual([
			'dish/development/kept.jpg',
			undefined,
		]);
	});

	it('brings an edit back only to the version of the recipe it was made on, and says so once', async () => {
		const editing = (version: string) => ({ id: recipeId, version });
		const first = await render(
			<AutosavedForm
				initial={recipeFormValues(lemonBars)}
				editing={editing('2026-10-14T12:00:00.000Z')}
			/>
		);
		await title().fill('Lemon bars squares');
		await expect.poll(() => storedEntry(recipeKey)?.version).toBe('2026-10-14T12:00:00.000Z');
		const kept = storedEntry(recipeKey) as AutosavedRecipeForm;
		await first.unmount();

		// Another tab saved the recipe since.
		const reloaded = await render(
			<AutosavedForm
				initial={recipeFormValues(lemonBars)}
				editing={editing('2026-10-15T09:30:00.000Z')}
			/>
		);

		const notice = `Changes made in this browser on ${formatDayAndTime(new Date(kept.writtenAt))} were for an earlier version`;
		const description = 'This recipe changed after you made them, so they weren’t restored.';
		await expect.element(page.getByText(notice)).toBeVisible();
		await expect.element(page.getByText(description)).toBeVisible();
		await expect.element(announced(`${notice}. ${description}`)).toBeInTheDocument();
		await expect.element(title()).toHaveValue('Lemon bars');
		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
		expect(localStorage.getItem(recipeKey)).toBeNull();
		await reloaded.unmount();

		await render(
			<AutosavedForm
				initial={recipeFormValues(lemonBars)}
				editing={editing('2026-10-15T09:30:00.000Z')}
			/>
		);

		await expect.element(title()).toHaveValue('Lemon bars');
		await expect.element(page.getByText(outdatedNotice)).not.toBeInTheDocument();
	});

	it('says nothing of changes for an earlier version that the form now shows', async () => {
		const edited = recipeFormValues({ ...lemonBars, title: 'Lemon squares' });
		localStorage.setItem(
			recipeKey,
			JSON.stringify({ ...JSON.parse(entryFor(recipeFormSnapshot(edited))), version: 'a' })
		);

		await render(<AutosavedForm initial={edited} editing={{ id: recipeId, version: 'b' }} />);

		await expect.poll(() => localStorage.getItem(recipeKey)).toBeNull();
		await expect.element(page.getByText(outdatedNotice)).not.toBeInTheDocument();
		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
	});

	it('keeps the notice while its page is hidden and shown again, and never brings back what it discarded', async () => {
		localStorage.setItem(recipeKey, entryFor(storedRecipe, writtenAt));
		answerLookups();
		const keptPage = await renderKeptPage(<AutosavedForm />);
		await expect.element(page.getByText(restoredNotice)).toBeVisible();

		await keptPage.hide();
		await keptPage.show();
		await expect.element(page.getByText(restoredNotice)).toBeVisible();

		await page.getByRole('button', { name: 'Discard unsaved changes' }).click();
		await title().fill('Lemon tart');
		await expect.poll(() => stored(recipeKey)?.text.title).toBe('Lemon tart');
		await keptPage.hide();
		await keptPage.show();

		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
		await expect.element(title()).toHaveValue('Lemon tart');
		expect(stored(recipeKey)?.text.title).toBe('Lemon tart');
	});

	it('restores nothing where the changes look as the form loaded, as a blank line swapped for another', async () => {
		const first = await render(<AutosavedForm />);
		await textbox('Ingredient 1').click();
		await userEvent.keyboard('{Enter}');
		await page.getByRole('button', { name: 'Actions for Ingredient 1' }).click();
		await page.getByRole('menuitem', { name: 'Remove' }).click();
		await expect.element(textbox('Ingredient 2')).not.toBeInTheDocument();
		expect(page.getByRole('textbox', { name: /^Ingredient/ })).toHaveLength(1);
		expect(localStorage.getItem(recipeKey)).toBeNull();
		await first.unmount();
		// What an older form kept for the same swap: the rows' ids moved on, and nothing shows else.
		localStorage.setItem(
			recipeKey,
			entryFor({
				...recipeFormSnapshot(recipeFormValues()),
				ingredientSections: { rows: [{ kind: 'item', id: 2, text: '' }] },
				nextId: 3,
			})
		);

		await render(<AutosavedForm />);

		await expect.poll(() => localStorage.getItem(recipeKey)).toBeNull();
		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
	});

	it('says when the restored changes were made, and clears once the form shows what it loaded', async () => {
		localStorage.setItem(
			recipeKey,
			entryFor(
				{ ...recipeFormSnapshot(recipeFormValues()), text: { ...blankText, title: 'L' } },
				writtenAt
			)
		);
		await render(<AutosavedForm />);

		await expect
			.element(page.getByText('Restored changes made in this browser on October 14 at 3:12 PM'))
			.toBeVisible();

		await title().clear();

		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
		await expect.poll(() => localStorage.getItem(recipeKey)).toBeNull();
		await title().fill('Lemon bars');
		await expect.poll(() => stored(recipeKey)?.text.title).toBe('Lemon bars');
		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
	});

	it('keeps when the restored changes were made until the member edits again', async () => {
		const kept = entryFor(
			{ ...recipeFormSnapshot(recipeFormValues()), text: { ...blankText, title: 'L' } },
			writtenAt
		);
		localStorage.setItem(recipeKey, kept);
		const first = await render(<AutosavedForm />);
		await expect.element(page.getByText(restoredNotice)).toBeVisible();
		expect(localStorage.getItem(recipeKey)).toBe(kept);
		await first.unmount();

		await render(<AutosavedForm />);

		await expect
			.element(
				page.getByText(`Restored changes made in this browser on ${formatDayAndTime(writtenAt)}`)
			)
			.toBeVisible();
		expect(localStorage.getItem(recipeKey)).toBe(kept);
		await title().fill('Lemon bars');
		await expect.poll(() => stored(recipeKey)?.text.title).toBe('Lemon bars');
		const edited = storedEntry(recipeKey) as AutosavedRecipeForm;
		expect(new Date(edited.writtenAt).getTime()).toBeGreaterThan(writtenAt.getTime());
	});

	it('never restores another member’s changes on this browser', async () => {
		const othersKey = `member:recipe-form:${otherMemberId}:recipe:${recipeId}`;
		const first = await render(<AutosavedForm member={otherMemberId} />);
		await title().fill('Lemon bars');
		await expect.poll(() => stored(othersKey)).toBeDefined();
		await first.unmount();

		await render(<AutosavedForm />);

		await expect.element(title()).toHaveValue('');
		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
		expect(stored(othersKey)?.text.title).toBe('Lemon bars');
	});

	it('removes entries as old as a saved draft’s lifetime, any member’s, as a form loads', async () => {
		const expired = new Date(
			Date.now() - daysInMilliseconds(settings.drafts.draftLifetimeDays) - 1000
		);
		const othersExpired = `member:recipe-form:${otherMemberId}:recipe:${otherRecipeId}`;
		const othersRecent = `member:recipe-form:${otherMemberId}:recipe:${recipeId}`;
		localStorage.setItem(recipeKey, entryFor(storedRecipe, expired));
		localStorage.setItem(othersExpired, entryFor(storedRecipe, expired));
		localStorage.setItem(othersRecent, entryFor(storedRecipe));
		// Kept before entries named their member and said when they were written.
		localStorage.setItem('member:recipe-form:new', JSON.stringify(storedRecipe));

		await render(<AutosavedForm />);

		await expect.poll(() => localStorage.getItem(othersExpired)).toBeNull();
		expect(localStorage.getItem(recipeKey)).toBeNull();
		expect(localStorage.getItem('member:recipe-form:new')).toBeNull();
		expect(localStorage.getItem(othersRecent)).not.toBeNull();
		await expect.element(title()).toHaveValue('');
	});

	it('removes the member’s entries for recipes the page knows are gone, as a form loads', async () => {
		const goneRecipeId = '0b6f3c7e-3c1a-4d8e-9a57-2f1d6b8e4c12';
		const knownAt = new Date();
		const before = new Date(knownAt.getTime() - 60 * 1000);
		const goneRecipe = `member:recipe-form:${memberId}:recipe:${goneRecipeId}`;
		const othersRecipe = `member:recipe-form:${otherMemberId}:recipe:${goneRecipeId}`;
		// A recipe the page never knew of, edited in another tab since.
		const writtenSince = `member:recipe-form:${memberId}:recipe:${otherRecipeId}`;
		for (const key of [goneRecipe, othersRecipe]) {
			localStorage.setItem(key, entryFor(storedRecipe, before));
		}
		localStorage.setItem(writtenSince, entryFor(storedRecipe, knownAt));

		await render(<AutosavedForm existing={{ knownAt, recipeIds: [recipeId] }} />);

		await expect.poll(() => localStorage.getItem(goneRecipe)).toBeNull();
		for (const key of [othersRecipe, writtenSince]) {
			expect(localStorage.getItem(key)).not.toBeNull();
		}
	});

	it('works as without it where the browser blocks storage', async () => {
		const action = vi.fn(refuse);
		vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		});
		await render(<AutosavedForm initial={recipeFormValues(lemonBars)} action={action} />);

		await title().fill('Lemon bars squares');
		await saveChanges().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		await expect.element(page.getByText(restoredNotice)).not.toBeInTheDocument();
	});
});

describe('RecipeForm as its page hydrates', () => {
	afterEach(() => {
		localStorage.clear();
	});

	it('keeps what was typed in each kind of field before the page hydrated, and saves and keeps it', async () => {
		const action = vi.fn(refuse);
		const form = (
			<AutosavedForm
				initial={recipeFormValues({
					...lemonBars,
					images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
				})}
				action={action}
			/>
		);
		const typed = [
			[title(), 'Lemon squares'],
			[textbox('Source (optional)'), 'Aunt May'],
			[textbox('Ingredient 1'), '1 cup sifted flour'],
			[textbox('Step 1'), 'Mix well.'],
			[textbox('Notes (optional)'), 'Best the next day.'],
			[textbox('Prep, in minutes'), '15'],
			[textbox('Servings'), '16'],
			[textbox(/^Describe the photo/), 'Bars on a plate'],
		] as const;
		const container = serverRender(form);
		for (const [field, text] of typed) {
			await field.fill(text);
		}

		await hydrate(container, form);

		for (const [field, text] of typed) {
			await expect.element(field).toHaveValue(text);
		}
		await expect.poll(() => stored(recipeKey)?.text.title).toBe('Lemon squares');
		await saveChanges().click();
		await expect.poll(() => action).toHaveBeenCalledOnce();
		const sent = action.mock.calls[0]?.[1].get('recipe');
		expect(JSON.parse(typeof sent === 'string' ? sent : '{}')).toMatchObject({
			title: 'Lemon squares',
			source: 'Aunt May',
			notes: 'Best the next day.',
			yield: { kind: 'servings', amount: '16' },
			times: { prepMinutes: '15' },
			ingredientSections: [{ lines: ['1 cup sifted flour', '2 eggs'] }],
			instructionSections: [{ steps: ['Mix well.'] }],
			chapter: 'desserts',
			images: [{ role: 'dish', alt: 'Bars on a plate' }],
		});
	});

	it('leaves focus and the caret in the field the reader was typing in, not the review’s intro', async () => {
		const form = <AutosavedForm initial={recipeFormValues(lemonBars, threeNotes)} />;
		const container = serverRender(form);
		await textbox('Ingredient 1').fill('1 cup sifted flour');
		textControl(textbox('Ingredient 1')).setSelectionRange(6, 12);

		await hydrate(container, form);

		await expect.element(textbox('Ingredient 1')).toHaveFocus();
		const { value, selectionStart, selectionEnd } = textControl(textbox('Ingredient 1'));
		expect({ value, selectionStart, selectionEnd }).toEqual({
			value: '1 cup sifted flour',
			selectionStart: 6,
			selectionEnd: 12,
		});
	});

	it('starts a form opened with notes to check, as an import’s draft is, on their intro where the reader went to no field first', async () => {
		const form = <AutosavedForm initial={recipeFormValues(lemonBars, threeNotes)} />;
		const container = serverRender(form);

		await hydrate(container, form);

		await expect.element(noteWith('3 things need a second look')).toHaveFocus();
	});

	it('keeps what was typed since the page hydrated as a page Next keeps shows again', async () => {
		const form = (
			<KeptPage>
				<AutosavedForm initial={recipeFormValues(lemonBars)} />
			</KeptPage>
		);
		const container = serverRender(form);
		await textbox('Ingredient 1').fill('1 cup sifted flour');
		await hydrate(container, form);
		await textbox('Ingredient 1').fill('1 cup sifted cake flour');

		await page.getByRole('button', { name: 'Leave the page' }).click();
		await page.getByRole('button', { name: 'Return to the page' }).click();

		await expect.element(textbox('Ingredient 1')).toHaveValue('1 cup sifted cake flour');
	});

	it('takes back what was typed before the page hydrated as one step', async () => {
		const form = <AutosavedForm initial={recipeFormValues(lemonBars)} />;
		const container = serverRender(form);
		await title().fill('Lemon squares');

		await hydrate(container, form);
		await pressUndo();

		await expect.element(title()).toHaveValue('Lemon bars');
		await pressRedo();
		await expect.element(title()).toHaveValue('Lemon squares');
	});
});

describe('RecipeForm’s drafts', () => {
	const savedAt = new Date('2026-10-15T19:12:00.000Z');
	const laterSavedAt = new Date('2026-10-15T19:13:00.000Z');

	// The form saves a second after the last change, so a wait for its status allows for that.
	const afterSaving = { timeout: 5_000 };

	const conflict =
		'This draft was saved somewhere else after you opened it here. Copy anything you want to keep, then reload the page to see that version.';

	// Saves every draft as the one id, at the one moment.
	function saving(result: FormState<SavedDraftResult> = { status: 'success', draftId, savedAt }) {
		return vi.fn<FormAction<SavedDraftResult>>(async () => result);
	}

	function draftsWith(
		save: FormAction<SavedDraftResult>,
		changes: Partial<RecipeFormDrafts> = {}
	): RecipeFormDrafts {
		return {
			save,
			delete: vi.fn<FormAction>(async () => ({ status: 'success' })),
			leave: vi.fn<RecipeFormDrafts['leave']>(async () => {}),
			page: 'new',
			...changes,
		};
	}

	function DraftForm({
		drafts,
		initial = recipeFormValues(),
		action = refuse,
	}: {
		drafts: RecipeFormDrafts;
		initial?: RecipeFormValues;
		action?: FormAction;
	}) {
		return (
			<RecipeForm
				initial={initial}
				action={action}
				uploadFolders={uploadFolders}
				uploader={vi.fn()}
				drafts={drafts}
			/>
		);
	}

	function finishLater() {
		return page.getByRole('button', { name: 'Finish later' });
	}

	function status(text: string) {
		return page.getByRole('status').filter({ hasText: text });
	}

	// The snapshot a save sent.
	function sentDraft(save: ReturnType<typeof saving>, call = 0): RecipeFormSnapshot {
		const sent = save.mock.calls[call]?.[1].get('draft');
		return JSON.parse(typeof sent === 'string' ? sent : '{}') as RecipeFormSnapshot;
	}

	// The draft and version a request named.
	function named(action: { mock: { calls: [unknown, FormData][] } }, call = 0) {
		const formData = action.mock.calls[call]?.[1];
		return { id: formData?.get('draftId'), version: formData?.get('draftVersion') };
	}

	afterEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		window.history.replaceState(null, '', '/');
	});

	it('says a new recipe saves once it holds something, and saves nothing for one left empty', async () => {
		const save = saving();
		await render(<DraftForm drafts={draftsWith(save)} />);

		await expect.element(status('Saves as a draft once you fill something in')).toBeInTheDocument();
		await title().fill('L');
		await title().clear();
		await new Promise((resolve) => setTimeout(resolve, 1_500));

		expect(save).not.toHaveBeenCalled();
	});

	it('saves a moment after a change, says so, counts the draft in the header, and then names it in the address', async () => {
		const save = saving();
		await render(<DraftForm drafts={draftsWith(save)} />);

		await title().fill('Lemon bars');

		await expect.element(status('Saving draft')).toBeInTheDocument();
		await expect.element(status('Draft saved'), afterSaving).toBeInTheDocument();
		expect(save).toHaveBeenCalledOnce();
		expect(sentDraft(save).text.title).toBe('Lemon bars');
		expect(named(save)).toEqual({ id: null, version: null });
		expect(router.refresh).toHaveBeenCalledOnce();
		await expect.poll(() => location.pathname).toBe(`/contribute/drafts/${draftId}`);
		// Nothing typed while adding a recipe is kept in this browser.
		expect(Object.keys(localStorage)).toEqual([]);
		// Saving needs nothing filled in, so no field shows a problem.
		expect(invalidFieldIds()).toEqual([]);
	});

	it('saves over the draft it holds, naming the version its last save made', async () => {
		const save = saving();
		await render(<DraftForm drafts={draftsWith(save)} />);
		await title().fill('Lemon bars');
		await expect.element(status('Draft saved'), afterSaving).toBeInTheDocument();
		save.mockResolvedValue({ status: 'success', draftId, savedAt: laterSavedAt });

		await title().fill('Lemon bars squares');

		await expect.poll(() => save, afterSaving).toHaveBeenCalledTimes(2);
		expect(named(save, 1)).toEqual({ id: draftId, version: savedAt.toISOString() });
		expect(sentDraft(save, 1).text.title).toBe('Lemon bars squares');
	});

	it('keeps one draft when typing goes on during a slow first save, and saves the latest over it', async () => {
		const first = heldResult<FormState<SavedDraftResult>>({
			status: 'success',
			draftId,
			savedAt,
		});
		const save = vi.fn<FormAction<SavedDraftResult>>(() => first.promise);
		await render(<DraftForm drafts={draftsWith(save)} />);
		await title().fill('Lemon');
		await expect.poll(() => save, afterSaving).toHaveBeenCalledOnce();

		await title().fill('Lemon bars');
		await new Promise((resolve) => setTimeout(resolve, 1_500));
		await title().fill('Lemon bars squares');
		await new Promise((resolve) => setTimeout(resolve, 1_500));
		expect(save).toHaveBeenCalledOnce();
		save.mockResolvedValue({ status: 'success', draftId, savedAt: laterSavedAt });
		first.resolve({ status: 'success', draftId, savedAt });

		await expect.poll(() => save, afterSaving).toHaveBeenCalledTimes(2);
		expect(named(save, 1)).toEqual({ id: draftId, version: savedAt.toISOString() });
		expect(sentDraft(save, 1).text.title).toBe('Lemon bars squares');
		await expect.element(status('Draft saved'), afterSaving).toBeInTheDocument();
	});

	it('saves over an import’s draft with its notes once something changes, at the draft’s own address', async () => {
		const save = saving();
		const openedAt = new Date('2026-10-15T12:00:00.000Z');
		window.history.replaceState(null, '', `/contribute/drafts/${draftId}`);
		await render(
			<DraftForm
				initial={recipeFormValues(lemonBars, threeNotes)}
				drafts={draftsWith(save, { opened: { id: draftId, savedAt: openedAt }, page: 'draft' })}
			/>
		);
		// What was read is the draft already.
		await expect.element(status('Draft saved')).toBeInTheDocument();

		await title().fill('Lemon squares');

		await expect.poll(() => save, afterSaving).toHaveBeenCalledOnce();
		expect(named(save)).toEqual({ id: draftId, version: openedAt.toISOString() });
		expect(sentDraft(save).reviewNotes).toHaveLength(3);
		expect(location.pathname).toBe(`/contribute/drafts/${draftId}`);
		// A draft's page never renders again under the form.
		expect(router.refresh).not.toHaveBeenCalled();
	});

	it('deletes the draft at the version it holds once the form is emptied, and says so', async () => {
		const drafts = draftsWith(saving(), {
			opened: { id: draftId, savedAt },
			page: 'draft',
		});
		window.history.replaceState(null, '', `/contribute/drafts/${draftId}`);
		await render(<DraftForm initial={recipeFormValues({ title: 'Lemon bars' })} drafts={drafts} />);

		await title().clear();

		await expect
			.element(status('Form is empty, so the draft was deleted'), afterSaving)
			.toBeInTheDocument();
		expect(drafts.delete).toHaveBeenCalledOnce();
		expect(named(vi.mocked(drafts.delete))).toEqual({
			id: draftId,
			version: savedAt.toISOString(),
		});
		// A reload opens an empty form, as the form now is.
		expect(location.pathname).toBe('/contribute/new');
	});

	it('says when another page saved the draft since, and saves no more', async () => {
		const save = saving({ status: 'error', message: conflict, fieldErrors: {} });
		await render(
			<DraftForm
				initial={recipeFormValues(lemonBars)}
				drafts={draftsWith(save, { opened: { id: draftId, savedAt }, page: 'draft' })}
			/>
		);

		await title().fill('Lemon bars squares');
		await expect.element(announced(conflict), afterSaving).toBeInTheDocument();
		await title().fill('Lemon bars squares with glaze');
		await new Promise((resolve) => setTimeout(resolve, 1_500));

		expect(save).toHaveBeenCalledOnce();
		await expect.element(title()).toHaveValue('Lemon bars squares with glaze');
	});

	it('shows an image the draft may not keep at its photo, and says the draft wasn’t saved', async () => {
		const withPhoto = recipeFormValues({
			title: 'Lemon bars',
			images: [{ role: 'dish', pathname: 'dish/development/bars.jpg' }],
		});
		const save = saving({
			status: 'error',
			fieldErrors: { 'images.0.pathname': 'This photo didn’t upload. Remove it and add it again.' },
		});
		await render(<DraftForm initial={withPhoto} drafts={draftsWith(save)} />);

		await title().fill('Lemon bars squares');

		await expect.element(status('The draft wasn’t saved.'), afterSaving).toBeInTheDocument();
		await expect
			.element(problemSummary('Fix 1 thing before adding it to the cookbook'))
			.toBeVisible();
		await expect
			.element(
				page
					.getByRole('list', { name: 'Photos' })
					.getByText('This photo didn’t upload. Remove it and add it again.')
			)
			.toBeVisible();
	});

	it('says the draft wasn’t saved when the save never reaches the site, and tries again with the next change', async () => {
		const save = vi.fn<FormAction<SavedDraftResult>>(async () => {
			throw new TypeError('Failed to fetch');
		});
		await render(<DraftForm drafts={draftsWith(save)} />);

		await title().fill('Lemon bars');
		await expect
			.element(
				status('We couldn’t save the draft. Check your connection; your next change tries again.'),
				afterSaving
			)
			.toBeInTheDocument();
		expect(location.pathname).toBe('/');
		save.mockResolvedValue({ status: 'success', draftId, savedAt });
		await title().fill('Lemon bars squares');

		await expect.element(status('Draft saved'), afterSaving).toBeInTheDocument();
		expect(save).toHaveBeenCalledTimes(2);
		expect(sentDraft(save, 1).text.title).toBe('Lemon bars squares');
	});

	it('adds the recipe from the draft a save in flight makes, and saves no more', async () => {
		const first = heldResult<FormState<SavedDraftResult>>({
			status: 'success',
			draftId,
			savedAt,
		});
		const save = vi.fn<FormAction<SavedDraftResult>>(() => first.promise);
		// Adding stays in flight, as one that leads to the recipe does.
		const added = heldResult<FormState>({ status: 'idle' });
		const action = vi.fn<FormAction>(() => added.promise);
		await render(
			<DraftForm initial={recipeFormValues(lemonBars)} action={action} drafts={draftsWith(save)} />
		);
		await title().fill('Lemon squares');
		await expect.poll(() => save, afterSaving).toHaveBeenCalledOnce();
		await title().fill('Lemon squares with glaze');

		await saveRecipe().click();
		await expect.element(page.getByRole('button', { name: 'Adding to cookbook' })).toBeVisible();
		expect(action).not.toHaveBeenCalled();
		first.resolve({ status: 'success', draftId, savedAt });

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(action.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(save).toHaveBeenCalledOnce();
	});

	it('adds a recipe with no draft where none was saved yet, and saves none', async () => {
		const save = saving();
		const added = heldResult<FormState>({ status: 'idle' });
		const action = vi.fn<FormAction>(() => added.promise);
		await render(
			<DraftForm initial={recipeFormValues(lemonBars)} action={action} drafts={draftsWith(save)} />
		);
		await title().fill('Lemon squares');

		await saveRecipe().click();

		await expect.poll(() => action).toHaveBeenCalledOnce();
		expect(action.mock.calls[0]?.[1].get('draftId')).toBeNull();
		await new Promise((resolve) => setTimeout(resolve, 1_500));
		expect(save).not.toHaveBeenCalled();
	});

	it('saves what the form shows once adding fails', async () => {
		const save = saving();
		await render(
			<DraftForm
				initial={recipeFormValues(lemonBars)}
				drafts={draftsWith(save, { opened: { id: draftId, savedAt }, page: 'draft' })}
			/>
		);
		await title().fill('Lemon squares');

		await saveRecipe().click();

		await expect.poll(() => save, afterSaving).toHaveBeenCalledOnce();
		expect(sentDraft(save).text.title).toBe('Lemon squares');
		await expect
			.element(problemSummary('Fix 1 thing before adding it to the cookbook'))
			.toBeVisible();
	});

	it('finishes later once its save is done, naming the draft on the start page', async () => {
		const first = heldResult<FormState<SavedDraftResult>>({
			status: 'success',
			draftId,
			savedAt,
		});
		const save = vi.fn<FormAction<SavedDraftResult>>(() => first.promise);
		const drafts = draftsWith(save);
		await render(<DraftForm drafts={drafts} />);
		await title().fill('Lemon bars');

		await finishLater().click();

		await expect.poll(() => save).toHaveBeenCalledOnce();
		expect(drafts.leave).not.toHaveBeenCalled();
		first.resolve({ status: 'success', draftId, savedAt });
		await expect.poll(() => drafts.leave).toHaveBeenCalledWith(draftId, 'push');
	});

	it('finishes later with nothing to name where the form holds nothing', async () => {
		const drafts = draftsWith(saving());
		await render(<DraftForm drafts={drafts} />);

		await finishLater().click();

		await expect.poll(() => drafts.leave).toHaveBeenCalledWith(undefined, 'push');
	});

	it('stays where the draft couldn’t be saved as it finishes later', async () => {
		const save = vi.fn<FormAction<SavedDraftResult>>(async () => {
			throw new TypeError('Failed to fetch');
		});
		const drafts = draftsWith(save);
		await render(<DraftForm drafts={drafts} />);
		await title().fill('Lemon bars');

		await finishLater().click();

		await expect
			.element(
				status('We couldn’t save the draft. Check your connection; your next change tries again.')
			)
			.toBeInTheDocument();
		expect(drafts.leave).not.toHaveBeenCalled();
		await expect.element(finishLater()).toBeEnabled();
	});

	it('offers no draft when editing a published recipe', async () => {
		await render(
			<AutosavedForm
				initial={recipeFormValues(lemonBars)}
				editing={{ id: recipeId, version: 'a' }}
			/>
		);

		await expect.element(saveChanges()).toBeVisible();
		await expect.element(finishLater()).not.toBeInTheDocument();
		await expect.element(page.getByText(/draft/i)).not.toBeInTheDocument();
	});
});

describe('RecipeForm with its page’s menu', () => {
	const succeed: FormAction = async () => ({ status: 'success' });

	afterEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		window.history.replaceState(null, '', '/');
	});

	async function confirmDelete(menu: string, name: string) {
		await page.getByRole('button', { name: menu }).click();
		await page.getByRole('menuitem', { name }).click();
		await page.getByRole('alertdialog').getByRole('button', { name }).click();
	}

	it('deletes the recipe being edited, the form’s unsaved changes and no others first, and leaves for the list', async () => {
		const otherRecipeKey = `member:recipe-form:${memberId}:recipe:${otherRecipeId}`;
		const otherEntry = JSON.stringify({
			version: recipeVersion,
			writtenAt: new Date().toISOString(),
			form: recipeFormSnapshot(recipeFormValues()),
		} satisfies AutosavedRecipeForm);
		localStorage.setItem(otherRecipeKey, otherEntry);
		let entryAsItLeft: string | null | undefined;
		router.replace.mockImplementation(() => {
			entryAsItLeft = localStorage.getItem(recipeKey);
		});
		await render(
			<>
				<EditedRecipeMenu
					recipe={{ id: recipeId, slug: 'lemon-bars', title: 'Lemon bars' }}
					memberId={memberId}
					action={succeed}
				/>
				<AutosavedForm initial={recipeFormValues(lemonBars)} />
			</>
		);
		await title().fill('Lemon bars squares');
		await expect.poll(() => localStorage.getItem(recipeKey)).not.toBeNull();

		await confirmDelete('Recipe actions', 'Delete recipe');

		await expect.poll(() => router.replace).toHaveBeenCalledWith('/');
		expect(entryAsItLeft).toBeNull();
		expect(localStorage.getItem(recipeKey)).toBeNull();
		expect(localStorage.getItem(otherRecipeKey)).toBe(otherEntry);
	});

	it('offers Delete draft once the form saves a draft, deletes it at the version saved last, and leaves for the start page', async () => {
		const remove = vi.fn(succeed);
		const leave = vi.fn<RecipeFormDrafts['leave']>(async () => {});
		const save = vi.fn<FormAction<SavedDraftResult>>(async () => ({
			status: 'success',
			draftId,
			savedAt: new Date('2026-10-15T19:12:00.000Z'),
		}));
		await render(
			<HeldDraftProvider opened={undefined}>
				<HeldDraftMenu action={remove} />
				<RecipeForm
					initial={recipeFormValues()}
					action={refuse}
					uploadFolders={uploadFolders}
					uploader={vi.fn()}
					drafts={{ save, delete: vi.fn(), leave, page: 'new' }}
				/>
			</HeldDraftProvider>
		);
		await expect
			.element(page.getByRole('button', { name: 'Draft actions' }))
			.not.toBeInTheDocument();
		await title().fill('Lemon bars');
		await expect
			.element(page.getByRole('button', { name: 'Draft actions' }), { timeout: 5_000 })
			.toBeVisible();
		// Typed just before deleting, which deleting drops rather than saves.
		await title().fill('Lemon bars squares');

		await page.getByRole('button', { name: 'Draft actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete draft' }).click();
		// Named as it was saved, which is what the delete takes away.
		const dialog = page.getByRole('alertdialog', { name: 'Delete the draft of “Lemon bars”?' });
		await dialog.getByRole('button', { name: 'Delete draft' }).click();

		await expect.poll(() => leave).toHaveBeenCalledWith(undefined, 'replace');
		expect(remove.mock.calls[0]?.[1].get('draftId')).toBe(draftId);
		expect(remove.mock.calls[0]?.[1].get('draftVersion')).toBe('2026-10-15T19:12:00.000Z');
		await new Promise((resolve) => setTimeout(resolve, 1_500));
		expect(save).toHaveBeenCalledOnce();
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
