'use client';

import { unstable_rethrow, useRouter } from 'next/navigation';
import * as React from 'react';
import { hasFieldErrors } from '@/components/forms/field-errors';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { useOnKeptPageHide } from '@/components/forms/use-on-kept-page-hide';
import { useTransientState } from '@/components/forms/use-transient-state';
import {
	createDraftSaveCoordinator,
	type DraftRefusal,
	type DraftRequests,
	type DraftSaveCoordinator,
	type DraftSaveState,
	type DraftSaveStatus,
	type DraftVersion,
} from '@/components/recipe-form/draft-save-coordinator';
import {
	useHoldDraft,
	useProvideHeldDraftControls,
	type HeldDraftControls,
} from '@/components/recipe-form/held-draft';
import {
	recipeFormFieldNames,
	type SavedDraftResult,
} from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormSnapshotTitle,
	savedDraftSnapshot,
	showSameRecipeForm,
	type RecipeFormSnapshot,
} from '@/components/recipe-form/recipe-form-snapshot';
import {
	recipeFormSubmission,
	recipeFormValues,
	type ProblemTargets,
	type RecipeFormEdit,
	type RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { recipeEntryPaths, savedDraftPath } from '@/components/recipe-import/recipe-entry-paths';

// Saving the form as the member's draft while they add a recipe, through the page's Server Actions,
// which stay the same for the form's life.
export type RecipeFormDrafts = {
	save: FormAction<SavedDraftResult>;
	// At the version the form holds, without rendering the page again.
	delete: FormAction;
	// Leads to the start page, naming the draft the form leaves kept there, if any.
	leave: (keptDraftId: string | undefined, history: 'push' | 'replace') => Promise<void>;
	// The draft the form opened, if any.
	opened?: DraftVersion;
	// The page the form is on, whose address names the draft the form holds, so a reload opens it: the
	// new recipe's, which renders the same whatever the form holds and so renders again for the
	// header's count of drafts, or a draft's own. Absent where the address stays, as in the design
	// reference.
	page?: 'new' | 'draft';
};

// What the form says of its draft: where saving stands, or that leaving for the start page failed.
export type RecipeFormDraftStatus = DraftSaveStatus | { kind: 'leaveFailed' };

// What a draft keeps of the form, with where a refused save's problems show.
type DraftContent = {
	snapshot: RecipeFormSnapshot;
	targets: ProblemTargets;
};

function draftContent(values: RecipeFormValues): DraftContent {
	return { snapshot: savedDraftSnapshot(values), targets: recipeFormSubmission(values).targets };
}

function sameDraftContent(a: DraftContent, b: DraftContent): boolean {
	return showSameRecipeForm(a.snapshot, b.snapshot);
}

// A refusal at a place in the form shows there and can be fixed; one about the whole draft, such as a
// save another page made since or an ended session, stops saving.
function refusal(result: Exclude<FormState, { status: 'success' }>): DraftRefusal {
	const fieldErrors = result.status === 'error' ? result.fieldErrors : {};
	const atPlaces = hasFieldErrors(fieldErrors);
	return {
		status: 'refused',
		message: result.status === 'error' ? result.message : undefined,
		stopsSaving: !atPlaces,
	};
}

// Names the draft at the version the form holds, as saving over it, deleting it, and adding the
// recipe from it do.
function versionFields(formData: FormData, { id, savedAt }: DraftVersion) {
	formData.set(recipeFormFieldNames.draftId, id);
	formData.set(recipeFormFieldNames.draftVersion, savedAt.toISOString());
}

// The page's Server Actions as the coordinator asks them. A refused save's problems show at their
// places in the form, through the targets of what it sent.
function draftRequests(
	drafts: RecipeFormDrafts,
	dispatch: React.Dispatch<RecipeFormEdit>
): DraftRequests<DraftContent> {
	return {
		async save({ snapshot, targets }, held) {
			const formData = new FormData();
			formData.set(recipeFormFieldNames.draft, JSON.stringify(snapshot));
			if (held !== undefined) {
				versionFields(formData, held);
			}
			const result = await drafts.save({ status: 'idle' }, formData);
			if (result.status === 'success') {
				return { status: 'saved', draft: { id: result.draftId, savedAt: result.savedAt } };
			}
			if (result.status === 'error' && hasFieldErrors(result.fieldErrors)) {
				dispatch({ type: 'attachErrors', fieldErrors: result.fieldErrors, targets });
			}
			return refusal(result);
		},
		async delete(held) {
			const formData = new FormData();
			versionFields(formData, held);
			const result = await drafts.delete({ status: 'idle' }, formData);
			return result.status === 'success' ? { status: 'deleted' } : refusal(result);
		},
	};
}

// Next has already navigated by the time a Server Action's redirect rejects its call.
function isNextNavigation(error: unknown): boolean {
	try {
		unstable_rethrow(error);
	} catch {
		return true;
	}
	return false;
}

function subscribeToNothing(): () => void {
	return () => {};
}

function noDraftState(): undefined {
	return undefined;
}

type DraftSavingOptions = {
	// Absent where the form keeps no draft, as when editing a published recipe.
	drafts: RecipeFormDrafts | undefined;
	initial: RecipeFormValues;
	values: RecipeFormValues;
	dispatch: React.Dispatch<RecipeFormEdit>;
};

// Saves the form as the member's draft while they add a recipe, through one save coordinator, and
// keeps the page in step with the draft it holds: the heading and its menu, the address, and on the
// new recipe's page the header's count. A change goes as the page hides or the tab does, so leaving
// by any way loses nothing that can be saved. Finish later, the back link, adding, and deleting wait
// for saving: leaving waits for what is waiting to be saved, and adding and deleting stop it first.
// The address never changes while a navigation is on its way, since Next drops a Server Action's
// navigation that a change of address overtakes.
export function useDraftSaving({ drafts, initial, values, dispatch }: DraftSavingOptions) {
	const router = useRouter();
	const holdDraft = useHoldDraft();
	const [actions] = React.useState(drafts);
	const [coordinator] = React.useState<DraftSaveCoordinator<DraftContent> | undefined>(() =>
		actions === undefined
			? undefined
			: createDraftSaveCoordinator({
					requests: draftRequests(actions, dispatch),
					opened: actions.opened,
					initial: draftContent(initial),
					empty: draftContent(recipeFormValues()),
					same: sameDraftContent,
				})
	);
	const state: DraftSaveState<DraftContent> | undefined = React.useSyncExternalStore(
		coordinator?.subscribe ?? subscribeToNothing,
		coordinator?.getSnapshot ?? noDraftState,
		coordinator?.getSnapshot ?? noDraftState
	);
	const [finishing, startFinishing] = React.useTransition();
	const [leaveFailed, setLeaveFailed] = useTransientState<boolean>();

	const content = React.useMemo(() => draftContent(values), [values]);
	React.useEffect(() => {
		coordinator?.change(content);
	}, [coordinator, content]);

	useOnKeptPageHide(() => coordinator?.flush());
	React.useEffect(() => {
		if (coordinator === undefined) {
			return;
		}
		const flushAsTabHides = () => {
			if (document.visibilityState === 'hidden') {
				coordinator.flush();
			}
		};
		document.addEventListener('visibilitychange', flushAsTabHides);
		return () => document.removeEventListener('visibilitychange', flushAsTabHides);
	}, [coordinator]);

	const held = state?.held;
	const heldTitle = state === undefined ? undefined : recipeFormSnapshotTitle(state.saved.snapshot);
	React.useEffect(() => {
		if (coordinator !== undefined) {
			holdDraft?.(held === undefined ? undefined : { ...held, title: heldTitle });
		}
	}, [coordinator, holdDraft, held, heldTitle]);

	// The address follows the held draft, except while a navigation is on its way. The new recipe's
	// page renders again for the header's count only at its own address, so a draft's first save
	// renders it before the address names the draft, and a deleted draft's address goes first.
	const heldId = held?.id;
	const page = actions?.page;
	const addressHeld = React.useRef(false);
	const [addressFreed, freeAddress] = React.useReducer((count: number) => count + 1, 0);
	const addressed = React.useRef(heldId);
	const counted = React.useRef(heldId);
	const [refreshing, startRefresh] = React.useTransition();
	const nameInAddress = React.useCallback((id: string | undefined) => {
		window.history.replaceState(
			null,
			'',
			id === undefined ? recipeEntryPaths.manual : savedDraftPath(id)
		);
		addressed.current = id;
	}, []);
	React.useEffect(() => {
		if (page === undefined || addressHeld.current || refreshing) {
			return;
		}
		if (page === 'new' && counted.current !== heldId) {
			if (heldId === undefined && addressed.current !== undefined) {
				nameInAddress(undefined);
			}
			if (addressed.current === undefined) {
				counted.current = heldId;
				startRefresh(() => router.refresh());
				return;
			}
		}
		if (addressed.current !== heldId) {
			nameInAddress(heldId);
		}
	}, [page, heldId, refreshing, addressFreed, router, nameInAddress]);

	const holdAddress = React.useCallback(() => {
		addressHeld.current = true;
	}, []);
	const releaseAddress = React.useCallback(() => {
		addressHeld.current = false;
		freeAddress();
	}, []);
	useOnKeptPageHide(releaseAddress);

	const leave = React.useCallback(
		async (keptDraftId: string | undefined, history: 'push' | 'replace') => {
			if (actions === undefined) {
				return;
			}
			try {
				await actions.leave(keptDraftId, history);
			} catch (error) {
				if (!isNextNavigation(error)) {
					releaseAddress();
					setLeaveFailed(true);
				}
			}
		},
		[actions, releaseAddress, setLeaveFailed]
	);

	// Stays where something the form shows couldn't be saved yet, which saving tries again.
	const finishLater = React.useCallback(() => {
		if (coordinator === undefined) {
			return;
		}
		holdAddress();
		setLeaveFailed(false);
		startFinishing(async () => {
			const settled = await coordinator.settle();
			if (!settled.current && !settled.halted) {
				releaseAddress();
				return;
			}
			// So Back returns to the draft: nothing is on its way to be overtaken until leave sends.
			if (page !== undefined && addressed.current !== settled.held?.id) {
				nameInAddress(settled.held?.id);
			}
			await leave(settled.held?.id, 'push');
		});
	}, [coordinator, page, holdAddress, releaseAddress, nameInAddress, leave, setLeaveFailed]);

	const controls = React.useMemo<HeldDraftControls | undefined>(
		() =>
			coordinator === undefined
				? undefined
				: {
						finishLater,
						deleting: (remove) => async (previous, formData) => {
							holdAddress();
							const draft = await coordinator.stop();
							if (draft === undefined) {
								void leave(undefined, 'replace');
								return { status: 'success' };
							}
							versionFields(formData, draft);
							let result: FormState;
							try {
								result = await remove(previous, formData);
							} catch (error) {
								coordinator.resume();
								releaseAddress();
								throw error;
							}
							if (result.status === 'success') {
								void leave(undefined, 'replace');
							} else {
								coordinator.resume();
								releaseAddress();
							}
							return result;
						},
					},
		[coordinator, finishLater, holdAddress, releaseAddress, leave]
	);
	useProvideHeldDraftControls(controls);

	// Holds saving while the recipe is added, and names the draft it holds, at the version it holds,
	// which adding deletes.
	const holdForAdding = React.useCallback(
		async (formData: FormData) => {
			if (coordinator === undefined) {
				return;
			}
			holdAddress();
			const draft = await coordinator.stop();
			if (draft !== undefined) {
				versionFields(formData, draft);
			}
		},
		[coordinator, holdAddress]
	);

	const resumeAfterAdding = React.useCallback(() => {
		coordinator?.resume();
		releaseAddress();
	}, [coordinator, releaseAddress]);

	const status: RecipeFormDraftStatus | undefined =
		leaveFailed === true ? { kind: 'leaveFailed' } : state?.status;

	return { status, finishLater, finishing, holdForAdding, resumeAfterAdding };
}
