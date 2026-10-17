import { expect, type Locator } from '@playwright/test';

// React DOM keeps an element's props under this key once it hydrates the element, and runs its
// events from them. Next's router mounts sooner, before a Suspense boundary's links hydrate.
const reactPropsKeyPrefix = '__reactProps$';

// A control pressed before React hydrates it misses its handler: a link loads its page in full rather
// than navigating in the tab, and a button does nothing.
export async function waitForHydration(target: Locator): Promise<void> {
	await expect
		.poll(
			() =>
				target.evaluate(
					(element, prefix) => Object.keys(element).some((key) => key.startsWith(prefix)),
					reactPropsKeyPrefix
				),
			{ message: 'React hydrates the element' }
		)
		.toBe(true);
}
