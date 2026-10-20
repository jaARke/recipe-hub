'use client';

import * as React from 'react';
import type { FormAction } from '@/components/forms/form-state';

// A saved draft by its id, with its title as saved, if it has one, and when it was last saved, which
// is the version of it the page has.
export type HeldDraft = {
	id: string;
	title: string | undefined;
	savedAt: Date;
};

// What the page's form does for the rest of the page, such as the heading's back link and its menu.
export type HeldDraftControls = {
	// Leaves for the start page once saving has done what it can, as Finish later does.
	finishLater: () => void;
	// The menu's delete, run once saving stops, naming the draft at the version the form holds:
	// saving goes on if it fails, and the page leaves for the start page once it succeeds.
	deleting: (remove: FormAction) => FormAction;
};

type HeldDraftContextValue = {
	draft: HeldDraft | undefined;
	hold: (draft: HeldDraft | undefined) => void;
	release: (id: string) => void;
	share: (controls: HeldDraftControls | undefined) => void;
	controls: () => HeldDraftControls | undefined;
};

const HeldDraftContext = React.createContext<HeldDraftContextValue | null>(null);

// Shares the saved draft the page's recipe form holds with the rest of the page, such as the heading
// that names it and the menu beside it that deletes it: the draft the page opened, then the one the
// form last saved, until it is deleted. The form's controls go through it too, for the back link and
// the menu. Keyed by the draft's id, so another draft starts it afresh.
// The page renders again with the draft as the server now holds it, as a refresh does. A version newer
// than any the page opened or its form saved was saved elsewhere, so the form starts again from it;
// one the form made changes nothing, so what is being typed stays. Each save moves a draft's version
// forward, so newer is a plain comparison.
function HeldDraftProvider({
	opened,
	children,
}: {
	opened: HeldDraft | undefined;
	children: React.ReactNode;
}) {
	const [draft, setDraft] = React.useState(opened);
	// The newest version the page has shown or its form saved.
	const [newest, setNewest] = React.useState(opened?.savedAt.getTime());
	// Counts the form's starts, so a version saved elsewhere starts the page's form again.
	const [run, setRun] = React.useState(0);
	const [rendered, setRendered] = React.useState(opened);
	if (opened !== rendered) {
		setRendered(opened);
		const version = opened?.savedAt.getTime();
		if (version !== undefined && (newest === undefined || version > newest)) {
			setNewest(version);
			setDraft(opened);
			setRun((count) => count + 1);
		}
	}
	const hold = React.useCallback((held: HeldDraft | undefined) => {
		setDraft(held);
		if (held !== undefined) {
			setNewest((version) => Math.max(version ?? 0, held.savedAt.getTime()));
		}
	}, []);
	// Read as events happen, so sharing them renders nothing again.
	const shared = React.useRef<HeldDraftControls>(undefined);
	const share = React.useCallback((controls: HeldDraftControls | undefined) => {
		shared.current = controls;
	}, []);
	const controls = React.useCallback(() => shared.current, []);
	const value = React.useMemo(
		() => ({
			draft,
			hold,
			release: (id: string) => setDraft((held) => (held?.id === id ? undefined : held)),
			share,
			controls,
		}),
		[draft, hold, share, controls]
	);
	return (
		<HeldDraftContext.Provider value={value}>
			<React.Fragment key={run}>{children}</React.Fragment>
		</HeldDraftContext.Provider>
	);
}

// The saved draft the page's form holds, if any.
function useHeldDraft(): HeldDraft | undefined {
	return React.useContext(HeldDraftContext)?.draft;
}

// Tells the page which saved draft its form now holds, if any; a page that shares none has nothing to
// tell.
function useHoldDraft(): ((draft: HeldDraft | undefined) => void) | undefined {
	return React.useContext(HeldDraftContext)?.hold;
}

// Tells the page a saved draft was deleted, so it lets go of it if its form holds it.
function useReleaseDraft(): ((id: string) => void) | undefined {
	return React.useContext(HeldDraftContext)?.release;
}

// Gives the page the form's controls while the form shows.
function useProvideHeldDraftControls(controls: HeldDraftControls | undefined) {
	const share = React.useContext(HeldDraftContext)?.share;
	React.useEffect(() => {
		if (share === undefined || controls === undefined) {
			return;
		}
		share(controls);
		return () => share(undefined);
	}, [share, controls]);
}

function noControls(): undefined {
	return undefined;
}

// The form's controls as an event finds them, or undefined before the form hydrates or on a page
// without one.
function useHeldDraftControls(): () => HeldDraftControls | undefined {
	return React.useContext(HeldDraftContext)?.controls ?? noControls;
}

export {
	HeldDraftProvider,
	useHeldDraft,
	useHeldDraftControls,
	useHoldDraft,
	useProvideHeldDraftControls,
	useReleaseDraft,
};
