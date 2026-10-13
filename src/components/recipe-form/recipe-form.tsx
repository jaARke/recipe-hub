'use client';

import * as React from 'react';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import {
	countChecked,
	ProblemSummary,
	type ProblemCheck,
	type SummarizedProblem,
} from '@/components/forms/problem-summary';
import { TextField } from '@/components/forms/text-field';
import { TextareaField } from '@/components/forms/textarea-field';
import { useFocusOnFailure } from '@/components/forms/use-focus-on-failure';
import { useFormAction } from '@/components/forms/use-form-action';
import { PhotoField, photoFieldIds, photoName } from '@/components/recipe-form/photo-field';
import { uploadPhoto, type PhotoUploader } from '@/components/recipe-form/photo-upload';
import {
	recipeFormFieldNames,
	type EditedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
import {
	editRecipeForm,
	hasPhotosInProgress,
	problemKey,
	recipeFormProblems,
	recipeFormSubmission,
	type ProblemTarget,
	type RecipeFormErrorField,
	type RecipeFormListName,
	type RecipeFormProblem,
	type RecipeFormValues,
	type RecipeYieldKind,
} from '@/components/recipe-form/recipe-form-values';
import { itemLabel, sectionName } from '@/components/recipe-form/sectioned-list';
import {
	SectionedListField,
	sectionedListFieldIds,
} from '@/components/recipe-form/sectioned-list-field';
import { TagsField, tagsFieldIds, tagsFieldLabel } from '@/components/recipe-form/tags-field';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
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
import { maxIngredientLineLength } from '@/domain/recipe/ingredient-limits';
import { parseIngredientLine } from '@/domain/recipe/ingredient-parser';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';

const failureMessage = "We couldn't save the recipe. Check your connection and try again.";

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
	uploader?: PhotoUploader;
	// Absent when adding a recipe.
	editing?: EditedRecipe;
	// The import whose draft the form reviews, which the saved recipe takes its provenance from. The
	// draft's problems take focus as the page loads.
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

// How the line reads on the recipe page, where that differs from the text as typed.
function ingredientPreview(text: string): React.ReactNode {
	const line = parseIngredientLine(text);
	if (line.amount === undefined) {
		return undefined;
	}
	return (
		<>
			Shows as <IngredientLineText line={line} />
		</>
	);
}

// The recipe form for adding, editing, and reviewing an import. Its whole value is sent as JSON in
// one field; the action maps it with recipeContentFromForm. Saving waits for hydration, since a
// submit before then would send what the server rendered rather than what was typed.
function RecipeForm({
	initial,
	action,
	uploadFolders,
	uploader = uploadPhoto,
	editing,
	importId,
	submitLabel,
}: RecipeFormProps) {
	const baseId = React.useId();
	const formRef = React.useRef<HTMLFormElement>(null);
	const [values, dispatch] = React.useReducer(editRecipeForm, initial);
	const hydrated = useHydrated();
	const submission = recipeFormSubmission(values);
	const isEditing = editing !== undefined;
	const photosInProgress = hasPhotosInProgress(values);
	const ids = {
		formError: `${baseId}-form-error`,
		problemSummary: `${baseId}-problem-summary`,
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
	const [state, formAction, pending] = useFormAction(saveRecipe, failureMessage);
	useFocusOnFailure(state, formRef, ids.formError);
	// Announced as the member checks problems, and never as a draft loads.
	const [checkAnnouncement, setCheckAnnouncement] = React.useState('');

	// A draft starts with problems, which the summary lists until the first save, each with a check
	// the member can mark, in the summary and beside its field. A save's problems show as before,
	// beside their fields and in the alert.
	const problems = state.status === 'idle' ? recipeFormProblems(values) : [];
	const summarizedProblems = new Map(
		problems.map((problem) => [problemKey(problem.target), summarizedProblem(problem)])
	);
	const formMessage = state.status === 'error' ? (state.message ?? values.formError) : undefined;

	// Reviewing an import starts on its problems, once, not again when a hidden page shows.
	const focusedProblems = React.useRef(false);
	React.useEffect(() => {
		if (importId === undefined || focusedProblems.current) {
			return;
		}
		focusedProblems.current = true;
		document.getElementById(ids.problemSummary)?.focus();
	}, [importId, ids.problemSummary]);

	function fieldLabel(field: TextFieldName): string {
		return field === 'yieldAmount' ? yieldAmountLabels[values.yieldKind] : textFieldLabels[field];
	}

	function problemPlace(
		target: RecipeFormProblem['target']
	): Pick<SummarizedProblem, 'label' | 'targetId'> {
		switch (target.kind) {
			case 'form':
				return {};
			case 'field':
				return target.field === 'tags'
					? { label: tagsFieldLabel, targetId: tagsFieldIds(ids.tags).input }
					: { label: fieldLabel(target.field), targetId: ids.field(target.field) };
			case 'list':
				return {
					label: listFieldLabels[target.list].legend,
					targetId: sectionedListFieldIds(ids.list(target.list)).error,
				};
			case 'heading':
				return {
					label: `${listFieldLabels[target.list].legend}, section ${target.sectionIndex + 1} heading`,
					targetId: sectionedListFieldIds(ids.list(target.list)).heading(target.id),
				};
			case 'section':
				return {
					label: `${listFieldLabels[target.list].legend}, ${sectionName(values[target.list].sections, target.sectionIndex)}`,
					targetId: sectionedListFieldIds(ids.list(target.list)).sectionError(target.id),
				};
			case 'item': {
				const { sections, showsHeadings } = values[target.list];
				return {
					label: itemLabel(
						listFieldLabels[target.list].noun,
						sections,
						target.place,
						showsHeadings
					),
					targetId: sectionedListFieldIds(ids.list(target.list)).item(target.id),
				};
			}
			case 'photo': {
				const photo = values.photos[target.role][target.index];
				return {
					label:
						photo === undefined
							? photoFieldLegends[target.role]
							: `${photoFieldLegends[target.role]}, ${photoName(photo, target.index, target.role)}`,
					targetId: photoFieldIds(ids.photos(target.role)).photoError(target.id),
				};
			}
		}
	}

	function summarizedProblem(problem: RecipeFormProblem): SummarizedProblem {
		const place = problemPlace(problem.target);
		return {
			message: problem.message,
			...place,
			check: {
				name: place.label ?? problem.message,
				checked: problem.checked,
				onCheckedChange: (checked) => checkProblem(problem, checked),
			},
		};
	}

	function checkProblem(problem: RecipeFormProblem, checked: boolean) {
		dispatch({ type: 'setProblemChecked', target: problem.target, checked });
		const checkedCount = problems.filter((other) =>
			other === problem ? checked : other.checked
		).length;
		setCheckAnnouncement(countChecked(checkedCount, problems.length));
	}

	// The check for the problem beside a field, while the summary lists it.
	function problemCheck(target: ProblemTarget): ProblemCheck | undefined {
		return summarizedProblems.get(problemKey(target))?.check;
	}

	function textFieldProps(field: TextFieldName) {
		return {
			id: ids.field(field),
			value: values.text[field],
			error: values.fieldErrors[field],
			errorCheck: problemCheck({ kind: 'field', field }),
			onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
				dispatch({ type: 'setText', field, text: event.target.value }),
		};
	}

	return (
		<form ref={formRef} action={formAction} noValidate className="flex flex-col gap-8">
			{formMessage !== undefined && (
				<div id={ids.formError} tabIndex={-1}>
					<FormErrorAlert message={formMessage} />
				</div>
			)}
			{summarizedProblems.size > 0 && (
				<div id={ids.problemSummary} tabIndex={-1}>
					<ProblemSummary problems={[...summarizedProblems.values()]} />
					<p role="status" className="sr-only">
						{checkAnnouncement}
					</p>
				</div>
			)}
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
			<FieldGroup>
				<TextField
					{...textFieldProps('title')}
					label={textFieldLabels.title}
					required
					autoComplete="off"
					description={
						isEditing
							? "Changing the title changes the recipe's link. Old links keep working."
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
							description="Only if it's longer than prep and cook together, such as time to chill."
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
					description="One ingredient per field, as you'd write it. Add a section for a separate part, such as a glaze."
					itemPlaceholder="2½ cups all-purpose flour"
					headingPlaceholder="For the glaze"
					maxItemLength={maxIngredientLineLength}
					itemPreview={ingredientPreview}
					problemCheck={problemCheck}
				/>
				<SectionedListField
					idPrefix={ids.list('instructionSections')}
					name="instructionSections"
					list={values.instructionSections}
					nextId={values.nextId}
					dispatch={dispatch}
					{...listFieldLabels.instructionSections}
					description="One step per field. Add a section for a separate part, such as a glaze."
					itemPlaceholder="Heat the oven to 450°F."
					headingPlaceholder="For the glaze"
					numbered
					problemCheck={problemCheck}
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
					error={values.fieldErrors.tags}
					errorCheck={problemCheck({ kind: 'field', field: 'tags' })}
					dispatch={dispatch}
				/>
				<PhotoField
					idPrefix={ids.photos('dish')}
					role="dish"
					legend={photoFieldLegends.dish}
					description="Photos of the finished dish, which anyone can see. The first is the cover. Describe each one for people who can't see it."
					photos={values.photos.dish}
					nextId={values.nextId}
					dispatch={dispatch}
					uploadFolder={uploadFolders.dish}
					uploader={uploader}
					problemCheck={problemCheck}
				/>
				<PhotoField
					idPrefix={ids.photos('scan')}
					role="scan"
					legend={photoFieldLegends.scan}
					description="Photos of the recipe as it was written, such as a recipe card. Only members can see them."
					photos={values.photos.scan}
					nextId={values.nextId}
					dispatch={dispatch}
					uploadFolder={uploadFolders.scan}
					uploader={uploader}
					problemCheck={problemCheck}
				/>
			</FieldGroup>
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
				{photosInProgress && (
					<p id={ids.saveNote} className="text-sm text-muted-foreground">
						Wait for the photos to finish uploading.
					</p>
				)}
				<Button
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
		</form>
	);
}

// Mirrors the top of the recipe form: its title, description, and source fields.
function RecipeFormSkeleton() {
	return (
		<div role="status" className="flex flex-col gap-7">
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
