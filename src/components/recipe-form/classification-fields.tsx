'use client';

import { cn } from 'cn';
import type * as React from 'react';
import { describedBy } from '@/components/forms/described-by';
import {
	FieldNote,
	fieldNoteMessageId,
	type FieldNoteContent,
} from '@/components/forms/field-note';
import { FieldProblem } from '@/components/forms/problem-summary';
import type {
	ProblemTarget,
	RecipeFormChoiceField,
	RecipeFormEdit,
	RecipeFormValues,
} from '@/components/recipe-form/recipe-form-values';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { chapterLabels, chapters, type Chapter } from '@/domain/recipe/chapter';
import { dietLabels, diets as dietVocabulary, dietsImpliedBy } from '@/domain/recipe/diet';
import { holidayLabels, holidays as holidayVocabulary } from '@/domain/recipe/holiday';

// What each group is called, which the form's problem summary and a note's button repeat.
const classificationFieldLabels = {
	chapter: 'Chapter',
	holidays: 'Holidays',
	diets: 'Diet',
} as const satisfies Record<RecipeFormChoiceField, string>;

// Every choice's row, radio or checkbox: a comfortable tap without spreading the lists out. A
// checkbox group's own gap is cleared, so both kinds of list keep one rhythm.
const choiceRowClassName = 'min-h-9 items-center';
const choiceListClassName =
	'grid gap-x-6 gap-y-0 data-[slot=checkbox-group]:gap-x-6 data-[slot=checkbox-group]:gap-y-0';

const veganDescription = 'Vegan recipes are vegetarian and dairy-free too.';

// The ids of a group's parts, which the form's problem summary links to, and where the form moves
// focus to its note. A problem's link focuses its error, which sits above the choices, as a list's
// does, so Tab goes on into them.
function classificationFieldIds(prefix: string, field: RecipeFormChoiceField) {
	const group = `${prefix}-${field}`;
	return {
		description: `${group}-description`,
		error: `${group}-error`,
		note: `${group}-note`,
		choice: (value: string) => `${group}-${value}`,
	};
}

type ClassificationFieldsProps = Pick<RecipeFormValues, 'chapter' | 'holidays' | 'diets'> & {
	// Starts every id in the fields, so the form can link to their problems.
	idPrefix: string;
	errors: Partial<Record<RecipeFormChoiceField, string>>;
	// The note on each group to check, as when reviewing a draft.
	noteFor: (target: ProblemTarget) => FieldNoteContent | undefined;
	dispatch: React.Dispatch<RecipeFormEdit>;
};

// Where the recipe goes in the family cookbook: one chapter, which saving needs, and any holidays
// and diets. Choosing Vegan ticks and holds the diets it implies.
function ClassificationFields({
	idPrefix,
	chapter,
	holidays,
	diets,
	errors,
	noteFor,
	dispatch,
}: ClassificationFieldsProps) {
	const held = dietsImpliedBy(diets);
	const chapterIds = classificationFieldIds(idPrefix, 'chapter');
	const holidayIds = classificationFieldIds(idPrefix, 'holidays');
	const dietIds = classificationFieldIds(idPrefix, 'diets');

	return (
		<>
			<ChoiceFieldSet
				field="chapter"
				idPrefix={idPrefix}
				legend={classificationFieldLabels.chapter}
				description="Where the recipe goes in the cookbook."
				error={errors.chapter}
				note={noteFor({ kind: 'field', field: 'chapter' })}
			>
				<RadioGroup
					required
					value={chapter ?? null}
					onValueChange={(next: Chapter) => dispatch({ type: 'setChapter', chapter: next })}
					className={cn(choiceListClassName, 'sm:grid-cols-2')}
				>
					{chapters.map((each) => (
						<Field key={each} orientation="horizontal" className={choiceRowClassName}>
							<RadioGroupItem
								id={chapterIds.choice(each)}
								value={each}
								aria-invalid={errors.chapter === undefined ? undefined : 'true'}
							/>
							<FieldLabel htmlFor={chapterIds.choice(each)} className="font-normal">
								{chapterLabels[each]}
							</FieldLabel>
						</Field>
					))}
				</RadioGroup>
			</ChoiceFieldSet>
			<ChoiceFieldSet
				field="holidays"
				idPrefix={idPrefix}
				legend={`${classificationFieldLabels.holidays} (optional)`}
				error={errors.holidays}
				note={noteFor({ kind: 'field', field: 'holidays' })}
			>
				<FieldGroup data-slot="checkbox-group" className={cn(choiceListClassName, 'grid-cols-2')}>
					{holidayVocabulary.map((each) => (
						<Field key={each} orientation="horizontal" className={choiceRowClassName}>
							<Checkbox
								id={holidayIds.choice(each)}
								checked={holidays.includes(each)}
								aria-invalid={errors.holidays === undefined ? undefined : 'true'}
								onCheckedChange={(checked) =>
									dispatch({ type: 'setHoliday', holiday: each, chosen: checked })
								}
							/>
							<FieldLabel htmlFor={holidayIds.choice(each)} className="font-normal">
								{holidayLabels[each]}
							</FieldLabel>
						</Field>
					))}
				</FieldGroup>
			</ChoiceFieldSet>
			<ChoiceFieldSet
				field="diets"
				idPrefix={idPrefix}
				legend={`${classificationFieldLabels.diets} (optional)`}
				description={diets.includes('vegan') ? veganDescription : undefined}
				announced
				error={errors.diets}
				note={noteFor({ kind: 'field', field: 'diets' })}
			>
				<FieldGroup data-slot="checkbox-group" className={cn(choiceListClassName, 'grid-cols-2')}>
					{dietVocabulary.map((each) => (
						<Field key={each} orientation="horizontal" className={choiceRowClassName}>
							<Checkbox
								id={dietIds.choice(each)}
								checked={held.has(each) || diets.includes(each)}
								disabled={held.has(each)}
								aria-invalid={errors.diets === undefined ? undefined : 'true'}
								onCheckedChange={(checked) =>
									dispatch({ type: 'setDiet', diet: each, chosen: checked })
								}
							/>
							<FieldLabel htmlFor={dietIds.choice(each)} className="font-normal">
								{dietLabels[each]}
							</FieldLabel>
						</Field>
					))}
				</FieldGroup>
			</ChoiceFieldSet>
		</>
	);
}

// A group of choices under its legend, with its description, problem, and note above the choices,
// each tied to the group.
function ChoiceFieldSet({
	field,
	idPrefix,
	legend,
	description,
	announced = false,
	error,
	note,
	children,
}: {
	field: RecipeFormChoiceField;
	idPrefix: string;
	legend: string;
	description?: string;
	// Whether the description says what a choice did, such as Vegan ticking two more boxes. It is then
	// a polite status, always rendered and out of the layout while empty, as FormStatusMessage is, so
	// screen readers announce it as it appears and not as the form loads.
	announced?: boolean;
	error: string | undefined;
	note: FieldNoteContent | undefined;
	children: React.ReactNode;
}) {
	const ids = classificationFieldIds(idPrefix, field);
	return (
		<FieldSet
			aria-describedby={describedBy(
				description !== undefined && ids.description,
				error !== undefined && ids.error,
				note !== undefined && fieldNoteMessageId(ids.note)
			)}
		>
			<FieldLegend variant="label">{legend}</FieldLegend>
			{announced ? (
				<FieldDescription
					id={ids.description}
					role="status"
					aria-live="polite"
					className={description === undefined ? 'sr-only' : undefined}
				>
					{description}
				</FieldDescription>
			) : (
				description !== undefined && (
					<FieldDescription id={ids.description}>{description}</FieldDescription>
				)
			)}
			{error !== undefined && (
				// Takes focus after a failed save in place of a field.
				<FieldProblem id={ids.error} tabIndex={-1}>
					{error}
				</FieldProblem>
			)}
			{note !== undefined && (
				<FieldNote id={ids.note} name={classificationFieldLabels[field]} {...note} />
			)}
			{children}
		</FieldSet>
	);
}

export { ClassificationFields, classificationFieldIds, classificationFieldLabels };
