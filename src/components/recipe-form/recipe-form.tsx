'use client';

import * as React from 'react';
import { FormErrorAlert } from '@/components/forms/form-error-alert';
import type { FormAction } from '@/components/forms/form-state';
import { TextField } from '@/components/forms/text-field';
import { TextareaField } from '@/components/forms/textarea-field';
import { useFormAction } from '@/components/forms/use-form-action';
import { PhotoField } from '@/components/recipe-form/photo-field';
import { uploadPhoto, type PhotoUploader } from '@/components/recipe-form/photo-upload';
import {
	recipeFormFieldNames,
	type EditedRecipe,
} from '@/components/recipe-form/recipe-form-fields';
import {
	editRecipeForm,
	hasPhotosInProgress,
	recipeFormSubmission,
	type RecipeFormErrorField,
	type RecipeFormValues,
	type RecipeYieldKind,
} from '@/components/recipe-form/recipe-form-values';
import { SectionedListField } from '@/components/recipe-form/sectioned-list-field';
import { TagsField } from '@/components/recipe-form/tags-field';
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

// A field marked invalid, or a group's own error, which takes focus in place of a field.
const invalidSelector = '[aria-invalid="true"], [data-slot="field-error"][tabindex="-1"]';

// The fields whose text the form holds as typed, each with its own problems.
type TextFieldName = Exclude<RecipeFormErrorField, 'tags'>;

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
		saveNote: `${baseId}-save-note`,
		yieldKind: `${baseId}-yieldKind`,
		field: (field: TextFieldName) => `${baseId}-${field}`,
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
	const formMessage = (state.status === 'error' ? state.message : undefined) ?? values.formError;

	// After a failed save, focus moves to the problem: the alert, or else the first invalid field.
	// Each result moves it once, not again when a hidden page shows.
	const focusedState = React.useRef(state);
	React.useEffect(() => {
		if (focusedState.current === state) {
			return;
		}
		focusedState.current = state;
		if (state.status !== 'error') {
			return;
		}
		const target =
			document.getElementById(ids.formError) ??
			formRef.current?.querySelector<HTMLElement>(invalidSelector);
		target?.focus();
	}, [state, ids.formError]);

	function textFieldProps(field: TextFieldName) {
		return {
			id: ids.field(field),
			value: values.text[field],
			error: values.fieldErrors[field],
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
			<FieldGroup>
				<TextField
					{...textFieldProps('title')}
					label="Title"
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
					label="Description"
					description="Shown in search results and when the recipe is shared."
				/>
				<TextField
					{...textFieldProps('source')}
					label="Source"
					autoComplete="off"
					description="Who or where the recipe comes from, such as a relative or a cookbook."
				/>
				<FieldSet>
					<FieldLegend>Times and yield</FieldLegend>
					<div className="grid gap-4 sm:grid-cols-3">
						<TextField
							{...textFieldProps('prepMinutes')}
							label="Prep, in minutes"
							inputMode="numeric"
						/>
						<TextField
							{...textFieldProps('cookMinutes')}
							label="Cook, in minutes"
							inputMode="numeric"
						/>
						<TextField
							{...textFieldProps('totalMinutes')}
							label="Total, in minutes"
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
							label={values.yieldKind === 'servings' ? 'Servings' : 'Amount'}
							autoComplete="off"
							description="A number or a range, such as 4 or 4 to 6."
						/>
						{values.yieldKind === 'makes' && (
							<TextField
								{...textFieldProps('yieldUnit')}
								label="Unit"
								autoComplete="off"
								description="Such as biscuits or loaves."
							/>
						)}
					</div>
				</FieldSet>
				<SectionedListField
					name="ingredientSections"
					list={values.ingredientSections}
					nextId={values.nextId}
					dispatch={dispatch}
					legend="Ingredients"
					description="One ingredient per field, as you'd write it. Add a section for a separate part, such as a glaze."
					noun="ingredient"
					itemPlaceholder="2½ cups all-purpose flour"
					headingPlaceholder="For the glaze"
					maxItemLength={maxIngredientLineLength}
					itemPreview={ingredientPreview}
				/>
				<SectionedListField
					name="instructionSections"
					list={values.instructionSections}
					nextId={values.nextId}
					dispatch={dispatch}
					legend="Steps"
					description="One step per field. Add a section for a separate part, such as a glaze."
					noun="step"
					itemPlaceholder="Heat the oven to 450°F."
					headingPlaceholder="For the glaze"
					numbered
				/>
				<TextareaField
					{...textFieldProps('notes')}
					label="Notes"
					description="The story behind the recipe, or tips for making it."
				/>
				<TagsField
					tags={values.tags}
					draft={values.text.tagDraft}
					error={values.fieldErrors.tags}
					dispatch={dispatch}
				/>
				<PhotoField
					role="dish"
					legend="Photos"
					description="Photos of the finished dish, which anyone can see. The first is the cover. Describe each one for people who can't see it."
					photos={values.photos.dish}
					nextId={values.nextId}
					dispatch={dispatch}
					uploadFolder={uploadFolders.dish}
					uploader={uploader}
				/>
				<PhotoField
					role="scan"
					legend="Original recipe"
					description="Photos of the recipe as it was written, such as a recipe card. Only members can see them."
					photos={values.photos.scan}
					nextId={values.nextId}
					dispatch={dispatch}
					uploadFolder={uploadFolders.scan}
					uploader={uploader}
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
