import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { ClassificationFields } from '@/components/recipe-form/classification-fields';

describe('ClassificationFields', () => {
	it('names the chapters’ radio group by its legend', async () => {
		await render(
			<ClassificationFields
				idPrefix="recipe"
				chapter={undefined}
				holidays={[]}
				diets={[]}
				errors={{}}
				noteFor={() => undefined}
				dispatch={() => {}}
			/>
		);

		await expect
			.element(page.getByRole('radiogroup', { name: 'Chapter', exact: true }))
			.toBeInTheDocument();
	});
});
