'use client';

import * as React from 'react';

// A saved draft by its id, with its title as saved, if it has one.
export type HeldDraft = {
	id: string;
	title: string | undefined;
};

type HeldDraftContextValue = {
	draft: HeldDraft | undefined;
	hold: (draft: HeldDraft) => void;
};

const HeldDraftContext = React.createContext<HeldDraftContextValue | null>(null);

// Shares the saved draft the page's recipe form holds with the rest of the page, such as the menu
// beside its heading that deletes it: the draft the page opened, then the one the form last saved.
// Keyed with the form, so another draft starts it afresh.
function HeldDraftProvider({
	opened,
	children,
}: {
	opened: HeldDraft | undefined;
	children: React.ReactNode;
}) {
	const [draft, hold] = React.useState(opened);
	const value = React.useMemo(() => ({ draft, hold }), [draft]);
	return <HeldDraftContext.Provider value={value}>{children}</HeldDraftContext.Provider>;
}

// The saved draft the page's form holds, if any.
function useHeldDraft(): HeldDraft | undefined {
	return React.useContext(HeldDraftContext)?.draft;
}

// Tells the page which saved draft its form now holds; a page that shares none has nothing to tell.
function useHoldDraft(): ((draft: HeldDraft) => void) | undefined {
	return React.useContext(HeldDraftContext)?.hold;
}

export { HeldDraftProvider, useHeldDraft, useHoldDraft };
