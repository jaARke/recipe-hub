// Labels, moves, and announcements for the form's sectioned lists of ingredients and steps.

type ListSectionText = {
	heading: string;
	items: readonly { text: string }[];
};

// Where an item sits: its section, then its place in that section.
export type ItemPlace = {
	sectionIndex: number;
	itemIndex: number;
};

export type ItemMoveKind = 'up' | 'down' | 'section';

// A move an item's menu offers. Without a destination it shows but can't be chosen, as Move up
// can't at the top of a section.
export type ItemMove = {
	kind: ItemMoveKind;
	label: string;
	to: ItemPlace | undefined;
};

// Longer text is cut, so an announcement stays short.
const maxItemNameLength = 40;

function capitalized(text: string): string {
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

// The section's heading, or its number where it has none.
export function sectionName(sections: readonly ListSectionText[], sectionIndex: number): string {
	const heading = sections[sectionIndex]?.heading.trim() ?? '';
	return heading === '' ? `section ${sectionIndex + 1}` : heading;
}

// Numbers restart in each section, so a list with sections names the section too, which keeps
// every label unique: "Step 2, For the glaze".
export function itemLabel(
	noun: string,
	sections: readonly ListSectionText[],
	{ sectionIndex, itemIndex }: ItemPlace,
	withSection: boolean
): string {
	const label = `${capitalized(noun)} ${itemIndex + 1}`;
	return withSection ? `${label}, ${sectionName(sections, sectionIndex)}` : label;
}

// The item's own words when it has any, so consecutive moves never repeat an announcement.
export function itemName(text: string, noun: string): string {
	const words = text.trim();
	if (words === '') {
		return noun;
	}
	return words.length > maxItemNameLength
		? `“${words.slice(0, maxItemNameLength).trimEnd()}…”`
		: `“${words}”`;
}

// Moving within a section names both positions; moving to another section names the section.
export function describeMove(
	sections: readonly ListSectionText[],
	from: ItemPlace,
	to: ItemPlace,
	noun: string
): string {
	const name = itemName(sections[from.sectionIndex]?.items[from.itemIndex]?.text ?? '', noun);
	if (from.sectionIndex === to.sectionIndex) {
		const count = sections[from.sectionIndex]?.items.length ?? 0;
		return `Moved ${name} from position ${from.itemIndex + 1} to ${to.itemIndex + 1} of ${count}.`;
	}

	const count = (sections[to.sectionIndex]?.items.length ?? 0) + 1;
	return `Moved ${name} to ${sectionName(sections, to.sectionIndex)}, position ${to.itemIndex + 1} of ${count}.`;
}

// Up and down within the item's section, then the end of each other section.
export function itemMoves(
	sections: readonly ListSectionText[],
	{ sectionIndex, itemIndex }: ItemPlace
): ItemMove[] {
	const lastIndex = (sections[sectionIndex]?.items.length ?? 0) - 1;
	const moves: ItemMove[] = [
		{
			kind: 'up',
			label: 'Move up',
			to: itemIndex > 0 ? { sectionIndex, itemIndex: itemIndex - 1 } : undefined,
		},
		{
			kind: 'down',
			label: 'Move down',
			to: itemIndex < lastIndex ? { sectionIndex, itemIndex: itemIndex + 1 } : undefined,
		},
	];
	sections.forEach((section, index) => {
		if (index !== sectionIndex) {
			moves.push({
				kind: 'section',
				label: `Move to ${sectionName(sections, index)}`,
				to: { sectionIndex: index, itemIndex: section.items.length },
			});
		}
	});
	return moves;
}
