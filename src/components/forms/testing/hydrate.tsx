import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach } from 'vitest';

const containers: HTMLElement[] = [];
const roots: Root[] = [];

afterEach(async () => {
	await inAct(() => {
		for (const root of roots.splice(0)) {
			root.unmount();
		}
	});
	for (const container of containers.splice(0)) {
		container.remove();
	}
});

// Shows the content as the server sends it, in a container the test can read before hydrating it;
// vitest-browser-react renders only on the client.
export function serverRender(content: React.ReactNode): HTMLElement {
	const container = document.body.appendChild(document.createElement('div'));
	container.innerHTML = renderToString(content);
	containers.push(container);
	return container;
}

// Hydrates the server's markup in an act that is awaited, so the effects hydration runs are done.
export async function hydrate(container: HTMLElement, content: React.ReactNode) {
	await inAct(() => {
		roots.push(hydrateRoot(container, content));
	});
}

// React warns of an act outside a test environment that declares it, and vitest-browser-react
// declares one only within its own acts.
async function inAct(callback: () => void) {
	const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
	const declared = environment.IS_REACT_ACT_ENVIRONMENT;
	environment.IS_REACT_ACT_ENVIRONMENT = true;
	try {
		await React.act(async () => callback());
	} finally {
		environment.IS_REACT_ACT_ENVIRONMENT = declared;
	}
}
