import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import { editRecipeForm, recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { SectionedListField } from '@/components/recipe-form/sectioned-list-field';
import {
	pasteText,
	pressRedo,
	pressUndo,
	sendHistoryInput,
	textControl,
} from '@/components/recipe-form/testing/text-editing';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';

const lemonBars: RecipeDraftContent = {
	title: 'Lemon bars',
	ingredientSections: [{ lines: [{ text: '1 cup flour' }, { text: '2 eggs' }] }],
	instructionSections: [{ steps: [{ text: 'Mix.' }] }],
};

const shortbread: RecipeDraftContent = {
	title: 'Shortbread',
	ingredientSections: [{ lines: [{ text: '2 cups sugar' }, { text: '1 cup butter' }] }],
	instructionSections: [{ steps: [{ text: 'Bake.' }] }],
};

// A recipe form's two lists, with a way to put the whole form back as another recipe, as discarding
// unsaved changes does.
function Lists() {
	const [values, dispatch] = React.useReducer(editRecipeForm, undefined, () =>
		recipeFormValues(lemonBars)
	);

	return (
		<>
			<SectionedListField
				idPrefix="ingredients"
				name="ingredientSections"
				list={values.ingredientSections}
				nextId={values.nextId}
				dispatch={dispatch}
				legend="Ingredients"
				description="One ingredient per line."
				noun="ingredient"
				itemPlaceholder="2 cups flour"
				headingPlaceholder="For the glaze"
			/>
			<SectionedListField
				idPrefix="steps"
				name="instructionSections"
				list={values.instructionSections}
				nextId={values.nextId}
				dispatch={dispatch}
				legend="Steps"
				description="One step per line."
				noun="step"
				itemPlaceholder="Heat the oven."
				headingPlaceholder="For the glaze"
				numbered
			/>
			<button
				type="button"
				onClick={() => dispatch({ type: 'replaceForm', values: recipeFormValues(shortbread) })}
			>
				Start over
			</button>
		</>
	);
}

function textbox(name: string) {
	return page.getByRole('textbox', { name });
}

describe('SectionedListField’s undo', () => {
	it('undoes only the focused row’s typing, step by step, and redoes it', async () => {
		await render(<Lists />);

		await textbox('Ingredient 1').click();
		await userEvent.keyboard(', sifted');
		await textbox('Ingredient 2').click();
		await userEvent.keyboard(', beaten');
		await textbox('Ingredient 1').click();
		textControl(textbox('Ingredient 1')).setSelectionRange(0, 0);
		await userEvent.keyboard('About ');
		await expect.element(textbox('Ingredient 1')).toHaveValue('About 1 cup flour, sifted');

		await pressUndo();
		await expect.element(textbox('Ingredient 1')).toHaveValue('1 cup flour, sifted');
		expect(textControl(textbox('Ingredient 1')).selectionStart).toBe(0);
		await pressUndo();
		await expect.element(textbox('Ingredient 1')).toHaveValue('1 cup flour');
		expect(textControl(textbox('Ingredient 1')).selectionStart).toBe(11);
		// With nothing left to undo here, the browser's own undo of the other row never runs.
		await pressUndo();
		expect(textControl(textbox('Ingredient 1')).value).toBe('1 cup flour');
		expect(textControl(textbox('Ingredient 2')).value).toBe('2 eggs, beaten');

		await pressRedo();
		await expect.element(textbox('Ingredient 1')).toHaveValue('1 cup flour, sifted');
		await pressRedo();
		await expect.element(textbox('Ingredient 1')).toHaveValue('About 1 cup flour, sifted');
		expect(textControl(textbox('Ingredient 2')).value).toBe('2 eggs, beaten');
	});

	it('turns the browser’s undo to the focused row, wherever the browser sends it', async () => {
		await render(<Lists />);

		await textbox('Ingredient 1').click();
		await userEvent.keyboard(', sifted');
		await textbox('Step 1').click();
		await userEvent.keyboard(' Bake.');
		await textbox('Ingredient 1').click();

		expect(sendHistoryInput(textbox('Step 1'), 'historyUndo')).toBe(false);
		await expect.element(textbox('Ingredient 1')).toHaveValue('1 cup flour');
		expect(textControl(textbox('Step 1')).value).toBe('Mix. Bake.');

		expect(sendHistoryInput(textbox('Step 1'), 'historyRedo')).toBe(false);
		await expect.element(textbox('Ingredient 1')).toHaveValue('1 cup flour, sifted');
		expect(textControl(textbox('Step 1')).value).toBe('Mix. Bake.');
	});

	it('never lets the browser’s undo change a row without focus', async () => {
		await render(<Lists />);

		await textbox('Ingredient 2').click();
		await userEvent.keyboard(', beaten');
		await page.getByText('One ingredient per line.').click();
		expect(document.activeElement).toBe(document.body);

		// Where its undo is the page's, the browser sends it to the row last typed in.
		await pressUndo();

		expect(textControl(textbox('Ingredient 2')).value).toBe('2 eggs, beaten');
	});

	it('starts a row’s undo over once the form changes its text, by a paste of lines or starting over', async () => {
		await render(<Lists />);

		await textbox('Ingredient 2').click();
		await userEvent.keyboard(' beaten');
		textControl(textbox('Ingredient 2')).setSelectionRange(0, 2);
		await pasteText('1 cup milk\n1 cup cream');
		await expect.element(textbox('Ingredient 4')).toHaveFocus();
		expect(textControl(textbox('Ingredient 2')).value).toBe('eggs beaten');
		await textbox('Ingredient 2').click();
		await pressUndo();
		expect(textControl(textbox('Ingredient 2')).value).toBe('eggs beaten');

		await textbox('Ingredient 1').click();
		await userEvent.keyboard(', sifted');
		await page.getByRole('button', { name: 'Start over' }).click();
		await expect.element(textbox('Ingredient 1')).toHaveValue('2 cups sugar');
		await textbox('Ingredient 1').click();
		await pressUndo();
		expect(textControl(textbox('Ingredient 1')).value).toBe('2 cups sugar');
	});
});
