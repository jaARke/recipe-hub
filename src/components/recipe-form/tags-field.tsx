'use client';

import { PlusIcon } from 'lucide-react';
import * as React from 'react';
import { describedBy } from '@/components/forms/described-by';
import {
	FieldNote,
	fieldNoteMessageId,
	type FieldNoteContent,
} from '@/components/forms/field-note';
import { LiveAnnouncer, useLiveAnnouncement } from '@/components/forms/live-announcement';
import { FieldProblem } from '@/components/forms/problem-summary';
import {
	tagLabelsFrom,
	tagLabelsToAdd,
	type RecipeFormEdit,
	type RecipeFormTag,
} from '@/components/recipe-form/recipe-form-values';
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
	useComboboxFilter,
} from '@/components/ui/combobox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { normalizeTagLabel, tagKey } from '@/domain/recipe/tag-normalization';

type TagsFieldProps = {
	// Starts every id in the field, so the form can link to its problems.
	idPrefix: string;
	tags: readonly RecipeFormTag[];
	// What is typed in the field and not yet added.
	draft: string;
	// Every tag label in use, most used first, which the field suggests.
	tagLabels: readonly string[];
	// The edited recipe's tags that no other recipe uses, which the field offers to respell.
	respellableTags: readonly string[];
	error: string | undefined;
	// Something to check against the original, as when reviewing a draft. It is no error.
	note?: FieldNoteContent;
	dispatch: React.Dispatch<RecipeFormEdit>;
};

// A tag as the combobox holds it: a label in use, typed text that adds a new tag, or typed text
// that respells a tag only this recipe uses. Chosen tags are in use.
type TagOption = {
	key: string;
	label: string;
	kind: 'inUse' | 'new' | 'respelling';
};

// The field's label, which the form's problem summary repeats.
const tagsFieldLabel = 'Tags';

// The ids of the field's parts, which the form's problem summary links to, and where the form
// moves focus to its note.
function tagsFieldIds(prefix: string) {
	return {
		input: `${prefix}-input`,
		description: `${prefix}-description`,
		error: `${prefix}-error`,
		note: `${prefix}-note`,
	};
}

function inUseOption(label: string): TagOption {
	return { key: tagKey(label), label, kind: 'inUse' };
}

function optionLabel(option: TagOption): string {
	return option.label;
}

function isSameTag(a: TagOption, b: TagOption): boolean {
	return a.key === b.key;
}

function optionText(option: TagOption): string {
	switch (option.kind) {
		case 'inUse':
			return option.label;
		case 'new':
			return `Add “${option.label}”`;
		case 'respelling':
			return `Change to “${option.label}”`;
	}
}

// Tags show as chips in the field, which suggests the labels in use and still takes new ones, typed
// one at a time or several separated by commas. Text typed and not added is saved with the recipe.
function TagsField({
	idPrefix,
	tags,
	draft,
	tagLabels,
	respellableTags,
	error,
	note,
	dispatch,
}: TagsFieldProps) {
	const anchor = useComboboxAnchor();
	const { contains } = useComboboxFilter({ multiple: true });
	const [announcement, announce] = useLiveAnnouncement();
	// What the list highlights, so Enter adds the typed text when it highlights nothing.
	const highlighted = React.useRef<TagOption | undefined>(undefined);
	const invalid = error !== undefined;
	const ids = tagsFieldIds(idPrefix);

	const suggestions = React.useMemo(() => tagLabels.map(inUseOption), [tagLabels]);
	const labelsByKey = React.useMemo(
		() => new Map(suggestions.map(({ key, label }) => [key, label])),
		[suggestions]
	);
	const respellableByKey = new Map(respellableTags.map((label) => [tagKey(label), label]));
	const chosen = tags.map(({ label }) => inUseOption(label));
	const chosenKeys = new Set(chosen.map(({ key }) => key));

	// The tag typed text stands for: the label in use with its key, unless it respells a tag only
	// this recipe uses.
	function optionFor(text: string): TagOption | undefined {
		const label = normalizeTagLabel(text);
		if (label === '') {
			return undefined;
		}
		const key = tagKey(label);
		const ownLabel = respellableByKey.get(key);
		if (ownLabel !== undefined && ownLabel !== label) {
			return { key, label, kind: 'respelling' };
		}
		const labelInUse = labelsByKey.get(key);
		return labelInUse === undefined ? { key, label, kind: 'new' } : inUseOption(labelInUse);
	}

	// The typed text comes first, so Enter adds what was typed rather than a longer label. A tag
	// already chosen offers nothing, and the list says it's already added.
	const typed = optionFor(draft);
	const others = suggestions.filter(
		({ key }) => !chosenKeys.has(key) && (typed?.kind !== 'inUse' || key !== typed.key)
	);
	const items = typed === undefined ? others : chosenKeys.has(typed.key) ? [] : [typed, ...others];

	function addTags(labels: readonly string[]) {
		const added = tagLabelsToAdd(tags, labels);
		dispatch({ type: 'addTags', labels });
		announce(added.length > 0 ? `Added ${added.join(', ')}.` : 'Already added.');
	}

	function addTypedTags(text: string) {
		const options = tagLabelsFrom(text).flatMap((label) => optionFor(label) ?? []);
		if (options.length > 0) {
			addTags(options.map(optionLabel));
		}
	}

	return (
		<Field data-invalid={invalid ? 'true' : undefined}>
			<FieldLabel htmlFor={ids.input}>{tagsFieldLabel}</FieldLabel>
			<Combobox
				multiple
				autoHighlight
				items={items}
				value={chosen}
				inputValue={draft}
				isItemEqualToValue={isSameTag}
				itemToStringLabel={optionLabel}
				filter={(option: TagOption, query) =>
					option === typed || contains(option, normalizeTagLabel(query), optionLabel)
				}
				onItemHighlighted={(option) => {
					highlighted.current = option;
				}}
				onInputValueChange={(text, details) => {
					// Base UI clears unchosen text when the list closes (Tab, a tap outside, Save); the form
					// keeps it and saves it with the recipe.
					if (details.reason === 'input-clear' && !details.isItemPress) {
						return;
					}
					dispatch({ type: 'setText', field: 'tagDraft', text });
				}}
				onValueChange={(next, details) => {
					// Escape on a closed list clears every value in Base UI; tags are removed one at a time.
					if (details.reason === 'escape-key') {
						return;
					}
					const added = next.filter(({ key }) => !chosenKeys.has(key));
					if (added.length > 0) {
						addTags(added.map(optionLabel));
					}
					const nextKeys = new Set(next.map(({ key }) => key));
					const removed = tags.filter(({ label }) => !nextKeys.has(tagKey(label)));
					for (const tag of removed) {
						dispatch({ type: 'removeTag', tagId: tag.id });
					}
					if (removed.length > 0) {
						announce(`Removed ${removed.map(({ label }) => label).join(', ')}.`);
					}
				}}
			>
				<ComboboxChips ref={anchor}>
					{tags.map((tag) => (
						<ComboboxChip key={tag.id} removeLabel={`Remove ${tag.label}`}>
							{tag.label}
						</ComboboxChip>
					))}
					<ComboboxChipsInput
						id={ids.input}
						// Base UI turns capitalization off; a tag starts with a capital, as most labels in use do.
						autoCapitalize="sentences"
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy(
							ids.description,
							invalid && ids.error,
							note !== undefined && fieldNoteMessageId(ids.note)
						)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
								// Enter never saves the recipe; with nothing highlighted it adds the typed text.
								event.preventDefault();
								if (highlighted.current === undefined) {
									addTypedTags(draft);
								}
							}
							if (event.key === ',') {
								event.preventDefault();
								addTypedTags(draft);
							}
						}}
						onPaste={(event) => {
							const pasted = event.clipboardData.getData('text');
							if (!pasted.includes(',')) {
								return;
							}
							event.preventDefault();
							const { selectionStart, selectionEnd } = event.currentTarget;
							addTypedTags(
								`${draft.slice(0, selectionStart ?? draft.length)}${pasted}${draft.slice(selectionEnd ?? draft.length)}`
							);
						}}
					/>
				</ComboboxChips>
				<ComboboxContent anchor={anchor}>
					<ComboboxEmpty>
						{typed === undefined ? 'No other tags yet.' : 'Already added.'}
					</ComboboxEmpty>
					<ComboboxList>
						{(option: TagOption) => (
							<ComboboxItem key={`${option.kind}:${option.key}`} value={option}>
								{option.kind !== 'inUse' && <PlusIcon aria-hidden="true" />}
								{optionText(option)}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
			<FieldDescription id={ids.description}>
				Such as Dessert or Weeknight. Separate several with commas. To remove a tag, use the left
				arrow to reach it and press Backspace.
			</FieldDescription>
			{invalid && <FieldProblem id={ids.error}>{error}</FieldProblem>}
			{note !== undefined && <FieldNote id={ids.note} name={tagsFieldLabel} {...note} />}
			{/* Base UI hides what lies outside an open list from screen readers, except live regions. */}
			<LiveAnnouncer announcement={announcement} />
		</Field>
	);
}

export { TagsField, tagsFieldIds, tagsFieldLabel };
