import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
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
		const user = userEvent.setup();
		const page = renderKeptPage(<TitleForm />);
		await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Lemon bars');
		expect(localStorage.getItem(newRecipeKey)).not.toBeNull();

		await user.click(screen.getByRole('button', { name: 'Leave' }));
		expect(localStorage.getItem(newRecipeKey)).toBeNull();
		await page.hide();
		await page.show();

		expect(localStorage.getItem(newRecipeKey)).toBeNull();
		await user.type(screen.getByRole('textbox', { name: 'Title' }), ' squares');
		expect(localStorage.getItem(newRecipeKey)).toContain('Lemon bars squares');
	});
});
