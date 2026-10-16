import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DraftProvenanceLine } from '@/components/recipe-import/draft-provenance-line';

describe('DraftProvenanceLine', () => {
	it('names the host of the page a link import read, linking to it', () => {
		render(<DraftProvenanceLine mode="url" sourceUrl="https://example.com/soup" />);

		expect(screen.getByText(/^Imported from/).textContent).toBe('Imported from example.com');
		expect(screen.getByRole('link', { name: 'example.com' }).getAttribute('href')).toBe(
			'https://example.com/soup'
		);
	});

	it('says a photo import read the member’s photos', () => {
		render(<DraftProvenanceLine mode="photo" sourceUrl={undefined} />);

		expect(screen.getByText('Read from your photos')).toBeDefined();
	});

	it('shows nothing for a draft entered by hand', () => {
		const { container } = render(<DraftProvenanceLine mode={undefined} sourceUrl={undefined} />);

		expect(container.textContent).toBe('');
	});
});
