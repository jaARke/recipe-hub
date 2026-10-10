'use client';

import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SectionSeed = {
	heading?: string;
	items: readonly string[];
};

type ListItem = {
	id: number;
	text: string;
};

type ListSection = {
	id: number;
	heading: string;
	items: readonly ListItem[];
};

type SectionedList = {
	sections: readonly ListSection[];
	// Sections and items draw from one counter, so every id is unique within the list.
	nextId: number;
};

type SampleSectionedListProps = {
	legend: string;
	description: string;
	// Singular and capitalized, such as "Ingredient"; it names each field and button.
	itemName: string;
	itemPlaceholder: string;
	headingPlaceholder: string;
	ordered?: boolean;
	initialSections: readonly SectionSeed[];
};

function createSectionedList(seeds: readonly SectionSeed[]): SectionedList {
	let nextId = 0;
	const sections = seeds.map((seed) => ({
		id: nextId++,
		heading: seed.heading ?? '',
		items: seed.items.map((text) => ({ id: nextId++, text })),
	}));

	return { sections, nextId };
}

// Numbering runs on across sections, so every field's name is unique.
function numberSections(sections: readonly ListSection[]) {
	let itemCount = 0;

	return sections.map((section) => {
		const firstNumber = itemCount + 1;
		itemCount += section.items.length;
		return { section, firstNumber };
	});
}

function updateSection(
	sections: readonly ListSection[],
	sectionId: number,
	update: (section: ListSection) => ListSection
) {
	return sections.map((section) => (section.id === sectionId ? update(section) : section));
}

function focusElement(id: string) {
	document.getElementById(id)?.focus();
}

// Local state stands in for the form library the real recipe form will use.
function SampleSectionedList({
	legend,
	description,
	itemName,
	itemPlaceholder,
	headingPlaceholder,
	ordered = false,
	initialSections,
}: SampleSectionedListProps) {
	const baseId = useId();
	const [list, setList] = useState(() => createSectionedList(initialSections));
	const itemNoun = itemName.toLowerCase();
	const ItemList = ordered ? 'ol' : 'ul';
	const ids = {
		description: `${baseId}-description`,
		addSection: `${baseId}-add-section`,
		item: (itemId: number) => `${baseId}-item-${itemId}`,
		heading: (sectionId: number) => `${baseId}-heading-${sectionId}`,
		addItem: (sectionId: number) => `${baseId}-add-${sectionId}`,
	};

	// Structural changes commit synchronously so focus can move to what they render.
	function commit(next: SectionedList) {
		flushSync(() => setList(next));
	}

	function changeItem(sectionId: number, itemId: number, text: string) {
		setList({
			...list,
			sections: updateSection(list.sections, sectionId, (section) => ({
				...section,
				items: section.items.map((item) => (item.id === itemId ? { ...item, text } : item)),
			})),
		});
	}

	function changeHeading(sectionId: number, heading: string) {
		setList({
			...list,
			sections: updateSection(list.sections, sectionId, (section) => ({ ...section, heading })),
		});
	}

	function addItem(sectionId: number) {
		const item = { id: list.nextId, text: '' };
		commit({
			nextId: list.nextId + 1,
			sections: updateSection(list.sections, sectionId, (section) => ({
				...section,
				items: [...section.items, item],
			})),
		});
		focusElement(ids.item(item.id));
	}

	function removeItem(section: ListSection, itemIndex: number) {
		const neighbor = section.items[itemIndex - 1] ?? section.items[itemIndex + 1];
		commit({
			...list,
			sections: updateSection(list.sections, section.id, (current) => ({
				...current,
				items: current.items.filter((_, index) => index !== itemIndex),
			})),
		});
		focusElement(neighbor ? ids.item(neighbor.id) : ids.addItem(section.id));
	}

	function addSection() {
		const section = { id: list.nextId, heading: '', items: [{ id: list.nextId + 1, text: '' }] };
		commit({ nextId: list.nextId + 2, sections: [...list.sections, section] });
		focusElement(ids.heading(section.id));
	}

	function removeSection(sectionIndex: number) {
		const previous = list.sections[sectionIndex - 1];
		commit({ ...list, sections: list.sections.filter((_, index) => index !== sectionIndex) });
		focusElement(previous ? ids.addItem(previous.id) : ids.addSection);
	}

	function renderItems(section: ListSection, firstNumber: number) {
		return (
			section.items.length > 0 && (
				<ItemList className="flex flex-col gap-2">
					{section.items.map((item, itemIndex) => {
						const number = firstNumber + itemIndex;

						return (
							<li key={item.id} className="flex items-start gap-2">
								{ordered && (
									// Shares the textarea's border, padding, and type size, so it sits on the first line.
									<span
										aria-hidden="true"
										className="mt-px w-8 shrink-0 py-2 text-right font-mono text-base text-muted-foreground tabular-nums md:text-sm"
									>
										{number}.
									</span>
								)}
								<Label htmlFor={ids.item(item.id)} className="sr-only">
									{itemName} {number}
								</Label>
								<Textarea
									id={ids.item(item.id)}
									rows={1}
									value={item.text}
									placeholder={itemPlaceholder}
									className="min-h-0"
									onChange={(event) => changeItem(section.id, item.id, event.target.value)}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={`Remove ${itemNoun} ${number}`}
									onClick={() => removeItem(section, itemIndex)}
								>
									<XIcon aria-hidden="true" />
								</Button>
							</li>
						);
					})}
				</ItemList>
			)
		);
	}

	function renderAddItem(section: ListSection) {
		return (
			<Button
				id={ids.addItem(section.id)}
				type="button"
				variant="outline"
				size="sm"
				className="self-start"
				onClick={() => addItem(section.id)}
			>
				<PlusIcon data-icon="inline-start" aria-hidden="true" />
				Add {itemNoun}
			</Button>
		);
	}

	return (
		<FieldSet aria-describedby={ids.description}>
			<FieldLegend>{legend}</FieldLegend>
			<FieldDescription id={ids.description}>{description}</FieldDescription>
			{numberSections(list.sections).map(({ section, firstNumber }, sectionIndex) => {
				// The first section is the recipe's main list and carries no heading.
				if (sectionIndex === 0) {
					return (
						<div key={section.id} className="flex flex-col gap-3">
							{renderItems(section, firstNumber)}
							{renderAddItem(section)}
						</div>
					);
				}

				return (
					<FieldSet key={section.id} className="gap-4 rounded-xl border p-4">
						<FieldLegend className="sr-only">Section {sectionIndex + 1}</FieldLegend>
						<Field>
							<FieldLabel htmlFor={ids.heading(section.id)}>Section heading</FieldLabel>
							<Input
								id={ids.heading(section.id)}
								value={section.heading}
								placeholder={headingPlaceholder}
								onChange={(event) => changeHeading(section.id, event.target.value)}
							/>
						</Field>
						{renderItems(section, firstNumber)}
						<div className="flex flex-wrap items-center justify-between gap-2">
							{renderAddItem(section)}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => removeSection(sectionIndex)}
							>
								<Trash2Icon data-icon="inline-start" aria-hidden="true" />
								Remove section<span className="sr-only"> {sectionIndex + 1}</span>
							</Button>
						</div>
					</FieldSet>
				);
			})}
			<Button
				id={ids.addSection}
				type="button"
				variant="ghost"
				size="sm"
				className="self-start"
				onClick={addSection}
			>
				<PlusIcon data-icon="inline-start" aria-hidden="true" />
				Add section
			</Button>
		</FieldSet>
	);
}

export { SampleSectionedList };
