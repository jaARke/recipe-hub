import { describe, expect, it } from 'vitest';
import {
	recipeImportFieldNames,
	scanFieldValue,
	scanUploadsFromForm,
} from '@/components/recipe-import/recipe-import-forms';

const front = {
	pathname: 'scan/development/0b6e2f4a-9c1d-4e8b-a7f3-5d2c1b0a9e8f.jpg',
	size: { width: 2304, height: 3072 },
};
const back = {
	pathname: 'scan/development/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b.jpg',
	size: { width: 3072, height: 2304 },
};

function formWith(values: readonly string[]): FormData {
	const formData = new FormData();
	for (const value of values) {
		formData.append(recipeImportFieldNames.scans, value);
	}
	return formData;
}

describe('scanUploadsFromForm', () => {
	it('reads each page as its field sent it, in order', () => {
		expect(scanUploadsFromForm(formWith([front, back].map(scanFieldValue)))).toEqual([front, back]);
	});

	it('reads none from a form without pages', () => {
		expect(scanUploadsFromForm(new FormData())).toEqual([]);
	});

	it.each([
		{ page: 'a bare pathname, as a page from before sizes sends', value: front.pathname },
		{ page: 'a page without its pathname', value: JSON.stringify({ size: front.size }) },
		{
			page: 'a page whose size is no size',
			value: JSON.stringify({ ...front, size: { width: '2304', height: 3072 } }),
		},
	])('asks for a reload on $page', ({ value }) => {
		expect(() => scanUploadsFromForm(formWith([scanFieldValue(front), value]))).toThrow(
			expect.objectContaining({
				problems: [
					{ path: '', message: 'We couldn’t read the photos. Reload the page and try again.' },
				],
			})
		);
	});
});
