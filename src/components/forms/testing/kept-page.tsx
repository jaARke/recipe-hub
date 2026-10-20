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

// A member acts on a page a task after it shows at the soonest.
function nextTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve));
}

// Renders the content on a page Next keeps, as renderKeptPage does, rendering it again as the page
// shows, under the bfcacheId of the visit that shows it: a return through history keeps the visit's,
// and a link or a redirect gives the router stub a new one.
export async function renderVisitedPage(
	content: () => React.ReactNode,
	router: { bfcacheId: string }
) {
	const page = (mode: React.ActivityProps['mode']) => (
		<React.Activity mode={mode}>{content()}</React.Activity>
	);
	const { rerender } = await render(page('visible'));
	await nextTask();
	return {
		leave: () => rerender(page('hidden')),
		returnBy: async (way: 'history' | 'link') => {
			if (way === 'link') {
				router.bfcacheId = `${router.bfcacheId}-again`;
			}
			await rerender(page('visible'));
			await nextTask();
		},
	};
}

// A page Next keeps, as renderKeptPage renders one, for content a test server-renders and hydrates,
// which no rerender reaches: its buttons, outside the page, leave and return.
export function KeptPage({ children }: { children: React.ReactNode }) {
	const [mode, setMode] = React.useState<React.ActivityProps['mode']>('visible');
	return (
		<>
			<button type="button" onClick={() => setMode('hidden')}>
				Leave the page
			</button>
			<button type="button" onClick={() => setMode('visible')}>
				Return to the page
			</button>
			<React.Activity mode={mode}>{children}</React.Activity>
		</>
	);
}
