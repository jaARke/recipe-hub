'use client';

import { XIcon } from 'lucide-react';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { describedBy } from '@/components/forms/described-by';
import { FieldProblem, type ProblemCheck } from '@/components/forms/problem-summary';
import {
	tagLabelsFrom,
	type RecipeFormEdit,
	type RecipeFormTag,
} from '@/components/recipe-form/recipe-form-values';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type TagsFieldProps = {
	// Starts every id in the field, so the form can link to its problems.
	idPrefix: string;
	tags: readonly RecipeFormTag[];
	// What is typed in the field and not yet added.
	draft: string;
	error: string | undefined;
	// Lets the member mark the error as checked, as when reviewing a draft's problems.
	errorCheck?: ProblemCheck;
	dispatch: React.Dispatch<RecipeFormEdit>;
};

// The field's label, which the form's problem summary repeats.
const tagsFieldLabel = 'Tags';

// The ids of the field's parts, which the form's problem summary links to.
function tagsFieldIds(prefix: string) {
	return {
		input: `${prefix}-input`,
		description: `${prefix}-description`,
		error: `${prefix}-error`,
		tag: (tagId: number) => `${prefix}-tag-${tagId}`,
	};
}

// Tags are typed one at a time, or several separated by commas, and show as chips that remove
// themselves. The domain tidies and de-duplicates them on save.
function TagsField({ idPrefix, tags, draft, error, errorCheck, dispatch }: TagsFieldProps) {
	const [announcement, setAnnouncement] = React.useState('');
	const invalid = error !== undefined;
	const ids = tagsFieldIds(idPrefix);

	function addTags(text: string) {
		const labels = tagLabelsFrom(text);
		dispatch({ type: 'addTags', text });
		if (labels.length > 0) {
			setAnnouncement(`Added ${labels.join(', ')}.`);
		}
	}

	// The removed chip's button leaves with it, so focus moves to a neighbor or the field.
	function removeTag(tag: RecipeFormTag, index: number) {
		const neighbor = tags[index + 1] ?? tags[index - 1];
		flushSync(() => {
			dispatch({ type: 'removeTag', tagId: tag.id });
			setAnnouncement(`Removed ${tag.label}.`);
		});
		document.getElementById(neighbor === undefined ? ids.input : ids.tag(neighbor.id))?.focus();
	}

	return (
		<Field data-invalid={invalid ? 'true' : undefined}>
			<FieldLabel htmlFor={ids.input}>{tagsFieldLabel}</FieldLabel>
			<div className="flex gap-2">
				<Input
					id={ids.input}
					value={draft}
					autoComplete="off"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy(ids.description, invalid && ids.error)}
					onChange={(event) =>
						dispatch({ type: 'setText', field: 'tagDraft', text: event.target.value })
					}
					onKeyDown={(event) => {
						// Enter adds the tag rather than saving the recipe.
						if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
							event.preventDefault();
							addTags(draft);
						}
					}}
					onPaste={(event) => {
						const pasted = event.clipboardData.getData('text');
						if (!pasted.includes(',')) {
							return;
						}
						event.preventDefault();
						const { selectionStart, selectionEnd } = event.currentTarget;
						addTags(
							`${draft.slice(0, selectionStart ?? draft.length)}${pasted}${draft.slice(selectionEnd ?? draft.length)}`
						);
					}}
				/>
				<Button type="button" variant="outline" onClick={() => addTags(draft)}>
					Add tag
				</Button>
			</div>
			<FieldDescription id={ids.description}>
				Such as Dessert or Weeknight. Separate several with commas.
			</FieldDescription>
			{invalid && (
				<FieldProblem id={ids.error} check={errorCheck}>
					{error}
				</FieldProblem>
			)}
			{tags.length > 0 && (
				<ul aria-label="Added tags" className="flex flex-wrap gap-2">
					{tags.map((tag, index) => (
						<li key={tag.id}>
							<Button
								id={ids.tag(tag.id)}
								type="button"
								variant="outline"
								size="sm"
								onClick={() => removeTag(tag, index)}
							>
								<span className="sr-only">Remove </span>
								{tag.label}
								<XIcon data-icon="inline-end" aria-hidden="true" />
							</Button>
						</li>
					))}
				</ul>
			)}
			<p role="status" className="sr-only">
				{announcement}
			</p>
		</Field>
	);
}

export { TagsField, tagsFieldIds, tagsFieldLabel };
