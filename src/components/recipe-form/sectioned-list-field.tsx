'use client';

import {
	ArrowDownIcon,
	ArrowUpIcon,
	CornerDownRightIcon,
	PlusIcon,
	Trash2Icon,
	type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { describedBy } from '@/components/forms/described-by';
import { FieldProblem, type ProblemCheck } from '@/components/forms/problem-summary';
import { ItemActionsMenu } from '@/components/recipe-form/item-actions-menu';
import {
	sectionsShowHeadings,
	type ProblemTarget,
	type RecipeFormEdit,
	type RecipeFormItem,
	type RecipeFormList,
	type RecipeFormListName,
	type RecipeFormSection,
} from '@/components/recipe-form/recipe-form-values';
import {
	describeMove,
	itemLabel,
	itemMoves,
	sectionName,
	type ItemMoveKind,
	type ItemPlace,
} from '@/components/recipe-form/sectioned-list';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const moveIcons: Record<ItemMoveKind, LucideIcon> = {
	up: ArrowUpIcon,
	down: ArrowDownIcon,
	section: CornerDownRightIcon,
};

type SectionedListFieldProps = {
	// Starts every id in the field, so the form can link to its problems.
	idPrefix: string;
	name: RecipeFormListName;
	list: RecipeFormList;
	// The id the form gives the next section or item it adds.
	nextId: number;
	dispatch: React.Dispatch<RecipeFormEdit>;
	legend: string;
	description: string;
	// Lowercase and singular, such as "ingredient"; it names each field and button.
	noun: string;
	itemPlaceholder: string;
	headingPlaceholder: string;
	// Steps are numbered, restarting in each section as on the recipe page.
	numbered?: boolean;
	// Shown under an item's field and read with it, such as how an ingredient reads on the recipe
	// page; nothing shows where it returns undefined.
	itemPreview?: (text: string) => React.ReactNode;
	// Each problem's check while the member reviews a draft, and none otherwise.
	problemCheck?: (target: ProblemTarget) => ProblemCheck | undefined;
};

// The ids of the field's parts, which the form's problem summary links to.
function sectionedListFieldIds(prefix: string) {
	return {
		description: `${prefix}-description`,
		error: `${prefix}-error`,
		addSection: `${prefix}-add-section`,
		item: (itemId: number) => `${prefix}-item-${itemId}`,
		itemPreview: (itemId: number) => `${prefix}-item-${itemId}-preview`,
		itemError: (itemId: number) => `${prefix}-item-${itemId}-error`,
		itemActions: (itemId: number) => `${prefix}-item-${itemId}-actions`,
		heading: (sectionId: number) => `${prefix}-heading-${sectionId}`,
		headingDescription: (sectionId: number) => `${prefix}-heading-${sectionId}-description`,
		headingError: (sectionId: number) => `${prefix}-heading-${sectionId}-error`,
		sectionError: (sectionId: number) => `${prefix}-section-${sectionId}-error`,
		addItem: (sectionId: number) => `${prefix}-add-${sectionId}`,
	};
}

function focusElement(id: string) {
	document.getElementById(id)?.focus();
}

// A list of growing fields in sections, such as a recipe's ingredients. Each item's menu moves or
// removes it, and a section can have a heading.
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
	problemCheck,
}: SectionedListFieldProps) {
	const [announcement, setAnnouncement] = React.useState('');
	const { sections, showsHeadings } = list;
	const ItemList = numbered ? 'ol' : 'ul';
	const ids = sectionedListFieldIds(idPrefix);

	// Structural edits commit at once, so focus can move to what they render.
	function commit(edit: RecipeFormEdit) {
		flushSync(() => dispatch(edit));
	}

	function addItem(section: RecipeFormSection) {
		commit({ type: 'addItem', list: name, sectionId: section.id });
		focusElement(ids.item(nextId));
	}

	function removeItem(section: RecipeFormSection, itemIndex: number) {
		const neighbor = section.items[itemIndex - 1] ?? section.items[itemIndex + 1];
		const item = section.items[itemIndex];
		if (item === undefined) {
			return;
		}
		commit({ type: 'removeItem', list: name, itemId: item.id });
		focusElement(neighbor === undefined ? ids.addItem(section.id) : ids.item(neighbor.id));
	}

	function moveItem(item: RecipeFormItem, from: ItemPlace, to: ItemPlace) {
		flushSync(() => {
			dispatch({ type: 'moveItem', list: name, itemId: item.id, to });
			setAnnouncement(describeMove(sections, from, to, noun));
		});
		const trigger = document.getElementById(ids.itemActions(item.id));
		// The menu gives focus back to its trigger after a move within a section, but a move to
		// another section mounts the row anew.
		if (from.sectionIndex !== to.sectionIndex) {
			trigger?.focus();
		}
		trigger?.scrollIntoView({ block: 'nearest' });
	}

	function addSection() {
		commit({ type: 'addSection', list: name });
		focusElement(ids.heading(nextId));
	}

	function removeSection(sectionIndex: number) {
		const section = sections[sectionIndex];
		if (section === undefined) {
			return;
		}
		const previous = sections[sectionIndex - 1];
		const next = sections[sectionIndex + 1];
		const headingsStay = sectionsShowHeadings(sections.toSpliced(sectionIndex, 1));
		commit({ type: 'removeSection', list: name, sectionId: section.id });
		if (previous !== undefined) {
			focusElement(ids.addItem(previous.id));
		} else if (next !== undefined && headingsStay) {
			focusElement(ids.heading(next.id));
		} else if (next !== undefined) {
			// Without headings, the section left starts with its first item, or its add button.
			const [firstItem] = next.items;
			focusElement(firstItem === undefined ? ids.addItem(next.id) : ids.item(firstItem.id));
		}
	}

	function renderItem(section: RecipeFormSection, sectionIndex: number, itemIndex: number) {
		const item = section.items[itemIndex];
		if (item === undefined) {
			return null;
		}
		const place = { sectionIndex, itemIndex };
		const label = itemLabel(noun, sections, place, showsHeadings);
		const preview = itemPreview?.(item.text);
		const hasPreview = preview !== undefined;
		const invalid = item.error !== undefined;
		const actions = itemMoves(sections, place).map(({ kind, label: moveLabel, to }) => ({
			label: moveLabel,
			icon: moveIcons[kind],
			onSelect: to && (() => moveItem(item, place, to)),
		}));

		return (
			<li key={item.id} className="flex items-start gap-2">
				{numbered && (
					// Shares the textarea's border, padding, and type size, so it sits on the first line.
					<span
						aria-hidden="true"
						className="mt-px w-8 shrink-0 py-2 text-right font-mono text-base text-muted-foreground tabular-nums md:text-sm"
					>
						{itemIndex + 1}.
					</span>
				)}
				<Field data-invalid={invalid ? 'true' : undefined}>
					<FieldLabel htmlFor={ids.item(item.id)} className="sr-only">
						{label}
					</FieldLabel>
					<Textarea
						id={ids.item(item.id)}
						size="compact"
						rows={1}
						value={item.text}
						placeholder={itemPlaceholder}
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy(
							hasPreview && ids.itemPreview(item.id),
							invalid && ids.itemError(item.id)
						)}
						onChange={(event) =>
							dispatch({
								type: 'setItemText',
								list: name,
								itemId: item.id,
								text: event.target.value,
							})
						}
					/>
					{hasPreview && (
						<FieldDescription id={ids.itemPreview(item.id)}>{preview}</FieldDescription>
					)}
					{invalid && (
						<FieldProblem
							id={ids.itemError(item.id)}
							check={problemCheck?.({ kind: 'item', id: item.id })}
						>
							{item.error}
						</FieldProblem>
					)}
				</Field>
				<ItemActionsMenu
					triggerId={ids.itemActions(item.id)}
					itemLabel={label}
					actions={actions}
					onRemove={() => removeItem(section, itemIndex)}
				/>
			</li>
		);
	}

	function renderSectionBody(section: RecipeFormSection, sectionIndex: number) {
		return (
			<>
				{section.items.length > 0 && (
					<ItemList className="flex flex-col gap-2">
						{section.items.map((_item, itemIndex) => renderItem(section, sectionIndex, itemIndex))}
					</ItemList>
				)}
				{section.error !== undefined && (
					// Takes focus after a failed save in place of a field.
					<FieldProblem
						id={ids.sectionError(section.id)}
						tabIndex={-1}
						check={problemCheck?.({ kind: 'section', id: section.id })}
					>
						{section.error}
					</FieldProblem>
				)}
			</>
		);
	}

	function renderAddItem(section: RecipeFormSection, sectionIndex: number) {
		return (
			<Button
				id={ids.addItem(section.id)}
				type="button"
				variant="outline"
				size="sm"
				className="self-start"
				onClick={() => addItem(section)}
			>
				<PlusIcon data-icon="inline-start" aria-hidden="true" />
				Add {noun}
				{showsHeadings && (
					<span className="sr-only"> to {sectionName(sections, sectionIndex)}</span>
				)}
			</Button>
		);
	}

	function renderHeadedSection(section: RecipeFormSection, sectionIndex: number) {
		const headingInvalid = section.headingError !== undefined;
		// Only the first section can hold items that come before any heading.
		const headingHint = sectionIndex === 0;

		return (
			<FieldSet
				key={section.id}
				aria-describedby={section.error === undefined ? undefined : ids.sectionError(section.id)}
				className="gap-4 rounded-xl border p-4"
			>
				<FieldLegend className="sr-only">Section {sectionIndex + 1}</FieldLegend>
				<Field data-invalid={headingInvalid ? 'true' : undefined}>
					<FieldLabel htmlFor={ids.heading(section.id)}>Heading (optional)</FieldLabel>
					<Input
						id={ids.heading(section.id)}
						value={section.heading}
						placeholder={headingPlaceholder}
						aria-invalid={headingInvalid ? 'true' : undefined}
						aria-describedby={describedBy(
							headingHint && ids.headingDescription(section.id),
							headingInvalid && ids.headingError(section.id)
						)}
						onChange={(event) =>
							dispatch({
								type: 'setHeading',
								list: name,
								sectionId: section.id,
								heading: event.target.value,
							})
						}
					/>
					{headingHint && (
						<FieldDescription id={ids.headingDescription(section.id)}>
							Leave blank for {legend.toLowerCase()} that come before any section.
						</FieldDescription>
					)}
					{headingInvalid && (
						<FieldProblem
							id={ids.headingError(section.id)}
							check={problemCheck?.({ kind: 'heading', id: section.id })}
						>
							{section.headingError}
						</FieldProblem>
					)}
				</Field>
				{renderSectionBody(section, sectionIndex)}
				<div className="flex flex-wrap items-center justify-between gap-2">
					{renderAddItem(section, sectionIndex)}
					{sections.length > 1 && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => removeSection(sectionIndex)}
						>
							<Trash2Icon data-icon="inline-start" aria-hidden="true" />
							Remove section<span className="sr-only"> {sectionIndex + 1}</span>
						</Button>
					)}
				</div>
			</FieldSet>
		);
	}

	// Without headings the list has one section, whose problems describe the whole list.
	const [onlySection] = sections;
	const onlySectionError =
		!showsHeadings && onlySection?.error !== undefined && ids.sectionError(onlySection.id);

	return (
		<FieldSet
			aria-describedby={describedBy(
				ids.description,
				list.error !== undefined && ids.error,
				onlySectionError
			)}
		>
			<FieldLegend>{legend}</FieldLegend>
			<FieldDescription id={ids.description}>{description}</FieldDescription>
			{list.error !== undefined && (
				// Takes focus after a failed save in place of a field.
				<FieldProblem
					id={ids.error}
					tabIndex={-1}
					check={problemCheck?.({ kind: 'list', list: name })}
				>
					{list.error}
				</FieldProblem>
			)}
			{showsHeadings
				? sections.map((section, sectionIndex) => renderHeadedSection(section, sectionIndex))
				: onlySection !== undefined && (
						<div className="flex flex-col gap-3">
							{renderSectionBody(onlySection, 0)}
							{renderAddItem(onlySection, 0)}
						</div>
					)}
			<Button
				id={ids.addSection}
				type="button"
				variant="ghost"
				size="sm"
				className="self-start"
				onClick={addSection}
			>
				<PlusIcon data-icon="inline-start" aria-hidden="true" />
				Add section<span className="sr-only"> to {legend.toLowerCase()}</span>
			</Button>
			<p role="status" aria-live="polite" className="sr-only">
				{announcement}
			</p>
		</FieldSet>
	);
}

export { SectionedListField, sectionedListFieldIds };
