'use client';

import * as React from 'react';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';

// A popup open as its page hides closes then, through its root's actionsRef, so its onOpenChange
// hears of it and a return through history finds it closed. A hidden page runs no animations, so
// the closing animation would play as the page shows again: the popup and its backdrop carry
// data-closed-by-page-hide, which globals.css takes out of rendering, and Base UI, finding no
// animation to wait for, unmounts the popup at once.

type KeptPagePopup = {
	closedByPageHide: boolean;
	// Called as the popup mounts, with the element focused as it opened, returning what to call as it
	// unmounts or its page hides.
	trackPopup: (openedFrom: Element | null) => () => void;
};

const KeptPagePopupContext = React.createContext<KeptPagePopup>({
	closedByPageHide: false,
	trackPopup: () => () => {},
});

type KeptPagePopupRootProps<Actions> = {
	actionsRef?: React.RefObject<Actions | null> | undefined;
	onOpenChangeComplete?: ((open: boolean) => void) | undefined;
};

// For a popup's root: the context its content reads, and the props it adds to Base UI's root. The
// mark lasts until the popup's next opening or closing completes, the closing being its unmount as
// the page shows again.
function useKeptPagePopup<Actions extends { close: () => void }>({
	actionsRef,
	onOpenChangeComplete,
}: KeptPagePopupRootProps<Actions>) {
	const ownActions = React.useRef<Actions>(null);
	const actions = actionsRef ?? ownActions;
	// The element focused as the mounted popup opened, or null while no popup is mounted.
	const mountedPopup = React.useRef<{ openedFrom: Element | null } | null>(null);
	const [closedByPageHide, setClosedByPageHide] = React.useState(false);

	// A component's cleanups run before its children's and before React hides the page, so
	// actionsRef is still attached and the page still shows.
	useOnKeptPageHide(() => {
		if (mountedPopup.current === null) {
			return;
		}
		setClosedByPageHide(true);
		actions.current?.close();
		// Base UI returns focus only once the page is hidden, where it can't, so focus would stay in
		// the popup, at the end of the document, and Tab after Back would start past everything.
		const { openedFrom } = mountedPopup.current;
		if (openedFrom instanceof HTMLElement && openedFrom.isConnected) {
			openedFrom.focus({ preventScroll: true });
		}
	});

	const trackPopup = React.useCallback((openedFrom: Element | null) => {
		mountedPopup.current = { openedFrom };
		return () => {
			mountedPopup.current = null;
		};
	}, []);
	const context = React.useMemo(
		() => ({ closedByPageHide, trackPopup }),
		[closedByPageHide, trackPopup]
	);
	const rootProps = {
		actionsRef: actions,
		onOpenChangeComplete: (open: boolean) => {
			setClosedByPageHide(false);
			onOpenChangeComplete?.(open);
		},
	};
	return { context, rootProps };
}

// Rendered in a popup's portal, which Base UI renders only while the popup is mounted. It renders
// first as the popup opens, before Base UI moves focus into it.
function KeptPagePopupMounted() {
	const { trackPopup } = React.useContext(KeptPagePopupContext);
	const [openedFrom] = React.useState(() =>
		typeof document === 'undefined' ? null : document.activeElement
	);
	React.useLayoutEffect(() => trackPopup(openedFrom), [trackPopup, openedFrom]);
	return null;
}

// For a popup nested in another, as a submenu is: it closes with its parent, so it takes the parent's
// mark and leaves the parent's tracking of what is mounted alone.
function useNestedKeptPagePopup(): KeptPagePopup {
	const { closedByPageHide } = React.useContext(KeptPagePopupContext);
	return React.useMemo(
		() => ({ closedByPageHide, trackPopup: () => () => {} }),
		[closedByPageHide]
	);
}

// For a popup and its backdrop.
function useKeptPagePopupProps(): { 'data-closed-by-page-hide'?: '' } {
	const { closedByPageHide } = React.useContext(KeptPagePopupContext);
	return closedByPageHide ? { 'data-closed-by-page-hide': '' } : {};
}

export {
	KeptPagePopupContext,
	KeptPagePopupMounted,
	useKeptPagePopup,
	useKeptPagePopupProps,
	useNestedKeptPagePopup,
};
