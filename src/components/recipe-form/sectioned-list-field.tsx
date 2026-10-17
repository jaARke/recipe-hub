'use client';

import { cn } from 'cn';
import { ArrowDownIcon, ArrowUpIcon, HeadingIcon, PlusIcon, TextIcon } from 'lucide-react';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { describedBy } from '@/components/forms/described-by';
import {
	FieldNote,
	fieldNoteMessageId,
	type FieldNoteContent,
} from '@/components/forms/field-note';
import { LiveAnnouncer, useLiveAnnouncement } from '@/components/forms/live-announcement';
import { FieldProblem } from '@/components/forms/problem-summary';
import { useFieldUndo } from '@/components/forms/use-field-undo';
import { ItemActionsMenu, type ItemAction } from '@/components/recipe-form/item-actions-menu';
import type {
	ProblemTarget,
	RecipeFormEdit,
	RecipeFormList,
	RecipeFormListName,
	RecipeFormRow,
	RecipeFormRowKind,
} from '@/components/recipe-form/recipe-form-values';
import {
	describeKindChange,
	describePaste,
	describeRowAdded,
	describeRowMove,
	describeRowRemoval,
	listRowNames,
	rowsFromPastedText,
	sectionLabel,
	type ListNaming,
} from '@/components/recipe-form/sectioned-list';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';

type SectionedListFieldProps = {
	// Starts every id in the field, so the form can link to its problems.
	idPrefix: string;
	name: RecipeFormListName;
	list: RecipeFormList;
	// The id the form gives the next row it adds.
	nextId: number;
	dispatch: React.Dispatch<RecipeFormEdit>;
	legend: string;
	description: string;
	// Lowercase and singular, such as "ingredient"; it names each field and button.
	noun: string;
	itemPlaceholder: string;
	headingPlaceholder: string;
	// Steps are numbered straight through their headings, as on the recipe page.
	numbered?: boolean;
	// Shown under a line's field and read with it, such as how an ingredient reads on the recipe
	// page; nothing shows where it returns undefined.
	itemPreview?: (text: string) => React.ReactNode;
	// The note on each part to check against the original, as when reviewing a draft.
	noteFor?: (target: ProblemTarget) => FieldNoteContent | undefined;
};

// The ids of the field's parts, which the form's problem summary links to, and where the form
// moves focus from note to note. A section's error and note sit at its heading's row.
function sectionedListFieldIds(prefix: string) {
	return {
		description: `${prefix}-description`,
		error: `${prefix}-error`,
		note: `${prefix}-note`,
		addItem: `${prefix}-add-item`,
		addHeading: `${prefix}-add-heading`,
		row: (rowId: number) => `${prefix}-row-${rowId}`,
		rowPreview: (rowId: number) => `${prefix}-row-${rowId}-preview`,
		rowError: (rowId: number) => `${prefix}-row-${rowId}-error`,
		rowNote: (rowId: number) => `${prefix}-row-${rowId}-note`,
		rowActions: (rowId: number) => `${prefix}-row-${rowId}-actions`,
		sectionError: (headingId: number) => `${prefix}-section-${headingId}-error`,
		sectionNote: (headingId: number) => `${prefix}-section-${headingId}-note`,
	};
}

// Focuses the field with this id, with the caret at the start or end of its text.
function focusField(id: string, caret: 'start' | 'end') {
	const element = document.getElementById(id);
	element?.focus();
	if (element instanceof HTMLTextAreaElement) {
		const at = caret === 'start' ? 0 : element.value.length;
		element.setSelectionRange(at, at);
	}
}

// A list of growing fields, one per row: lines, and headings over the lines after them, as a
// recipe's ingredients have "For the glaze". Each row's menu moves it, changes its kind, or removes
// it, with no dragging. Enter adds a line below, Backspace in an empty one removes it, and pasting
// several lines splits them into rows, each change announced. Undo takes back only what was typed in
// the focused row.
function SectionedListField({
	idPrefix,
	name,
	list,
	nextId,
	dispatch,
	legend,
	description,
	noun,
	itemPlaceholder,
	headingPlaceholder,
	numbered = false,
	itemPreview,
	noteFor,
}: SectionedListFieldProps) {
	const [announcement, announce] = useLiveAnnouncement();
	const { rows } = list;
	const naming: ListNaming = { noun, numbered };
	const names = listRowNames(rows, naming);
	const ids = sectionedListFieldIds(idPrefix);
	const rowUndo = useFieldUndo(
		rows.map((row) => ({
			id: ids.row(row.id),
			value: row.text,
			setValue: (text) => dispatch({ type: 'setRowText', list: name, rowId: row.id, text }),
		}))
	);

	// Structural edits commit at once with what they announce, so focus can move to what they render.
	function commit(edit: RecipeFormEdit, said: string) {
		flushSync(() => {
			dispatch(edit);
			announce(said);
		});
	}

	// At the end, or below the row at afterIndex.
	function addRow(kind: RecipeFormRowKind, afterIndex?: number) {
		const index = afterIndex === undefined ? rows.length : afterIndex + 1;
		const added = rows.toSpliced(index, 0, { kind, id: nextId, text: '' });
		commit(
			{
				type: 'addRow',
				list: name,
				kind,
				afterRowId: afterIndex === undefined ? undefined : rows[afterIndex]?.id,
			},
			describeRowAdded(added, index, naming)
		);
		focusField(ids.row(nextId), 'end');
	}

	// Focus goes to the end of the row above, as Backspace leaves it, or else to the row below, or the
	// button that adds a line.
	function removeRow(index: number) {
		const row = rows[index];
		if (row === undefined) {
			return;
		}
		const above = rows[index - 1];
		const below = rows[index + 1];
		commit(
			{ type: 'removeRow', list: name, rowId: row.id },
			describeRowRemoval(rows, index, naming)
		);
		if (above !== undefined) {
			focusField(ids.row(above.id), 'end');
		} else if (below !== undefined) {
			focusField(ids.row(below.id), 'start');
		} else {
			document.getElementById(ids.addItem)?.focus();
		}
	}

	// The menu gives focus back to its trigger, which stays mounted as its row moves.
	function moveRow(row: RecipeFormRow, index: number, toIndex: number) {
		commit(
			{ type: 'moveRow', list: name, rowId: row.id, toIndex },
			describeRowMove(rows, index, toIndex, naming)
		);
		document.getElementById(ids.rowActions(row.id))?.scrollIntoView({ block: 'nearest' });
	}

	function changeKind(row: RecipeFormRow, index: number) {
		commit(
			{
				type: 'setRowKind',
				list: name,
				rowId: row.id,
				kind: row.kind === 'heading' ? 'item' : 'heading',
			},
			describeKindChange(rows, index, naming)
		);
	}

	// Plain Enter adds a line below, wherever the caret is; Shift+Enter keeps its line break. A held
	// Backspace stops at the line it empties, so clearing one never eats into the rows above, and the
	// only row stays to type in.
	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>, index: number) {
		if (rowUndo.handleKeyDown(event)) {
			return;
		}
		const row = rows[index];
		if (
			row === undefined ||
			event.nativeEvent.isComposing ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		) {
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			addRow('item', index);
		} else if (event.key === 'Backspace' && !event.repeat && row.text === '' && rows.length > 1) {
			event.preventDefault();
			removeRow(index);
		}
	}

	// A single line pastes as usual, at the caret.
	function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>, row: RecipeFormRow) {
		const pasted = rowsFromPastedText(event.clipboardData.getData('text/plain'));
		if (pasted.length < 2) {
			return;
		}
		event.preventDefault();
		const { value, selectionStart, selectionEnd } = event.currentTarget;
		commit(
			{
				type: 'pasteRows',
				list: name,
				rowId: row.id,
				text: `${value.slice(0, selectionStart)}${value.slice(selectionEnd)}`,
				rows: pasted,
			},
			describePaste(pasted, noun)
		);
		focusField(ids.row(nextId + pasted.length - 1), 'end');
	}

	function rowActions(row: RecipeFormRow, index: number): ItemAction[] {
		return [
			{
				label: 'Move up',
				icon: ArrowUpIcon,
				onSelect: index > 0 ? () => moveRow(row, index, index - 1) : undefined,
			},
			{
				label: 'Move down',
				icon: ArrowDownIcon,
				onSelect: index < rows.length - 1 ? () => moveRow(row, index, index + 1) : undefined,
			},
			row.kind === 'heading'
				? { label: `Change to ${noun}`, icon: TextIcon, onSelect: () => changeKind(row, index) }
				: { label: 'Change to heading', icon: HeadingIcon, onSelect: () => changeKind(row, index) },
		];
	}

	function renderRow(row: RecipeFormRow, index: number) {
		const rowNames = names[index];
		if (rowNames === undefined) {
			return null;
		}
		const { label, number, headingName } = rowNames;
		const isHeading = row.kind === 'heading';
		const preview = isHeading ? undefined : itemPreview?.(row.text);
		const hasPreview = preview !== undefined;
		const note = noteFor?.({ kind: 'row', id: row.id });
		// A heading shows the problems with its section too, about the lines under it.
		const sectionError = isHeading ? row.sectionError : undefined;
		const sectionNote = isHeading ? noteFor?.({ kind: 'section', id: row.id }) : undefined;
		const invalid = row.error !== undefined || sectionError !== undefined;

		return (
			<li
				key={row.id}
				// Space above a heading sets its lines apart from the ones before it.
				className={cn('flex items-start gap-2', isHeading && index > 0 && 'mt-4')}
			>
				{numbered && !isHeading && (
					// Shares the textarea's border, padding, and type size, so it sits on the first line.
					<span
						aria-hidden="true"
						className="mt-px w-8 shrink-0 py-2 text-right font-mono text-base text-muted-foreground tabular-nums md:text-sm"
					>
						{number}.
					</span>
				)}
				<Field data-invalid={invalid ? 'true' : undefined}>
					<FieldLabel htmlFor={ids.row(row.id)} className="sr-only">
						{label}
					</FieldLabel>
					<Textarea
						id={ids.row(row.id)}
						size="compact"
						rows={1}
						value={row.text}
						placeholder={isHeading ? headingPlaceholder : itemPlaceholder}
						// The heading's weight is for what is typed; its placeholder reads as every other one.
						className={cn(isHeading && 'font-semibold placeholder:font-normal md:text-base')}
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy(
							hasPreview && ids.rowPreview(row.id),
							row.error !== undefined && ids.rowError(row.id),
							sectionError !== undefined && ids.sectionError(row.id),
							note !== undefined && fieldNoteMessageId(ids.rowNote(row.id)),
							sectionNote !== undefined && fieldNoteMessageId(ids.sectionNote(row.id))
						)}
						onChange={(event) =>
							rowUndo.setTypedValue(ids.row(row.id), event.target.value, event.nativeEvent)
						}
						onKeyDown={(event) => handleKeyDown(event, index)}
						onPaste={(event) => handlePaste(event, row)}
					/>
					{hasPreview && <FieldDescription id={ids.rowPreview(row.id)}>{preview}</FieldDescription>}
					{row.error !== undefined && (
						<FieldProblem id={ids.rowError(row.id)}>{row.error}</FieldProblem>
					)}
					{sectionError !== undefined && (
						<FieldProblem id={ids.sectionError(row.id)}>{sectionError}</FieldProblem>
					)}
					{note !== undefined && <FieldNote id={ids.rowNote(row.id)} name={label} {...note} />}
					{sectionNote !== undefined && headingName !== undefined && (
						<FieldNote
							id={ids.sectionNote(row.id)}
							name={sectionLabel(legend, headingName)}
							{...sectionNote}
						/>
					)}
				</Field>
				<ItemActionsMenu
					triggerId={ids.rowActions(row.id)}
					itemLabel={label}
					actions={rowActions(row, index)}
					onRemove={() => removeRow(index)}
				/>
			</li>
		);
	}

	const listNote = noteFor?.({ kind: 'list', list: name });

	return (
		<FieldSet
			aria-describedby={describedBy(
				ids.description,
				list.error !== undefined && ids.error,
				listNote !== undefined && fieldNoteMessageId(ids.note)
			)}
		>
			<FieldLegend>{legend}</FieldLegend>
			<FieldDescription id={ids.description}>{description}</FieldDescription>
			{list.error !== undefined && (
				// Takes focus after a failed save in place of a field.
				<FieldProblem id={ids.error} tabIndex={-1}>
					{list.error}
				</FieldProblem>
			)}
			{listNote !== undefined && <FieldNote id={ids.note} name={legend} {...listNote} />}
			<div className="flex flex-col gap-3">
				{rows.length > 0 && (
					<ul role="list" aria-label={legend} className="flex flex-col gap-2">
						{rows.map((row, index) => renderRow(row, index))}
					</ul>
				)}
				<div className="flex flex-wrap gap-2">
					<Button
						id={ids.addItem}
						type="button"
						variant="outline"
						size="sm"
						onClick={() => addRow('item')}
					>
						<PlusIcon data-icon="inline-start" aria-hidden="true" />
						Add {noun}
					</Button>
					<Button
						id={ids.addHeading}
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => addRow('heading')}
					>
						<PlusIcon data-icon="inline-start" aria-hidden="true" />
						Add heading<span className="sr-only"> to {legend.toLowerCase()}</span>
					</Button>
				</div>
			</div>
			<LiveAnnouncer announcement={announcement} />
		</FieldSet>
	);
}

export { SectionedListField, sectionedListFieldIds };
