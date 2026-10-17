import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { renderKeptPage } from '@/components/forms/testing/kept-page';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';

// Says as its page hides how many times it was pressed.
function ProbeCounter({ onHide }: { onHide: (presses: number) => void }) {
	const [presses, setPresses] = useState(0);
	useOnKeptPageHide(() => onHide(presses));

	return (
		<button type="button" onClick={() => setPresses(presses + 1)}>
			Press
		</button>
	);
}

describe('useOnKeptPageHide', () => {
	it('runs once as its page hides, with what its last render saw', async () => {
		const onHide = vi.fn();
		const keptPage = await renderKeptPage(<ProbeCounter onHide={onHide} />);

		await page.getByRole('button', { name: 'Press' }).click();
		await page.getByRole('button', { name: 'Press' }).click();
		expect(onHide).not.toHaveBeenCalled();
		await keptPage.hide();
		await keptPage.show();

		expect(onHide.mock.calls).toEqual([[2]]);
	});
});
