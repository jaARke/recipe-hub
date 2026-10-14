'use client';

import * as React from 'react';
import { useHydrated } from '@/components/forms/use-hydrated';

// Fields on a page that join a form outside it, as the search page's join the header's. Next keeps
// a page the member leaves, hidden, and its fields would still submit with that form, so their
// fieldset is disabled as the page hides and enabled as it shows: a disabled fieldset's fields
// never submit. Written to the DOM in the layout effect, as useTransientState resets, since a
// hidden page re-renders at low priority and the form could submit first.
function KeptPageFields({ children }: { children: React.ReactNode }) {
	const fieldsetRef = React.useRef<HTMLFieldSetElement>(null);
	// False while hydrating, true when the browser renders the fieldset first.
	const renderedInBrowser = useHydrated();
	// From the server, enabled, so its fields submit before the page hydrates. Created in the
	// browser, disabled, since a page created hidden runs no effect until it shows.
	const [startsDisabled] = React.useState(renderedInBrowser);
	React.useLayoutEffect(() => {
		const fieldset = fieldsetRef.current;
		if (fieldset === null) {
			return;
		}
		fieldset.disabled = false;
		return () => {
			fieldset.disabled = true;
		};
	}, []);

	return (
		<fieldset ref={fieldsetRef} hidden disabled={startsDisabled}>
			{children}
		</fieldset>
	);
}

export { KeptPageFields };
