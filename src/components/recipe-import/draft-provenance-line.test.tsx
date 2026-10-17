import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { DraftProvenanceLine } from '@/components/recipe-import/draft-provenance-line';

describe('DraftProvenanceLine', () => {
	it('names the host of the page a link import read, linking to it', async () => {
		await render(<DraftProvenanceLine mode="url" sourceUrl="https://example.com/soup" />);

		await expect.element(page.getByText('Imported from example.com')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'example.com' }))
			.toHaveAttribute('href', 'https://example.com/soup');
	});

	it('says a photo import read the member’s photos', async () => {
		await render(<DraftProvenanceLine mode="photo" sourceUrl={undefined} />);

		await expect.element(page.getByText('Read from your photos')).toBeVisible();
	});

	it('shows nothing for a draft entered by hand', async () => {
		const { container } = await render(
			<DraftProvenanceLine mode={undefined} sourceUrl={undefined} />
		);

		expect(container).toBeEmptyDOMElement();
	});
});
