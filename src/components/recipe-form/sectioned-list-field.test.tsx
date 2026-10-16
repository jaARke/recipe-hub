import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { editRecipeForm, recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { SectionedListField } from '@/components/recipe-form/sectioned-list-field';
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

function textbox(name: string): HTMLTextAreaElement {
	const element = screen.getByRole('textbox', { name });
	if (!(element instanceof HTMLTextAreaElement)) {
		throw new Error(`${name} is no textarea.`);
	}
	return element;
}

// The browser's own undo or redo, sent to the field whose typing is on top of its page's stack.
function browserHistoryInput(field: HTMLElement, inputType: 'historyUndo' | 'historyRedo') {
	return fireEvent(
		field,
		new InputEvent('beforeinput', { inputType, cancelable: true, bubbles: true })
	);
}

describe('SectionedListField’s undo', () => {
	beforeEach(() => {
		vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('undoes only the focused row’s typing, step by step, and redoes it', async () => {
		const user = userEvent.setup();
		render(<Lists />);

		await user.click(textbox('Ingredient 1'));
		await user.keyboard(', sifted');
		await user.click(textbox('Ingredient 2'));
		await user.keyboard(', beaten');
		await user.click(textbox('Ingredient 1'));
		await user.keyboard('{Home}About ');
		expect(textbox('Ingredient 1').value).toBe('About 1 cup flour, sifted');

		await user.keyboard('{Meta>}z{/Meta}');
		expect(textbox('Ingredient 1').value).toBe('1 cup flour, sifted');
		expect(textbox('Ingredient 1').selectionStart).toBe(0);
		await user.keyboard('{Meta>}z{/Meta}');
		expect(textbox('Ingredient 1').value).toBe('1 cup flour');
		expect(textbox('Ingredient 1').selectionStart).toBe(11);
		// With nothing left to undo here, the browser's undo of the other row never runs.
		await user.keyboard('{Meta>}z{/Meta}');
		expect(textbox('Ingredient 1').value).toBe('1 cup flour');
		expect(textbox('Ingredient 2').value).toBe('2 eggs, beaten');

		await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
		expect(textbox('Ingredient 1').value).toBe('1 cup flour, sifted');
		await user.keyboard('{Meta>}{Shift>}Z{/Shift}{/Meta}');
		expect(textbox('Ingredient 1').value).toBe('About 1 cup flour, sifted');
		expect(textbox('Ingredient 2').value).toBe('2 eggs, beaten');
	});

	it('turns the browser’s undo to the focused row, wherever the browser sends it', async () => {
		const user = userEvent.setup();
		render(<Lists />);

		await user.click(textbox('Ingredient 1'));
		await user.keyboard(', sifted');
		await user.click(textbox('Step 1'));
		await user.keyboard(' Bake.');
		await user.click(textbox('Ingredient 1'));

		expect(browserHistoryInput(textbox('Step 1'), 'historyUndo')).toBe(false);
		expect(textbox('Ingredient 1').value).toBe('1 cup flour');
		expect(textbox('Step 1').value).toBe('Mix. Bake.');

		expect(browserHistoryInput(textbox('Step 1'), 'historyRedo')).toBe(false);
		expect(textbox('Ingredient 1').value).toBe('1 cup flour, sifted');
		expect(textbox('Step 1').value).toBe('Mix. Bake.');
	});

	it('never lets the browser’s undo change a row without focus', async () => {
		const user = userEvent.setup();
		render(<Lists />);

		await user.click(textbox('Ingredient 2'));
		await user.keyboard(', beaten');
		await user.tab();
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Actions for Ingredient 2' })
		);

		expect(browserHistoryInput(textbox('Ingredient 2'), 'historyUndo')).toBe(false);
		expect(textbox('Ingredient 2').value).toBe('2 eggs, beaten');
	});

	it('starts a row’s undo over once the form changes its text, by a paste of lines or starting over', async () => {
		const user = userEvent.setup();
		render(<Lists />);

		await user.click(textbox('Ingredient 2'));
		await user.keyboard(' beaten');
		textbox('Ingredient 2').setSelectionRange(0, 2);
		await user.paste('1 cup milk\n1 cup cream');
		expect(textbox('Ingredient 2').value).toBe('eggs beaten');
		await user.click(textbox('Ingredient 2'));
		await user.keyboard('{Meta>}z{/Meta}');
		expect(textbox('Ingredient 2').value).toBe('eggs beaten');

		await user.click(textbox('Ingredient 1'));
		await user.keyboard(', sifted');
		await user.click(screen.getByRole('button', { name: 'Start over' }));
		await user.click(textbox('Ingredient 1'));
		await user.keyboard('{Meta>}z{/Meta}');
		expect(textbox('Ingredient 1').value).toBe('2 cups sugar');
	});
});
