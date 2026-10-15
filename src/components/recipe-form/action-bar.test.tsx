import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionBar } from '@/components/recipe-form/action-bar';

// Stands in for the browser's observers, which happy-dom never calls back: each test reports what the
// browser would, for the element observed.
function fakeObservers() {
	const observed = { intersection: [] as Element[], resize: [] as Element[] };
	let reportIntersection: (entry: Partial<IntersectionObserverEntry>) => void = () => {};
	let reportResize: (blockSize: number) => void = () => {};
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(callback: IntersectionObserverCallback) {
				reportIntersection = (entry) =>
					callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver);
			}
			observe(element: Element) {
				observed.intersection.push(element);
			}
			disconnect() {}
		}
	);
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: ResizeObserverCallback) {
				reportResize = (blockSize) =>
					callback(
						[{ borderBoxSize: [{ blockSize, inlineSize: 0 }] } as unknown as ResizeObserverEntry],
						this as unknown as ResizeObserver
					);
			}
			observe(element: Element) {
				observed.resize.push(element);
			}
			disconnect() {}
		}
	);
	return {
		observed,
		// Where the sentinel sits: on the screen, or below or above it.
		sentinelAt: (place: 'screen' | 'below' | 'above') =>
			act(() =>
				reportIntersection({
					isIntersecting: place === 'screen',
					boundingClientRect: { top: place === 'above' ? -40 : 900 } as DOMRectReadOnly,
				})
			),
		barResized: (blockSize: number) => act(() => reportResize(blockSize)),
	};
}

function renderBar() {
	return render(
		<form aria-label="Recipe">
			<ActionBar status={<p>3 to check</p>}>
				<button type="submit">Save</button>
			</ActionBar>
		</form>
	);
}

function bar(): HTMLElement {
	const element = screen
		.getByRole('button', { name: 'Save' })
		.closest<HTMLElement>('[data-action-bar]');
	if (element === null) {
		throw new Error('Save is in no action bar.');
	}
	return element;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ActionBar', () => {
	it('is held at the screen’s bottom while its place, which the sentinel marks, is below the screen', () => {
		const { observed, sentinelAt } = fakeObservers();
		renderBar();

		// The sentinel follows the bar, at the end of the bar's place.
		expect(observed.intersection).toEqual([bar().nextElementSibling]);
		expect(bar().hasAttribute('data-held')).toBe(false);

		sentinelAt('below');
		expect(bar().hasAttribute('data-held')).toBe(true);

		sentinelAt('screen');
		expect(bar().hasAttribute('data-held')).toBe(false);

		// Scrolled past, the bar is at its place above the screen.
		sentinelAt('above');
		expect(bar().hasAttribute('data-held')).toBe(false);
	});

	it('keeps its height on its form while it is shown, as it changes', () => {
		const { observed, barResized } = fakeObservers();
		const { unmount } = renderBar();
		const form = screen.getByRole('form', { name: 'Recipe' });

		expect(observed.resize).toEqual([bar()]);
		barResized(60);
		expect(form.style.getPropertyValue('--action-bar-height')).toBe('60px');
		barResized(108);
		expect(form.style.getPropertyValue('--action-bar-height')).toBe('108px');

		unmount();
		expect(form.style.getPropertyValue('--action-bar-height')).toBe('');
	});
});
