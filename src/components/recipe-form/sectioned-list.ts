import type { RecipeFormRowText } from '@/components/recipe-form/recipe-form-values';
import { withoutListMarkers } from '@/domain/recipe/list-markers';
import { sentenceCase } from '@/domain/text';

// Labels, pasted lists, and announcements for the form's lists of ingredients and steps, each one
// flat list of rows: lines, and headings over the lines after them. Photo fields announce their
// moves the same way.

// What the form calls a row, and where it sits.
export type ListRowNames = {
	// Unique in the form: "Ingredient 2", "Step 1, For the glaze", or "Step heading 2".
	label: string;
	// A line's number among the lines since the heading above it, as steps show it; a heading's
	// number among the list's headings.
	number: number;
	// The heading over a line, or a heading's own: its text, or its number where it has none. A line
	// before any heading has none.
	headingName?: string;
};

// Longer text is cut, so an announcement stays short.
const maxItemNameLength = 40;

// Such as "3 ingredients" or "1 heading".
function counted(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// Numbers restart after each heading, so a line under one names the heading too, which keeps every
// label unique: "Step 2, For the glaze".
export function listRowNames(rows: readonly RecipeFormRowText[], noun: string): ListRowNames[] {
	let headings = 0;
	let lines = 0;
	let headingName: string | undefined;
	return rows.map((row) => {
		if (row.kind === 'heading') {
			headings += 1;
			lines = 0;
			const text = row.text.trim();
			headingName = text === '' ? `heading ${headings}` : text;
			return { label: `${sentenceCase(noun)} heading ${headings}`, number: headings, headingName };
		}
		lines += 1;
		const label = `${sentenceCase(noun)} ${lines}`;
		return {
			label: headingName === undefined ? label : `${label}, ${headingName}`,
			number: lines,
			headingName,
		};
	});
}

// What the form calls the lines under a heading together, such as "Ingredients, For the glaze".
export function sectionLabel(legend: string, headingName: string): string {
	return `${legend}, ${headingName}`;
}

// The lines in the row's group: the lines since the heading above it, or for a heading, under it.
function groupLineCount(
	rows: readonly RecipeFormRowText[],
	names: readonly ListRowNames[],
	index: number
): number {
	let last = index;
	while (rows[last + 1]?.kind === 'item') {
		last += 1;
	}
	return rows[last]?.kind === 'item' ? (names[last]?.number ?? 0) : 0;
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

// Moving within one list names both positions.
export function describePositionMove(
	name: string,
	fromIndex: number,
	toIndex: number,
	count: number
): string {
	return `Moved ${name} from position ${fromIndex + 1} to ${toIndex + 1} of ${count}.`;
}

// A move up or down one row, which trades places with the row at toIndex. A line that stays under
// its heading names both positions, and one that crosses a heading names where it went; a heading
// says how many lines are under it now.
export function describeRowMove(
	rows: readonly RecipeFormRowText[],
	fromIndex: number,
	toIndex: number,
	noun: string
): string {
	const row = rows[fromIndex];
	const neighbor = rows[toIndex];
	if (row === undefined || neighbor === undefined) {
		return '';
	}
	const moved = rows.toSpliced(fromIndex, 1).toSpliced(toIndex, 0, row);
	const names = listRowNames(moved, noun);
	const count = groupLineCount(moved, names, toIndex);
	if (row.kind === 'heading') {
		const under = count === 0 ? `no ${noun}s` : counted(count, noun);
		const direction = toIndex < fromIndex ? 'up' : 'down';
		return `Moved ${itemName(row.text, 'heading')} ${direction}, with ${under} under it.`;
	}

	const name = itemName(row.text, noun);
	const position = names[toIndex]?.number ?? 0;
	if (neighbor.kind === 'item') {
		const from = listRowNames(rows, noun)[fromIndex]?.number ?? 0;
		return describePositionMove(name, from - 1, position - 1, count);
	}
	// Moving up past the first heading leaves the line above it, under no heading.
	const headingName = names[toIndex]?.headingName;
	const where =
		headingName === undefined ? `above ${names[toIndex + 1]?.headingName}` : `to ${headingName}`;
	return `Moved ${name} ${where}, position ${position} of ${count}.`;
}

// Said as a row is added, once it is in the rows.
export function describeRowAdded(
	rows: readonly RecipeFormRowText[],
	index: number,
	noun: string
): string {
	const label = listRowNames(rows, noun)[index]?.label;
	return label === undefined ? '' : `Added ${label}.`;
}

// A heading's lines stay as it goes, joining the lines above, so its removal says so.
export function describeRowRemoval(
	rows: readonly RecipeFormRowText[],
	index: number,
	noun: string
): string {
	const names = listRowNames(rows, noun);
	const label = names[index]?.label;
	if (label === undefined) {
		return '';
	}
	const count = rows[index]?.kind === 'heading' ? groupLineCount(rows, names, index) : 0;
	if (count === 0) {
		return `Removed ${label}.`;
	}
	const stay = count === 1 ? `The ${noun} under it stays.` : `The ${count} ${noun}s under it stay.`;
	return `Removed ${label}. ${stay}`;
}

// Said as a row becomes a heading or a line, with what it is called now.
export function describeKindChange(
	rows: readonly RecipeFormRowText[],
	index: number,
	noun: string
): string {
	const row = rows[index];
	if (row === undefined) {
		return '';
	}
	const kind = row.kind === 'heading' ? 'item' : 'heading';
	const label = listRowNames(rows.with(index, { kind, text: row.text }), noun)[index]?.label;
	return `Changed ${itemName(row.text, row.kind === 'heading' ? 'heading' : noun)} to ${label}.`;
}

// Said as a pasted list arrives, counting what it held: "Pasted 6 ingredients and 2 headings."
export function describePaste(rows: readonly RecipeFormRowText[], noun: string): string {
	const headings = rows.filter((row) => row.kind === 'heading').length;
	const parts = [
		rows.length > headings && counted(rows.length - headings, noun),
		headings > 0 && counted(headings, 'heading'),
	].filter((part) => typeof part === 'string');
	return `Pasted ${parts.join(' and ')}.`;
}

// The rows a pasted list makes: one for each line with words, without its bullet or step number,
// and a heading for each line ending in a colon, as in "For the glaze:".
export function rowsFromPastedText(text: string): RecipeFormRowText[] {
	return text.split(/\r\n|\r|\n/u).flatMap((line): RecipeFormRowText[] => {
		const words = withoutListMarkers(line).trim();
		if (!words.endsWith(':')) {
			return words === '' ? [] : [{ kind: 'item', text: words }];
		}
		const heading = words.replace(/:+$/u, '').trim();
		return heading === '' ? [] : [{ kind: 'heading', text: heading }];
	});
}
