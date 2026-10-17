import * as React from 'react';
import { render } from 'vitest-browser-react';

// Renders the content on a page Next keeps when the member leaves it: hide and show do what leaving
// and returning do, hiding the page with Activity rather than unmounting it.
export async function renderKeptPage(content: React.ReactNode) {
	const page = (mode: React.ActivityProps['mode']) => (
		<React.Activity mode={mode}>{content}</React.Activity>
	);
	const { rerender } = await render(page('visible'));
	return {
		hide: () => rerender(page('hidden')),
		show: () => rerender(page('visible')),
	};
}
