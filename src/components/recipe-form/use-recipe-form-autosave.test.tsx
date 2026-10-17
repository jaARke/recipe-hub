import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import {
	recipeFormSnapshot,
	showSameRecipeForm,
} from '@/components/recipe-form/recipe-form-snapshot';
import { editRecipeForm, recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { useRecipeFormAutosave } from '@/components/recipe-form/use-recipe-form-autosave';

const memberId = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const newRecipeKey = `member:recipe-form:${memberId}:new`;

// A new recipe's title, kept as the recipe form keeps it, and Leave, as a save that leads away does.
function TitleForm() {
	const [initial] = React.useState(() => recipeFormValues());
	const [values, dispatch] = React.useReducer(editRecipeForm, initial);
	const autosaved = useRecipeFormAutosave({
		memberId,
		subject: { kind: 'new' },
		baseline: initial,
		values,
		unchanged: showSameRecipeForm(recipeFormSnapshot(values), recipeFormSnapshot(initial)),
		dispatch,
		onRestore: () => {},
		onOutdated: () => {},
	});
	return (
		<>
			<input
				aria-label="Title"
				value={values.text.title}
				onChange={(event) =>
					dispatch({ type: 'setText', field: 'title', text: event.target.value })
				}
			/>
			<button type="button" onClick={autosaved.leave}>
				Leave
			</button>
		</>
	);
}

afterEach(() => {
	localStorage.clear();
});

describe('useRecipeFormAutosave', () => {
	it('never writes back what a page kept after a save led away, and keeps what is typed on return', async () => {
		const keptPage = await renderKeptPage(<TitleForm />);
		const title = page.getByRole('textbox', { name: 'Title' });
		await title.fill('Lemon bars');
		await expect.poll(() => localStorage.getItem(newRecipeKey)).toContain('Lemon bars');

		await page.getByRole('button', { name: 'Leave' }).click();
		await expect.poll(() => localStorage.getItem(newRecipeKey)).toBeNull();
		await keptPage.hide();
		await keptPage.show();

		expect(localStorage.getItem(newRecipeKey)).toBeNull();
		await expect.element(title).toHaveValue('Lemon bars');
		await title.fill('Lemon bars squares');
		await expect.poll(() => localStorage.getItem(newRecipeKey)).toContain('Lemon bars squares');
	});
});
