import { act, render } from '@testing-library/react';
import * as React from 'react';

// Renders the content on a page Next keeps when the member leaves it: hide and show do what leaving
// and returning do, hiding the page with Activity rather than unmounting it.
export function renderKeptPage(content: React.ReactNode) {
	const page = (mode: React.ActivityProps['mode']) => (
		<React.Activity mode={mode}>{content}</React.Activity>
	);
	const { rerender } = render(page('visible'));
	return {
		hide: () => act(async () => rerender(page('hidden'))),
		show: () => act(async () => rerender(page('visible'))),
	};
}
