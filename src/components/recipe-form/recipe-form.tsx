'use client';

import { cn } from 'cn';
import { HistoryIcon, InfoIcon, ScanTextIcon } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { FieldNote, type FieldNoteContent } from '@/components/forms/field-note';
import { focusCentered } from '@/components/forms/focus-centered';
import { focusFellToPage } from '@/components/forms/focus-fell-to-page';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction, FormState } from '@/components/forms/form-state';
import { FormStatusMessage, type FormStatusKind } from '@/components/forms/form-status-message';
import { LiveAnnouncer, useLiveAnnouncement } from '@/components/forms/live-announcement';
import { optionalLabel } from '@/components/forms/optional-label';
import {
	ProblemSummary,
	SummarizedProblems,
	type SummarizedProblem,
} from '@/components/forms/problem-summary';
import { TextField, textFieldIds } from '@/components/forms/text-field';
import { TextareaField } from '@/components/forms/textarea-field';
import { useFieldUndo } from '@/components/forms/use-field-undo';
import { useFormAction } from '@/components/forms/use-form-action';
import { useHydrated } from '@/components/forms/use-hydrated';
import { wideContentProps } from '@/components/layout/page-container';
import { ActionBar } from '@/components/recipe-form/action-bar';
import {
	classificationFieldIds,
	classificationFieldLabels,
	ClassificationFields,
} from '@/components/recipe-form/classification-fields';
import { FieldRow, RowTextField } from '@/components/recipe-form/field-row';
import {
	OriginalRecipePane,
	OriginalRecipePaneSkeleton,
} from '@/components/recipe-form/original-recipe-pane';
import {
	PhotoField,
	photoFieldIds,
	photoName,
	photoViewerImages,
} from '@/components/recipe-form/photo-field';
import { uploadPhoto, type PhotoUploader } from '@/components/recipe-form/photo-upload';
import {
	recipeFormSubject,
	type ExistingRecipeFormSubjects,
} from '@/components/recipe-form/recipe-form-autosave';
import {
	recipeFormFieldNames,
	type EditedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
import {
	recipeFormSnapshot,
	showSameRecipeForm,
} from '@/components/recipe-form/recipe-form-snapshot';
import {
	editRecipeForm,
	hasPhotosInProgress,
	problemKey,
	recipeFormChecks,
	recipeFormProblems,
	recipeFormRequiredErrors,
	recipeFormSubmission,
	type ProblemTarget,
	type RecipeFormCheck,
	type RecipeFormChoiceField,
	type RecipeFormErrorField,
	type RecipeFormListName,
	type RecipeFormLocation,
	type RecipeFormProblem,
	type RecipeFormValues,
	type RecipeYieldKind,
} from '@/components/recipe-form/recipe-form-values';
import {
	checkedAnnouncement,
	ReviewNotesIntro,
	ReviewNotesNext,
	UncheckedSaveDialog,
} from '@/components/recipe-form/review-notes';
import {
	listRowNames,
	sectionLabel,
	type ListNaming,
} from '@/components/recipe-form/sectioned-list';
import {
	SectionedListField,
	sectionedListFieldIds,
} from '@/components/recipe-form/sectioned-list-field';
import {
	useDraftSaving,
	type RecipeFormDrafts,
	type RecipeFormDraftStatus,
} from '@/components/recipe-form/use-draft-saving';
import { useRecipeFormAutosave } from '@/components/recipe-form/use-recipe-form-autosave';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import {
	RecipeImageViewer,
	RecipeImageViewerButton,
} from '@/components/recipe/recipe-image-viewer';
import { HighlightedSegments } from '@/components/search/highlighted-segments';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import {
	transcriptionMarkerFixes,
	transcriptionMarkerRuns,
	transcriptionMarkersIn,
} from '@/domain/recipe/transcription-markers';
import { formatDayAndTime } from '@/lib/dates';
import { settings } from '@/lib/settings';

const failureMessage = 'We couldn’t save the recipe. Check your connection and try again.';

// What the action bar says of the draft, by where saving stands. A refusal says its own message where
// it has one.
const draftStatusMessages = {
	empty: 'Saves as a draft once you fill something in',
	saving: 'Saving draft',
	saved: 'Draft saved',
	deleted: 'Form is empty, so the draft was deleted',
	unreachable: 'We couldn’t save the draft. Check your connection; your next change tries again.',
	refused: 'The draft wasn’t saved.',
	leaveFailed: 'We couldn’t reach the site. Check your connection and try again.',
} as const satisfies Record<RecipeFormDraftStatus['kind'], string>;

// How the action bar marks each: a spinner while saving, a check once saved.
const draftStatusKinds = {
	empty: 'progress',
	saving: 'pending',
	saved: 'confirmation',
	deleted: 'progress',
	unreachable: 'progress',
	refused: 'progress',
	leaveFailed: 'progress',
} as const satisfies Record<RecipeFormDraftStatus['kind'], FormStatusKind>;

// Why changes kept in this browser were for an earlier version of the recipe.
const outdatedDescription = 'This recipe changed after you made them, so they weren’t restored.';

// What saving says, by whether the form adds a recipe to the cookbook or saves changes to one: its
// button, as it works, what fixing a failed save's problems is for, and the warning before saving
// with anything left to check.
const savingWords = {
	add: {
		submitLabel: 'Add to cookbook',
		pendingLabel: 'Adding to cookbook',
		purpose: 'before adding it to the cookbook',
		saveAnywayLabel: 'Add anyway',
		notesKeptUntil: 'it’s added to the cookbook',
	},
	edit: {
		submitLabel: 'Save changes',
		pendingLabel: 'Saving changes',
		purpose: 'to save',
		saveAnywayLabel: 'Save anyway',
		notesKeptUntil: 'the recipe is saved',
	},
} as const satisfies Record<
	'add' | 'edit',
	Record<'submitLabel' | 'pendingLabel' | 'purpose' | 'saveAnywayLabel' | 'notesKeptUntil', string>
>;

const yieldKindItems = [
	{ value: 'servings', label: 'Serves' },
	{ value: 'makes', label: 'Makes' },
] as const satisfies readonly { value: RecipeYieldKind; label: string }[];

// The fields whose text the form holds as typed, each with its own problems.
type TextFieldName = Exclude<RecipeFormErrorField, RecipeFormChoiceField>;

type TimeFieldName = Extract<TextFieldName, `${string}Minutes`>;

// The times as they show, over inputs that end in "min". Their full names, which assistive technology
// hears, add minutesLabel.
const timeFieldLabels = {
	prepMinutes: 'Prep',
	cookMinutes: 'Cook',
	totalMinutes: 'Total',
} as const satisfies Record<TimeFieldName, string>;
const minutesLabel = ', in minutes';

// What each field is called, which the problem summary repeats. The yield's amount is named for its
// kind.
const textFieldLabels = {
	title: 'Title',
	description: 'Description',
	source: 'Source',
	prepMinutes: `${timeFieldLabels.prepMinutes}${minutesLabel}`,
	cookMinutes: `${timeFieldLabels.cookMinutes}${minutesLabel}`,
	totalMinutes: `${timeFieldLabels.totalMinutes}${minutesLabel}`,
	yieldUnit: 'Unit',
	notes: 'Notes',
} as const satisfies Record<Exclude<TextFieldName, 'yieldAmount'>, string>;

const yieldAmountLabels = {
	servings: 'Servings',
	makes: 'Amount',
} as const satisfies Record<RecipeYieldKind, string>;

// Every field textFieldProps gives a control.
const textFieldNames: readonly TextFieldName[] = [
	...(Object.keys(textFieldLabels) as (keyof typeof textFieldLabels)[]),
	'yieldAmount',
];

// Each list's legend and what its rows are called, which its field and the problem summary share.
const listFieldLabels = {
	ingredientSections: { legend: 'Ingredients', noun: 'ingredient', numbered: false },
	instructionSections: { legend: 'Steps', noun: 'step', numbered: true },
} as const satisfies Record<RecipeFormListName, { legend: string } & ListNaming>;

const photoFieldLegends = {
	dish: 'Photos',
	scan: 'Original recipe',
} as const satisfies Record<RecipeImageRole, string>;

type RecipeFormProps = {
	// Built with recipeFormValues, from nothing, a recipe to edit, or what an import read, or from a
	// saved draft with restoredRecipeForm.
	initial: RecipeFormValues;
	// Redirects to the recipe once it is saved, which also starts the form over.
	action: FormAction;
	// Where this environment keeps new photos of each role.
	uploadFolders: Record<RecipeImageRole, string>;
	uploader?: PhotoUploader;
} & (
	| {
			// The published recipe the form edits.
			editing: EditedRecipe;
			// Keeps unsaved changes in this browser for the member signed in, and brings them back as the
			// form loads again. What the page knows still exists of what the member's forms edit prunes
			// the rest.
			autosave?: { memberId: string; existing?: ExistingRecipeFormSubjects };
			drafts?: never;
	  }
	| {
			editing?: never;
			autosave?: never;
			// Saves the recipe being added as the member's draft, where the page keeps one.
			drafts?: RecipeFormDrafts;
	  }
);

// Text with each transcription marker in it marked, so the member finds it.
function markedText(text: string): React.ReactNode {
	return (
		<HighlightedSegments
			text={transcriptionMarkerRuns(text).map(({ text: run, marker }) => ({
				text: run,
				highlighted: marker !== undefined,
			}))}
		/>
	);
}

// How the line reads on the recipe page, where that differs from the text as typed or still holds a
// transcription marker.
function ingredientPreview(text: string): React.ReactNode {
	const line = parseIngredientLine(text);
	if (
		line.amount === undefined &&
		line.text === text.trim() &&
		transcriptionMarkersIn(text).length === 0
	) {
		return undefined;
	}
	return (
		<>
			Shows as <IngredientLineText line={line} renderText={markedText} />
		</>
	);
}

// The open note's message, then what to do about each marker left in the text.
function checkMessage({ note, markers }: RecipeFormCheck): string {
	return [
		...(note === undefined ? [] : [note]),
		...markers.map((marker) => transcriptionMarkerFixes[marker]),
	].join(' ');
}

// The recipe form for adding, editing, and reviewing an import. Its whole value is sent as JSON in
// one field; the action maps it with recipeContentFromForm. Saving waits for hydration, since a
// submit before then would send what the server rendered rather than what was typed. What deletes
// what it edits, the recipe or a draft it holds, is in the page's menu beside its heading.
function RecipeForm({
	initial,
	action,
	uploadFolders,
	uploader = uploadPhoto,
	editing,
	autosave,
	drafts,
}: RecipeFormProps) {
	const baseId = React.useId();
	const [values, dispatch] = React.useReducer(editRecipeForm, initial);
	const hydrated = useHydrated();
	// The form as it loaded, which Discard returns to.
	const [baseline] = React.useState(initial);
	const unchanged = React.useMemo(
		() => showSameRecipeForm(recipeFormSnapshot(values), recipeFormSnapshot(baseline)),
		[values, baseline]
	);
	// Announced as "Looks right" clears a note and as unsaved changes come back or go, and never as a
	// draft loads.
	const [announcement, announce] = useLiveAnnouncement();
	const autosaved = useRecipeFormAutosave({
		memberId: autosave?.memberId,
		subject: editing === undefined ? undefined : recipeFormSubject(editing),
		existing: autosave?.existing,
		baseline,
		values,
		unchanged,
		dispatch,
		onRestore: (restoredAt) => announce(`${restoredTitle(restoredAt)}.`),
		onOutdated: (outdatedAt) => announce(`${outdatedTitle(outdatedAt)}. ${outdatedDescription}`),
	});
	const drafting = useDraftSaving({ drafts, initial, values, dispatch });
	const submission = recipeFormSubmission(values);
	const isEditing = editing !== undefined;
	const saving = savingWords[isEditing ? 'edit' : 'add'];
	const photosInProgress = hasPhotosInProgress(values);
	const ids = {
		reviewIntro: `${baseId}-review-intro`,
		formNote: `${baseId}-form-note`,
		save: `${baseId}-save`,
		saveNote: `${baseId}-save-note`,
		checksLeft: `${baseId}-checks-left`,
		yieldKind: `${baseId}-yieldKind`,
		field: (field: TextFieldName) => `${baseId}-${field}`,
		list: (list: RecipeFormListName) => `${baseId}-${list}`,
		classification: `${baseId}-classification`,
		photos: (role: RecipeImageRole) => `${baseId}-photos-${role}`,
	};
	const textUndo = useFieldUndo(
		textFieldNames.map((field) => ({
			id: ids.field(field),
			value: values.text[field],
			setValue: (text) => dispatch({ type: 'setText', field, text }),
		}))
	);

	// A save's problems name places in what it sent, so they land through that submission's targets.
	// Adding a recipe names the draft it is added from, which it deletes unless another page saved it
	// since, once saving the draft has stopped, and saving goes on if adding fails. A save that
	// succeeds leads to the recipe through Next's redirect, the one error unstable_rethrow passes on
	// here. Next keeps the page it leaves, so its unsaved changes are let go first.
	const saveRecipe: FormAction = async (previous, formData) => {
		const { targets } = submission;
		await drafting.holdForAdding(formData);
		let result: FormState;
		try {
			result = await action(previous, formData);
		} catch (error) {
			try {
				unstable_rethrow(error);
			} catch {
				autosaved.leave();
				throw error;
			}
			drafting.resumeAfterAdding();
			throw error;
		}
		if (result.status === 'error') {
			dispatch({ type: 'attachErrors', fieldErrors: result.fieldErrors, targets });
			drafting.resumeAfterAdding();
		}
		return result;
	};
	// What the browser knows a save would be refused for shows as a save's errors do, so the warning
	// about what is left to check comes only once the save can succeed.
	const [state, formProps, pending] = useFormAction(saveRecipe, failureMessage, {
		check: () => recipeFormRequiredErrors(values),
		showProblems: (fieldErrors) =>
			dispatch({ type: 'attachErrors', fieldErrors, targets: submission.targets }),
		onSubmit: warnBeforeSaving,
	});

	// The summary lists a save's errors, each linking to where it shows, and takes focus.
	const problems = recipeFormProblems(values).map(summarizedProblem);
	// What is left to check against the original, each with its note in place, until it's edited or
	// looks right; saving with any left asks first.
	const checks = recipeFormChecks(values);
	const checksByKey = new Map(checks.map((check) => [problemKey(check.target), check]));
	const [warningOpen, setWarningOpen] = React.useState(false);
	// Set by the warning's "Add anyway" or "Save anyway", so the save it starts skips the warning.
	const savingAnyway = React.useRef(false);
	// The last place focused among the fields, not the original or the action bar, which Next goes on
	// from.
	const lastFocused = React.useRef<Element>(null);

	// A form that opens with notes to check, as an import's draft does, starts on their intro, which
	// shows only while notes are left: once, not again when a hidden page shows, and not where the
	// reader went to a field before the page hydrated.
	const focusedReview = React.useRef(false);
	React.useEffect(() => {
		if (focusedReview.current) {
			return;
		}
		focusedReview.current = true;
		if (focusFellToPage()) {
			document.getElementById(ids.reviewIntro)?.focus();
		}
	}, [ids.reviewIntro]);

	function fieldLabel(field: TextFieldName): string {
		return field === 'yieldAmount' ? yieldAmountLabels[values.yieldKind] : textFieldLabels[field];
	}

	// A group of choices links to its error, as a list does, since no one choice stands for it.
	function fieldParts(
		field: RecipeFormErrorField
	): Pick<SummarizedProblem, 'label' | 'targetId'> & { noteId: string } {
		switch (field) {
			case 'chapter':
			case 'holidays':
			case 'diets': {
				const choiceIds = classificationFieldIds(ids.classification, field);
				return {
					label: classificationFieldLabels[field],
					targetId: choiceIds.error,
					noteId: choiceIds.note,
				};
			}
			default:
				return {
					label: fieldLabel(field),
					targetId: ids.field(field),
					noteId: textFieldIds(ids.field(field)).note,
				};
		}
	}

	// What the summary names a place by, the field or error its link focuses, and its note's id.
	function locationParts(
		target: RecipeFormLocation
	): Pick<SummarizedProblem, 'label' | 'targetId'> & { noteId: string } {
		switch (target.kind) {
			case 'form':
				return { noteId: ids.formNote };
			case 'field':
				return fieldParts(target.field);
			case 'list':
				return {
					label: listFieldLabels[target.list].legend,
					targetId: sectionedListFieldIds(ids.list(target.list)).error,
					noteId: sectionedListFieldIds(ids.list(target.list)).note,
				};
			case 'row':
			case 'section': {
				const { legend, ...naming } = listFieldLabels[target.list];
				const listIds = sectionedListFieldIds(ids.list(target.list));
				const names = listRowNames(values[target.list].rows, naming)[target.index];
				// A section shows at its heading's row, which its link focuses.
				return target.kind === 'row'
					? {
							label: names?.label,
							targetId: listIds.row(target.id),
							noteId: listIds.rowNote(target.id),
						}
					: {
							label:
								names?.headingName === undefined ? legend : sectionLabel(legend, names.headingName),
							targetId: listIds.row(target.id),
							noteId: listIds.sectionNote(target.id),
						};
			}
			case 'photo': {
				const photo = values.photos[target.role][target.index];
				return {
					label:
						photo === undefined
							? photoFieldLegends[target.role]
							: `${photoFieldLegends[target.role]}, ${photoName(values.photos[target.role], target.index, target.role)}`,
					targetId: photoFieldIds(ids.photos(target.role)).photoError(target.id),
					noteId: photoFieldIds(ids.photos(target.role)).photoNote(target.id),
				};
			}
		}
	}

	function summarizedProblem({ message, target }: RecipeFormProblem): SummarizedProblem {
		const { label, targetId } = locationParts(target);
		return { message, label, targetId };
	}

	function focusCheck(check: RecipeFormCheck) {
		focusCentered(locationParts(check.target).noteId);
	}

	// Moves focus to the note at this place in what is left to check, to the first once past the last,
	// or to Save once nothing is left.
	function focusCheckAt(left: readonly RecipeFormCheck[], index: number) {
		const next = left[index] ?? left[0];
		if (next === undefined) {
			document.getElementById(ids.save)?.focus();
		} else {
			focusCheck(next);
		}
	}

	// Clears the note, then moves on to the next thing to check.
	function confirmCheck(check: RecipeFormCheck) {
		const index = checks.indexOf(check);
		const left = checks.filter((other) => other !== check);
		flushSync(() => {
			dispatch({ type: 'resolveReviewNote', target: check.target });
			announce(checkedAnnouncement(left.length));
		});
		focusCheckAt(left, index);
	}

	// Moves on to the first note after the last place focused, as "Looks right" does from its note.
	function goToNextCheck() {
		const from = lastFocused.current;
		const index =
			from === null || !from.isConnected
				? 0
				: checks.findIndex((check) => {
						const note = document.getElementById(locationParts(check.target).noteId);
						return (
							note !== null &&
							(from.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
						);
					});
		focusCheckAt(checks, index === -1 ? checks.length : index);
	}

	function rememberFocus(event: React.FocusEvent<HTMLDivElement>) {
		const { target } = event;
		// Focus bubbles in from popups' portals too, such as a row's menu, which are no place in the form.
		if (event.currentTarget.contains(target)) {
			lastFocused.current = target;
		}
	}

	// The note on a place, while it has something to check.
	function noteFor(target: ProblemTarget | { kind: 'form' }): FieldNoteContent | undefined {
		const check = checksByKey.get(problemKey(target));
		if (check === undefined) {
			return undefined;
		}
		return {
			message: checkMessage(check),
			onConfirm: check.confirmable ? () => confirmCheck(check) : undefined,
		};
	}

	function textFieldProps(field: TextFieldName) {
		const id = ids.field(field);
		return {
			id,
			value: values.text[field],
			error: values.fieldErrors[field],
			note: noteFor({ kind: 'field', field }),
			onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
				textUndo.setTypedValue(id, event.target.value, event.nativeEvent),
			onKeyDown: textUndo.handleKeyDown,
		};
	}

	// A text field in a row, under the label the row shows, with the description below the row.
	function rowFieldProps(field: TextFieldName, label: string, description?: string) {
		const { value, onChange, onKeyDown, ...shown } = textFieldProps(field);
		return { field: { ...shown, label, description }, value, onChange, onKeyDown };
	}

	// Saving with anything left to check asks first, unless the member chose to save anyway.
	function warnBeforeSaving(event: React.SubmitEvent<HTMLFormElement>) {
		if (savingAnyway.current) {
			savingAnyway.current = false;
			return;
		}
		if (checks.length > 0) {
			event.preventDefault();
			setWarningOpen(true);
		}
	}

	// Submits through the Save button, as a click on it does.
	function saveAnyway() {
		savingAnyway.current = true;
		formProps.ref.current?.requestSubmit(document.getElementById(ids.save));
	}

	// The notice goes with its button, so focus moves to the form's first field.
	function discardChanges() {
		autosaved.discard();
		announce('Discarded your unsaved changes.');
		document.getElementById(ids.field('title'))?.focus();
	}

	const [firstCheck] = checks;
	const formNote = noteFor({ kind: 'form' });
	// The scans to read beside the form from lg, which widen the page, or in the viewer below lg.
	const originalImages = photoViewerImages(values.photos.scan, 'scan');
	const hasOriginal = originalImages.length > 0;
	const times = [
		rowFieldProps('prepMinutes', timeFieldLabels.prepMinutes),
		rowFieldProps('cookMinutes', timeFieldLabels.cookMinutes),
		rowFieldProps(
			'totalMinutes',
			timeFieldLabels.totalMinutes,
			'Fill in Total only if it’s longer than prep and cook together, such as time to chill.'
		),
	];
	const yieldAmount = rowFieldProps(
		'yieldAmount',
		fieldLabel('yieldAmount'),
		`${fieldLabel('yieldAmount')} can be a number or a range, such as 4 or 4 to 6.`
	);
	const yieldUnit =
		values.yieldKind === 'makes'
			? rowFieldProps(
					'yieldUnit',
					textFieldLabels.yieldUnit,
					`${textFieldLabels.yieldUnit} is what it makes, such as biscuits or loaves.`
				)
			: undefined;

	const fields = (
		<div onFocus={rememberFocus} className="flex flex-col gap-4">
			{autosaved.restoredAt !== undefined && (
				<RestoredChangesNotice restoredAt={autosaved.restoredAt} onDiscard={discardChanges} />
			)}
			{autosaved.outdatedAt !== undefined && (
				<OutdatedChangesNotice outdatedAt={autosaved.outdatedAt} />
			)}
			{/* About the whole form, such as an edit conflict; the summary lists a save's problems. */}
			<FormErrorAlert message={state.status === 'error' ? state.message : undefined} />
			<ProblemSummary problems={problems} purpose={saving.purpose} />
			{firstCheck !== undefined && (
				<div className="flex flex-col gap-3">
					<ReviewNotesIntro
						id={ids.reviewIntro}
						count={checks.length}
						onStart={() => focusCheck(firstCheck)}
					/>
					{formNote !== undefined && <FieldNote id={ids.formNote} {...formNote} />}
				</div>
			)}
			{hasOriginal && (
				<RecipeImageViewer role="scan" title={photoFieldLegends.scan} images={originalImages}>
					<RecipeImageViewerButton className="self-start lg:hidden">
						<ScanTextIcon data-icon="inline-start" aria-hidden="true" />
						View original
					</RecipeImageViewerButton>
				</RecipeImageViewer>
			)}
			<LiveAnnouncer announcement={announcement} />
			<input
				type="hidden"
				name={recipeFormFieldNames.recipe}
				value={JSON.stringify(submission.payload)}
			/>
			{editing !== undefined && (
				<>
					<input type="hidden" name={recipeFormFieldNames.recipeId} value={editing.id} />
					<input type="hidden" name={recipeFormFieldNames.recipeVersion} value={editing.version} />
				</>
			)}
			<SummarizedProblems>
				<FieldGroup>
					<TextField
						{...textFieldProps('title')}
						label={textFieldLabels.title}
						required
						autoComplete="off"
						description={
							isEditing
								? 'Changing the title changes the recipe’s link. Old links keep working.'
								: undefined
						}
					/>
					<TextField
						{...textFieldProps('source')}
						label={textFieldLabels.source}
						optional
						autoComplete="off"
						description="Who or where the recipe comes from, such as a relative or a cookbook."
					/>
					<SectionedListField
						idPrefix={ids.list('ingredientSections')}
						name="ingredientSections"
						list={values.ingredientSections}
						nextId={values.nextId}
						dispatch={dispatch}
						{...listFieldLabels.ingredientSections}
						description="One ingredient per field, as you’d write it, or paste a whole list. Add a heading for a separate part, such as a glaze."
						itemPlaceholder="2½ cups all-purpose flour"
						headingPlaceholder="For the glaze"
						itemPreview={ingredientPreview}
						noteFor={noteFor}
					/>
					<SectionedListField
						idPrefix={ids.list('instructionSections')}
						name="instructionSections"
						list={values.instructionSections}
						nextId={values.nextId}
						dispatch={dispatch}
						{...listFieldLabels.instructionSections}
						description="One step per field, or paste them all at once. Add a heading for a separate part, such as a glaze."
						itemPlaceholder="Heat the oven to 450°F."
						headingPlaceholder="For the glaze"
						noteFor={noteFor}
					/>
					<TextareaField
						{...textFieldProps('notes')}
						label={textFieldLabels.notes}
						optional
						description="The story behind the recipe, or tips for making it."
					/>
					<TextareaField
						{...textFieldProps('description')}
						label={textFieldLabels.description}
						optional
						description="Shown in search results and when the recipe is shared."
					/>
					<FieldSet>
						<FieldLegend>{optionalLabel('Times and yield')}</FieldLegend>
						<FieldRow fields={times.map(({ field }) => field)}>
							{times.map((time) => (
								<RowTextField
									key={time.field.id}
									{...time}
									hiddenLabel={minutesLabel}
									unit="min"
									inputMode="numeric"
								/>
							))}
						</FieldRow>
						<FieldRow
							fields={
								yieldUnit === undefined ? [yieldAmount.field] : [yieldAmount.field, yieldUnit.field]
							}
						>
							<Field>
								<FieldLabel htmlFor={ids.yieldKind}>Yield</FieldLabel>
								<Select
									items={yieldKindItems}
									value={values.yieldKind}
									onValueChange={(kind) => {
										if (kind !== null) {
											dispatch({ type: 'setYieldKind', kind });
										}
									}}
								>
									<SelectTrigger id={ids.yieldKind} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{yieldKindItems.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<RowTextField {...yieldAmount} autoComplete="off" />
							{yieldUnit !== undefined && <RowTextField {...yieldUnit} autoComplete="off" />}
						</FieldRow>
					</FieldSet>
					<ClassificationFields
						idPrefix={ids.classification}
						chapter={values.chapter}
						holidays={values.holidays}
						diets={values.diets}
						errors={values.fieldErrors}
						noteFor={noteFor}
						dispatch={dispatch}
					/>
					<PhotoField
						idPrefix={ids.photos('dish')}
						role="dish"
						legend={photoFieldLegends.dish}
						optional
						description="Photos of the finished dish, which anyone can see. The first is the cover. Describe each one for people who can’t see it."
						limit={settings.photos.maxDishPhotosPerRecipe}
						photos={values.photos.dish}
						nextId={values.nextId}
						dispatch={dispatch}
						uploadFolder={uploadFolders.dish}
						uploader={uploader}
						noteFor={noteFor}
					/>
					<PhotoField
						idPrefix={ids.photos('scan')}
						role="scan"
						legend={photoFieldLegends.scan}
						optional
						description="Photos of the recipe as it was written, such as a recipe card, which anyone can see."
						limit={settings.photos.maxScansPerRecipe}
						photos={values.photos.scan}
						nextId={values.nextId}
						dispatch={dispatch}
						uploadFolder={uploadFolders.scan}
						uploader={uploader}
						noteFor={noteFor}
					/>
				</FieldGroup>
			</SummarizedProblems>
		</div>
	);

	// The action bar follows the fields and the original, so it spans the page, and stays in the form,
	// which Save submits.
	return (
		<form {...formProps}>
			<BesideOriginal
				original={
					hasOriginal && (
						<OriginalRecipePane
							images={originalImages}
							title={photoFieldLegends.scan}
							className="max-lg:hidden"
						/>
					)
				}
			>
				{fields}
			</BesideOriginal>
			<ActionBar
				status={
					<>
						{drafting.status !== undefined && (
							<FormStatusMessage
								kind={draftStatusKinds[drafting.status.kind]}
								message={draftStatusMessage(drafting.status)}
							/>
						)}
						{photosInProgress && (
							<p id={ids.saveNote} className="text-sm text-muted-foreground">
								Wait for the photos to finish uploading.
							</p>
						)}
						{firstCheck !== undefined && (
							<ReviewNotesNext id={ids.checksLeft} count={checks.length} onNext={goToNextCheck} />
						)}
					</>
				}
			>
				<Button
					id={ids.save}
					type="submit"
					// Natively disabled until hydrated, since a click before then would still submit, and while
					// the page leaves for the start page.
					disabled={!hydrated || photosInProgress || pending || drafting.finishing}
					focusableWhenDisabled={hydrated}
					aria-describedby={photosInProgress ? ids.saveNote : undefined}
				>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? saving.pendingLabel : saving.submitLabel}
				</Button>
				{drafts !== undefined && (
					// The draft keeps only stored photos, so leaving waits for the rest, as adding does.
					<Button
						type="button"
						variant="outline"
						disabled={!hydrated || photosInProgress || pending || drafting.finishing}
						focusableWhenDisabled={hydrated}
						aria-describedby={photosInProgress ? ids.saveNote : undefined}
						onClick={drafting.finishLater}
					>
						{drafting.finishing && <Spinner data-icon="inline-start" />}
						Finish later
					</Button>
				)}
			</ActionBar>
			<UncheckedSaveDialog
				open={warningOpen}
				onOpenChange={setWarningOpen}
				count={checks.length}
				onShow={() => {
					if (firstCheck !== undefined) {
						focusCheck(firstCheck);
					}
				}}
				saveAnywayLabel={saving.saveAnywayLabel}
				notesKeptUntil={saving.notesKeptUntil}
				onSaveAnyway={saveAnyway}
			/>
		</form>
	);
}

// Such as "Restored changes made in this browser on October 14 at 3:12 PM".
function restoredTitle(restoredAt: Date): string {
	return `Restored changes made in this browser on ${formatDayAndTime(restoredAt)}`;
}

// Such as "Changes made in this browser on October 14 at 3:12 PM were for an earlier version".
function outdatedTitle(outdatedAt: Date): string {
	return `Changes made in this browser on ${formatDayAndTime(outdatedAt)} were for an earlier version`;
}

// What the action bar says of the draft.
function draftStatusMessage(status: RecipeFormDraftStatus): string {
	return (
		(status.kind === 'refused' ? status.message : undefined) ?? draftStatusMessages[status.kind]
	);
}

// Heads the form while it holds unsaved changes kept in this browser from an earlier visit: when they
// were made, and that discarding them returns to the recipe as saved. Restoring them is announced, so
// nothing reads this out as it appears.
function RestoredChangesNotice({
	restoredAt,
	onDiscard,
}: {
	restoredAt: Date;
	onDiscard: () => void;
}) {
	return (
		<Alert role={undefined} aria-live={undefined}>
			<HistoryIcon aria-hidden="true" />
			<AlertTitle>{restoredTitle(restoredAt)}</AlertTitle>
			<AlertDescription>Discard them to go back to the recipe as it was saved.</AlertDescription>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="col-start-2 mt-2 justify-self-start"
				aria-label="Discard unsaved changes"
				onClick={onDiscard}
			>
				Discard
			</Button>
		</Alert>
	);
}

// Heads the form in the restored changes' notice's place once it drops changes kept in this browser
// for an earlier version of what it edits, and stays while the form does; their entry goes as they
// drop, so the next load says nothing. Dropping them is announced, so nothing reads this out as it
// appears.
function OutdatedChangesNotice({ outdatedAt }: { outdatedAt: Date }) {
	return (
		<Alert role={undefined} aria-live={undefined}>
			<InfoIcon aria-hidden="true" />
			<AlertTitle>{outdatedTitle(outdatedAt)}</AlertTitle>
			<AlertDescription>{outdatedDescription}</AlertDescription>
		</Alert>
	);
}

// The form's fields, with the original recipe beside them from lg when there is one, which widens the
// page. The fields come first, in the left column, so the action bar's Save after them sits at their
// edge; the original is on the right. The wrapper stays as the original comes and goes, so the
// fields, and the uploads in them, never remount.
function BesideOriginal({
	original,
	children,
}: {
	original: React.ReactElement | false;
	children: React.ReactNode;
}) {
	const hasOriginal = original !== false;
	return (
		<div
			{...wideContentProps(hasOriginal)}
			className={cn(hasOriginal && 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-12')}
		>
			{children}
			{original}
		</div>
	);
}

// Mirrors the top of the recipe form: its title and source, then the start of the ingredients. Where
// the form most often has the original beside it, its place shows too.
function RecipeFormSkeleton({ besideOriginal = false }: { besideOriginal?: boolean }) {
	return (
		<BesideOriginal
			original={besideOriginal && <OriginalRecipePaneSkeleton className="max-lg:hidden" />}
		>
			<div role="status" aria-live="polite" className="flex flex-col gap-7">
				<span className="sr-only">Loading the recipe form</span>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-5 w-12" />
					<Skeleton className="h-9 w-full" />
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-5 w-16" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-5 w-full" />
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</div>
		</BesideOriginal>
	);
}

export { RecipeForm, RecipeFormSkeleton };
