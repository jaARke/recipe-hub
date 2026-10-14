'use client';

import { cn } from 'cn';
import { ScanTextIcon } from 'lucide-react';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { hasFieldErrors } from '@/components/forms/field-errors';
import { FieldNote, type FieldNoteContent } from '@/components/forms/field-note';
import { focusCentered } from '@/components/forms/focus-centered';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FieldErrors, FormAction } from '@/components/forms/form-state';
import { LiveAnnouncer, useLiveAnnouncement } from '@/components/forms/live-announcement';
import {
	ProblemSummary,
	SummarizedProblems,
	type SummarizedProblem,
} from '@/components/forms/problem-summary';
import { TextField, textFieldIds } from '@/components/forms/text-field';
import { TextareaField } from '@/components/forms/textarea-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { wideContentProps } from '@/components/layout/page-container';
import { OriginalRecipePane } from '@/components/recipe-form/original-recipe-pane';
import {
	PhotoField,
	photoFieldIds,
	photoName,
	photoViewerImages,
} from '@/components/recipe-form/photo-field';
import { uploadPhoto, type PhotoUploader } from '@/components/recipe-form/photo-upload';
import {
	recipeFormFieldNames,
	type EditedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
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
	UncheckedSaveDialog,
} from '@/components/recipe-form/review-notes';
import { listRowNames, sectionLabel } from '@/components/recipe-form/sectioned-list';
import {
	SectionedListField,
	sectionedListFieldIds,
} from '@/components/recipe-form/sectioned-list-field';
import { TagsField, tagsFieldIds, tagsFieldLabel } from '@/components/recipe-form/tags-field';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import {
	RecipeImageViewer,
	RecipeImageViewerButton,
} from '@/components/recipe/recipe-image-viewer';
import { HighlightedSegments } from '@/components/search/highlighted-segments';
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
import { settings } from '@/lib/settings';

const failureMessage = 'We couldn’t save the recipe. Check your connection and try again.';

const yieldKindItems = [
	{ value: 'servings', label: 'Serves' },
	{ value: 'makes', label: 'Makes' },
] as const satisfies readonly { value: RecipeYieldKind; label: string }[];

// The fields whose text the form holds as typed, each with its own problems.
type TextFieldName = Exclude<RecipeFormErrorField, 'tags'>;

// What each field is called on screen, which the problem summary repeats. The yield's amount is
// named for its kind.
const textFieldLabels = {
	title: 'Title',
	description: 'Description',
	source: 'Source',
	prepMinutes: 'Prep, in minutes',
	cookMinutes: 'Cook, in minutes',
	totalMinutes: 'Total, in minutes',
	yieldUnit: 'Unit',
	notes: 'Notes',
} as const satisfies Record<Exclude<TextFieldName, 'yieldAmount'>, string>;

const yieldAmountLabels = {
	servings: 'Servings',
	makes: 'Amount',
} as const satisfies Record<RecipeYieldKind, string>;

const listFieldLabels = {
	ingredientSections: { legend: 'Ingredients', noun: 'ingredient' },
	instructionSections: { legend: 'Steps', noun: 'step' },
} as const satisfies Record<RecipeFormListName, { legend: string; noun: string }>;

const photoFieldLegends = {
	dish: 'Photos',
	scan: 'Original recipe',
} as const satisfies Record<RecipeImageRole, string>;

type RecipeFormProps = {
	// Built with recipeFormValues, from nothing, a recipe to edit, or a draft to review.
	initial: RecipeFormValues;
	// Redirects to the recipe once it is saved, which also starts the form over.
	action: FormAction;
	// Where this environment keeps new photos of each role.
	uploadFolders: Record<RecipeImageRole, string>;
	// Every tag label in use, most used first, which the tags field suggests.
	tagLabels: readonly string[];
	uploader?: PhotoUploader;
	// Absent when adding a recipe.
	editing?: EditedRecipe;
	// The import whose draft the form reviews, which the saved recipe takes its provenance from. The
	// review's intro takes focus as the page loads.
	importId?: string;
	submitLabel: string;
};

function subscribeToNothing() {
	return () => {};
}

// False in the server's render and while hydrating, then true.
function useHydrated(): boolean {
	return React.useSyncExternalStore(
		subscribeToNothing,
		() => true,
		() => false
	);
}

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
// submit before then would send what the server rendered rather than what was typed.
function RecipeForm({
	initial,
	action,
	uploadFolders,
	tagLabels,
	uploader = uploadPhoto,
	editing,
	importId,
	submitLabel,
}: RecipeFormProps) {
	const baseId = React.useId();
	const [values, dispatch] = React.useReducer(editRecipeForm, initial);
	const hydrated = useHydrated();
	const submission = recipeFormSubmission(values);
	const isEditing = editing !== undefined;
	const photosInProgress = hasPhotosInProgress(values);
	const ids = {
		reviewIntro: `${baseId}-review-intro`,
		formNote: `${baseId}-form-note`,
		save: `${baseId}-save`,
		saveNote: `${baseId}-save-note`,
		yieldKind: `${baseId}-yieldKind`,
		field: (field: TextFieldName) => `${baseId}-${field}`,
		list: (list: RecipeFormListName) => `${baseId}-${list}`,
		tags: `${baseId}-tags`,
		photos: (role: RecipeImageRole) => `${baseId}-photos-${role}`,
	};

	// A save's problems name places in what it sent, so they land through that submission's targets.
	const saveRecipe: FormAction = async (previous, formData) => {
		const { targets } = submission;
		const result = await action(previous, formData);
		if (result.status === 'error') {
			dispatch({ type: 'attachErrors', fieldErrors: result.fieldErrors, targets });
		}
		return result;
	};
	const [state, formProps, pending] = useFormAction(saveRecipe, failureMessage, {
		check: checkRequired,
		onSubmit: warnBeforeSaving,
	});

	// The summary lists a save's errors, each linking to where it shows, and takes focus.
	const problems = recipeFormProblems(values).map(summarizedProblem);
	// What is left to check against the original, each with its note in place, until it's edited or
	// looks right; saving with any left asks first.
	const checks = recipeFormChecks(values);
	const checksByKey = new Map(checks.map((check) => [problemKey(check.target), check]));
	// Announced as "Looks right" clears a note, and never as a draft loads.
	const [reviewAnnouncement, announceReview] = useLiveAnnouncement();
	const [warningOpen, setWarningOpen] = React.useState(false);
	// Set by "Save anyway", so the save it starts skips the warning.
	const savingAnyway = React.useRef(false);

	// Reviewing an import starts on its intro, once, not again when a hidden page shows.
	const focusedReview = React.useRef(false);
	React.useEffect(() => {
		if (importId === undefined || focusedReview.current) {
			return;
		}
		focusedReview.current = true;
		document.getElementById(ids.reviewIntro)?.focus();
	}, [importId, ids.reviewIntro]);

	function fieldLabel(field: TextFieldName): string {
		return field === 'yieldAmount' ? yieldAmountLabels[values.yieldKind] : textFieldLabels[field];
	}

	// What the summary names a place by, the field or error its link focuses, and its note's id.
	function locationParts(
		target: RecipeFormLocation
	): Pick<SummarizedProblem, 'label' | 'targetId'> & { noteId: string } {
		switch (target.kind) {
			case 'form':
				return { noteId: ids.formNote };
			case 'field':
				return target.field === 'tags'
					? {
							label: tagsFieldLabel,
							targetId: tagsFieldIds(ids.tags).input,
							noteId: tagsFieldIds(ids.tags).note,
						}
					: {
							label: fieldLabel(target.field),
							targetId: ids.field(target.field),
							noteId: textFieldIds(ids.field(target.field)).note,
						};
			case 'list':
				return {
					label: listFieldLabels[target.list].legend,
					targetId: sectionedListFieldIds(ids.list(target.list)).error,
					noteId: sectionedListFieldIds(ids.list(target.list)).note,
				};
			case 'row':
			case 'section': {
				const { legend, noun } = listFieldLabels[target.list];
				const listIds = sectionedListFieldIds(ids.list(target.list));
				const names = listRowNames(values[target.list].rows, noun)[target.index];
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

	// Clears the note, then moves on to the next thing to check, or to Save once nothing is left.
	function confirmCheck(check: RecipeFormCheck) {
		const index = checks.indexOf(check);
		const left = checks.filter((other) => other !== check);
		const next = left[index] ?? left[0];
		flushSync(() => {
			dispatch({ type: 'resolveReviewNote', target: check.target });
			announceReview(checkedAnnouncement(left.length));
		});
		if (next === undefined) {
			document.getElementById(ids.save)?.focus();
		} else {
			focusCheck(next);
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
		return {
			id: ids.field(field),
			value: values.text[field],
			error: values.fieldErrors[field],
			note: noteFor({ kind: 'field', field }),
			onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
				dispatch({ type: 'setText', field, text: event.target.value }),
		};
	}

	// What the browser knows a save would be refused for, shown as a save's errors are, so the warning
	// about what is left to check comes only once the save can succeed.
	function checkRequired(): FieldErrors {
		const fieldErrors = recipeFormRequiredErrors(values);
		if (hasFieldErrors(fieldErrors)) {
			dispatch({ type: 'attachErrors', fieldErrors, targets: submission.targets });
		}
		return fieldErrors;
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

	const [firstCheck] = checks;
	const formNote = noteFor({ kind: 'form' });
	// The scans to read beside the form from lg, which widen the page, or in the viewer below lg.
	const originalImages = photoViewerImages(values.photos.scan, 'scan');
	const hasOriginal = originalImages.length > 0;

	const form = (
		<form {...formProps} className="flex flex-col gap-8">
			{/* About the whole form, such as an edit conflict; the summary lists a save's problems. */}
			<FormErrorAlert message={state.status === 'error' ? state.message : undefined} />
			<ProblemSummary problems={problems} />
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
			<LiveAnnouncer announcement={reviewAnnouncement} />
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
			{importId !== undefined && (
				<input type="hidden" name={recipeFormFieldNames.importId} value={importId} />
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
					<TextareaField
						{...textFieldProps('description')}
						label={textFieldLabels.description}
						description="Shown in search results and when the recipe is shared."
					/>
					<TextField
						{...textFieldProps('source')}
						label={textFieldLabels.source}
						autoComplete="off"
						description="Who or where the recipe comes from, such as a relative or a cookbook."
					/>
					<FieldSet>
						<FieldLegend>Times and yield</FieldLegend>
						<div className="grid gap-4 sm:grid-cols-3">
							<TextField
								{...textFieldProps('prepMinutes')}
								label={textFieldLabels.prepMinutes}
								inputMode="numeric"
							/>
							<TextField
								{...textFieldProps('cookMinutes')}
								label={textFieldLabels.cookMinutes}
								inputMode="numeric"
							/>
							<TextField
								{...textFieldProps('totalMinutes')}
								label={textFieldLabels.totalMinutes}
								inputMode="numeric"
								description="Only if it’s longer than prep and cook together, such as time to chill."
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-3">
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
							<TextField
								{...textFieldProps('yieldAmount')}
								label={fieldLabel('yieldAmount')}
								autoComplete="off"
								description="A number or a range, such as 4 or 4 to 6."
							/>
							{values.yieldKind === 'makes' && (
								<TextField
									{...textFieldProps('yieldUnit')}
									label={textFieldLabels.yieldUnit}
									autoComplete="off"
									description="Such as biscuits or loaves."
								/>
							)}
						</div>
					</FieldSet>
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
						numbered
						noteFor={noteFor}
					/>
					<TextareaField
						{...textFieldProps('notes')}
						label={textFieldLabels.notes}
						description="The story behind the recipe, or tips for making it."
					/>
					<TagsField
						idPrefix={ids.tags}
						tags={values.tags}
						draft={values.text.tagDraft}
						tagLabels={tagLabels}
						respellableTags={editing?.respellableTags ?? []}
						error={values.fieldErrors.tags}
						note={noteFor({ kind: 'field', field: 'tags' })}
						dispatch={dispatch}
					/>
					<PhotoField
						idPrefix={ids.photos('dish')}
						role="dish"
						legend={photoFieldLegends.dish}
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
						description="Photos of the recipe as it was written, such as a recipe card. Only members can see them."
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
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
				{photosInProgress && (
					<p id={ids.saveNote} className="text-sm text-muted-foreground">
						Wait for the photos to finish uploading.
					</p>
				)}
				<Button
					id={ids.save}
					type="submit"
					// Natively disabled until hydrated, since a click before then would still submit.
					disabled={!hydrated || photosInProgress || pending}
					focusableWhenDisabled={hydrated}
					aria-describedby={photosInProgress ? ids.saveNote : undefined}
				>
					{pending && <Spinner data-icon="inline-start" />}
					{pending ? 'Saving recipe' : submitLabel}
				</Button>
			</div>
			<UncheckedSaveDialog
				open={warningOpen}
				onOpenChange={setWarningOpen}
				count={checks.length}
				onShow={() => {
					if (firstCheck !== undefined) {
						focusCheck(firstCheck);
					}
				}}
				onSaveAnyway={saveAnyway}
			/>
		</form>
	);

	// The wrapper stays as the original comes and goes, so the form, and the uploads in it, never remount.
	return (
		<div
			{...wideContentProps(hasOriginal)}
			className={cn(hasOriginal && 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-12')}
		>
			{hasOriginal && (
				<OriginalRecipePane
					images={originalImages}
					title={photoFieldLegends.scan}
					className="max-lg:hidden"
				/>
			)}
			{form}
		</div>
	);
}

// Mirrors the top of the recipe form: its title, description, and source fields.
function RecipeFormSkeleton() {
	return (
		<div role="status" aria-live="polite" className="flex flex-col gap-7">
			<span className="sr-only">Loading the recipe form</span>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-12" />
				<Skeleton className="h-9 w-full" />
			</div>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-24" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-5 w-3/4" />
			</div>
			<div className="flex flex-col gap-3">
				<Skeleton className="h-5 w-16" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-5 w-full" />
			</div>
		</div>
	);
}

export { RecipeForm, RecipeFormSkeleton };
