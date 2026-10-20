import 'server-only';
import { load } from 'cheerio/slim';
import { compile } from 'html-to-text';
import { parse as parseIsoDuration } from 'iso8601-duration';
import type {
	CreativeWork,
	HowToSection,
	HowToStep,
	ItemList,
	ListItem,
	Organization,
	Person,
	PropertyValue,
	QuantitativeValue,
	Recipe,
} from 'schema-dts';
import type { Extraction, PageRecipeExtractor } from '@/application/ports/recipe-extractors';
import type { WebPage } from '@/application/ports/web-page-fetcher';
import { approximationWord } from '@/domain/recipe/amount-words';
import { chapterFromCategories } from '@/domain/recipe/chapter';
import { dietsFromKeywords, dietsFromSchemaOrg, withImpliedDiets } from '@/domain/recipe/diet';
import {
	type ExtractedIngredientSection,
	type ExtractedInstructionSection,
	type ExtractedRecipe,
	type ExtractedYield,
} from '@/domain/recipe/extracted-recipe';
import { holidaysFromKeywords } from '@/domain/recipe/holiday';
import { maxReadLineLength, parseAmountText } from '@/domain/recipe/ingredient-parser';
import { withoutListMarkers } from '@/domain/recipe/list-markers';
import { andList } from '@/domain/text';
import { htmlWhitespaceCharacters, maxHtmlDepth } from '@/infrastructure/web/html-text';

type JsonObject = { readonly [key: string]: unknown };

// A node read through schema-dts's property names. Pages bend schema.org's value types, so every
// value is read as unknown.
type SchemaNode<T> = { readonly [Property in keyof Exclude<T, string>]?: unknown };

// Every node on the page, in document order, and the nodes that others reference by @id.
type JsonLdGraph = {
	nodes: readonly JsonObject[];
	definitions: ReadonlyMap<string, JsonObject>;
};

// One recipe's read through its ingredient and step lists: the lists it is inside, and how many
// elements and characters of text it has read from them all.
type ListWalk = {
	graph: JsonLdGraph;
	inside: Set<JsonObject>;
	elementsRead: number;
	charactersRead: number;
};

// A recipe's ingredients and steps, read in one walk.
type RecipeLists = Pick<ExtractedRecipe, 'ingredientSections' | 'instructionSections'>;

// Text inside JSON-LD strings: entities decoded, tags dropped, and every line break kept, so a list
// written as one string still comes apart into its items.
const stringText = compile({
	wordwrap: false,
	preserveNewlines: true,
	limits: { maxDepth: maxHtmlDepth },
	whitespaceCharacters: htmlWhitespaceCharacters,
	selectors: [
		{ selector: 'a', options: { ignoreHref: true } },
		{ selector: 'img', format: 'skip' },
		{ selector: 'ol', format: 'block' },
		{ selector: 'ul', format: 'block' },
		{ selector: 'li', format: 'block' },
	],
});

// Some sites encode entities twice, so one decoding still leaves one.
const htmlEntity = /&(?:#\d+|#x[\da-f]+|[a-z]+\d*);/i;

// WP Recipe Maker writes each ingredient's note in parentheses the page never shows, so a note that
// opens with a comma or has parentheses of its own reads "onion (, sliced)" or "soda ((optional))".
const doubledGroup = / \(\(([^()]*)\)\)/g;
// A group opening with a comma that ends the line, holding at most one group of its own.
const trailingCommaGroup = / \(, ?((?:[^()]|\([^()]*\))*)\)$/;

// A yield can open with a label: "Serves 4", "Servings: 4", "Makes 12", "Yield: 2 loaves".
const yieldLabel = /^(serves|servings?|makes|yields?)\b\s*:?\s*/i;

// Units that count servings rather than name what a recipe makes: "4 servings", "4 serving(s)".
const servingUnit = /^(?:servings?|serving\(s\)|people|persons?|portions?)(?:\s|$)/i;

// ISO 8601, as schema.org asks for times: "PT1H20M".
const isoDuration = /^P[\dT]/i;

// Times written out, as some sites do instead of ISO 8601: "1 hour 20 minutes".
const writtenDuration = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/gi;

const secondsPerMinute = 60;
const minutesPerHour = 60;
const minutesPerDay = 24 * minutesPerHour;
const minutesPerWeek = 7 * minutesPerDay;

// How deep lists nest in lists, how many elements and lines of text one recipe's lists hold in all,
// and how many characters their text holds before it is decoded, counting a list or a string again
// each time a reference reaches it. Real recipes nest two or three deep and hold a few hundred lines
// and a few thousand characters.
const maxListDepth = 16;
const maxListElements = 2000;
const maxListCharacters = 1_000_000;

// A recipe's lists contain themselves or pass the bounds above, so the page is left to the model.
class UnreadableListsError extends Error {}

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function list(value: unknown): readonly unknown[] {
	if (value === undefined || value === null) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

// Types come bare or prefixed: "Recipe", "schema:Recipe", or "https://schema.org/Recipe".
function hasType(node: JsonObject, type: string): boolean {
	return list(node['@type']).some(
		(written) =>
			typeof written === 'string' &&
			(written === type || written.endsWith(`/${type}`) || written.endsWith(`:${type}`))
	);
}

function isRecipe(node: JsonObject): boolean {
	return hasType(node, 'Recipe');
}

// Pages wrap JSON-LD in comments or CDATA, and leave raw line breaks and trailing commas in it.
function parseJsonLd(source: string): unknown {
	try {
		return JSON.parse(source);
	} catch {
		const repaired = source
			.replace(/^\s*(?:<!--|\/\/\s*<!\[CDATA\[)/, '')
			.replace(/(?:-->|\/\/\s*\]\]>)\s*$/, '')
			.replace(/[\u0000-\u001F]+/g, ' ')
			.replace(/,\s*([}\]])/g, '$1');
		try {
			return JSON.parse(repaired);
		} catch {
			return undefined;
		}
	}
}

// Walked with a stack rather than recursion, so no page nests deeply enough to overflow it.
function graphOf(html: string): JsonLdGraph {
	const $ = load(html);
	const pending = $('script[type="application/ld+json" i]')
		.toArray()
		.map((script) => parseJsonLd($(script).text()))
		.reverse();
	const nodes: JsonObject[] = [];
	const definitions = new Map<string, JsonObject>();
	while (pending.length > 0) {
		const value = pending.pop();
		const children = Array.isArray(value) ? value : isObject(value) ? Object.values(value) : [];
		if (isObject(value)) {
			nodes.push(value);
			const id = value['@id'];
			// A node holding only its @id refers to another.
			if (typeof id === 'string' && Object.keys(value).length > 1 && !definitions.has(id)) {
				definitions.set(id, value);
			}
		}
		for (let index = children.length - 1; index >= 0; index -= 1) {
			pending.push(children[index]);
		}
	}
	return { nodes, definitions };
}

function resolved(value: unknown, graph: JsonLdGraph): unknown {
	if (isObject(value) && typeof value['@id'] === 'string' && Object.keys(value).length === 1) {
		return graph.definitions.get(value['@id']) ?? value;
	}
	return value;
}

// The value's entries with references resolved, each read once however many references reach it.
function distinctEntries(value: unknown, graph: JsonLdGraph): unknown[] {
	return [...new Set(list(value).map((entry) => resolved(entry, graph)))];
}

function decodedText(html: string): string {
	const text = stringText(html);
	return htmlEntity.test(text) ? stringText(text) : text;
}

// The value's lines as text, without blank ones. Within a walk, a string's characters count toward
// its bound before they are decoded, since references can reach one long string thousands of times.
function textLines(value: unknown, walk?: ListWalk): string[] {
	if (typeof value === 'number') {
		return [String(value)];
	}
	if (typeof value !== 'string') {
		return [];
	}
	if (walk !== undefined) {
		walk.charactersRead += value.length;
		if (walk.charactersRead > maxListCharacters) {
			throw new UnreadableListsError();
		}
	}
	return decodedText(value)
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '');
}

// The first value as one line of text, or undefined when there is none.
function singleLine(value: unknown, walk?: ListWalk): string | undefined {
	const text = textLines(list(value)[0], walk).join(' ');
	return text === '' ? undefined : text;
}

function addressOf(value: unknown, page: URL): URL | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	try {
		return new URL(value, page);
	} catch {
		return undefined;
	}
}

// The page a URL names, whatever its scheme, query, or fragment.
function pageKey(address: URL): string {
	return `${address.host}${address.pathname.replace(/\/$/, '')}`;
}

function namesFragment(recipe: SchemaNode<Recipe>, page: URL): boolean {
	return [recipe['@id'], recipe.url].some((value) => addressOf(value, page)?.hash === page.hash);
}

// Every node any node names as its mainEntity, in one pass, so a page of many recipes is not read once
// for each of them.
function mainEntities(graph: JsonLdGraph): Set<unknown> {
	return new Set(
		graph.nodes.flatMap((node) =>
			list((node as SchemaNode<CreativeWork>).mainEntity).map((entity) => resolved(entity, graph))
		)
	);
}

function describesPage(recipe: SchemaNode<Recipe>, page: URL): boolean {
	const address = addressOf(recipe.url, page);
	return address !== undefined && pageKey(address) === pageKey(page);
}

// A page with several recipes names the one it is about in its address's fragment, its mainEntity,
// or the recipe's url.
function mainRecipe(graph: JsonLdGraph, page: URL): JsonObject | undefined {
	const recipes = graph.nodes.filter(isRecipe);
	const main = mainEntities(graph);
	return (
		(page.hash === '' ? undefined : recipes.find((recipe) => namesFragment(recipe, page))) ??
		recipes.find((recipe) => main.has(recipe)) ??
		recipes.find((recipe) => describesPage(recipe, page)) ??
		recipes.find((recipe) => list((recipe as SchemaNode<Recipe>).recipeIngredient).length > 0) ??
		recipes[0]
	);
}

// The elements or lines, each counting toward the walk's bound before any is read.
function counted<Elements extends readonly unknown[]>(
	elements: Elements,
	walk: ListWalk
): Elements {
	walk.elementsRead += elements.length;
	if (walk.elementsRead > maxListElements) {
		throw new UnreadableListsError();
	}
	return elements;
}

// An ItemList's elements in position order, each ListItem unwrapped to its item.
function listElements(itemList: SchemaNode<ItemList>, walk: ListWalk): unknown[] {
	const elements = counted(list(itemList.itemListElement), walk).map((element) =>
		resolved(element, walk.graph)
	);
	const position = (element: unknown) =>
		Number(isObject(element) ? (element as SchemaNode<ListItem>).position : undefined);
	const ordered = elements.every((element) => Number.isFinite(position(element)))
		? elements.toSorted((first, second) => position(first) - position(second))
		: elements;
	return ordered.map((element) =>
		isObject(element) && hasType(element, 'ListItem')
			? (resolved((element as SchemaNode<ListItem>).item, walk.graph) ?? element)
			: element
	);
}

// What `read` makes of each element of a list nested in the walk. A list inside itself, or nested
// past the bound, leaves the recipe's lists unread.
function nestedLines(
	itemList: JsonObject,
	walk: ListWalk,
	read: (element: unknown, walk: ListWalk) => string[]
): string[] {
	if (walk.inside.has(itemList) || walk.inside.size === maxListDepth) {
		throw new UnreadableListsError();
	}
	walk.inside.add(itemList);
	const lines = listElements(itemList, walk).flatMap((element) => read(element, walk));
	walk.inside.delete(itemList);
	return lines;
}

function propertyValueLine(value: SchemaNode<PropertyValue>, walk: ListWalk): string {
	return [value.value, value.unitText, value.name]
		.map((part) => singleLine(part, walk))
		.filter((part) => part !== undefined)
		.join(' ');
}

function ingredientLines(value: unknown, walk: ListWalk): string[] {
	const item = resolved(value, walk.graph);
	if (!isObject(item)) {
		return counted(textLines(item, walk), walk);
	}
	if (hasType(item, 'ItemList')) {
		return nestedLines(item, walk, ingredientLines);
	}
	if (hasType(item, 'PropertyValue')) {
		return [propertyValueLine(item, walk)].filter((line) => line !== '');
	}
	return counted(textLines((item as SchemaNode<ListItem>).name, walk), walk);
}

// An ingredient as the page shows it: only the parentheses a recipe plugin added are undone, and every
// other parenthesis stays as written.
function withoutNoteWrapping(line: string): string {
	return line
		.replaceAll(' )', ')')
		.replace(doubledGroup, ' ($1)')
		.replace(trailingCommaGroup, ', $1');
}

function ingredientSections(
	recipe: SchemaNode<Recipe>,
	walk: ListWalk
): ExtractedIngredientSection[] {
	const lines = counted(list(recipe.recipeIngredient), walk)
		.flatMap((item) => ingredientLines(item, walk))
		.map(withoutNoteWrapping);
	return lines.length === 0 ? [] : [{ lines }];
}

// One step for each HowToStep, even when its text runs over several lines, and one for each line of
// plain text.
function steps(value: unknown, walk: ListWalk): string[] {
	const item = resolved(value, walk.graph);
	if (!isObject(item)) {
		return counted(textLines(item, walk), walk).map(withoutListMarkers);
	}
	if (hasType(item, 'ItemList') || hasType(item, 'HowToSection')) {
		return nestedLines(item, walk, steps);
	}
	const step = item as SchemaNode<HowToStep>;
	// A step can hold its directions and tips as a list rather than as text.
	const text =
		singleLine(step.text, walk) ??
		listElements(step, walk)
			.flatMap((element) =>
				isObject(element)
					? counted(textLines((element as SchemaNode<HowToStep>).text, walk), walk)
					: []
			)
			.join(' ');
	const written = text === '' ? singleLine(step.name, walk) : text;
	return written === undefined ? [] : [withoutListMarkers(written)];
}

// Steps outside a HowToSection gather in a section without a heading, before and after the others.
function instructionSections(
	recipe: SchemaNode<Recipe>,
	walk: ListWalk
): ExtractedInstructionSection[] {
	const instructions = resolved(recipe.recipeInstructions, walk.graph);
	const items =
		isObject(instructions) && hasType(instructions, 'ItemList')
			? listElements(instructions, walk)
			: counted(list(instructions), walk);
	const sections: ExtractedInstructionSection[] = [];
	let loose: string[] = [];
	const closeLoose = () => {
		if (loose.length > 0) {
			sections.push({ steps: loose });
			loose = [];
		}
	};
	for (const value of items) {
		const item = resolved(value, walk.graph);
		if (isObject(item) && hasType(item, 'HowToSection')) {
			closeLoose();
			const sectionSteps = steps(item, walk);
			if (sectionSteps.length > 0) {
				sections.push({
					heading: singleLine((item as SchemaNode<HowToSection>).name, walk),
					steps: sectionSteps,
				});
			}
		} else {
			loose = loose.concat(steps(item, walk));
		}
	}
	closeLoose();
	return sections;
}

// The recipe's ingredients and steps, or null when its lists cannot be read.
function recipeLists(recipe: SchemaNode<Recipe>, graph: JsonLdGraph): RecipeLists | null {
	const walk: ListWalk = { graph, inside: new Set(), elementsRead: 0, charactersRead: 0 };
	try {
		return {
			ingredientSections: ingredientSections(recipe, walk),
			instructionSections: instructionSections(recipe, walk),
		};
	} catch (error) {
		if (error instanceof UnreadableListsError) {
			return null;
		}
		throw error;
	}
}

function yieldText(value: unknown): string | undefined {
	if (isObject(value) && hasType(value, 'QuantitativeValue')) {
		const quantity = value as SchemaNode<QuantitativeValue>;
		const text = [singleLine(quantity.value), singleLine(quantity.unitText)]
			.filter((part) => part !== undefined)
			.join(' ');
		return text === '' ? undefined : text;
	}
	return singleLine(value);
}

// Servings when the label or unit says so, or when a number stands alone after no label or "Yield".
function yieldKind(labelWord: string | undefined, unit: string): ExtractedYield['kind'] {
	if (labelWord?.startsWith('serv') || servingUnit.test(unit)) {
		return 'servings';
	}
	return unit === '' && labelWord !== 'makes' ? 'servings' : 'makes';
}

// How many words the opening amount takes: the longest run the parser reads, four in "1 1/2 to 2
// servings". The parser reads no amount longer than a line it reads.
function amountWordCount(words: readonly string[]): number {
	let count = 0;
	let amount = '';
	for (const [index, word] of words.entries()) {
		amount = index === 0 ? word : `${amount} ${word}`;
		if (amount.length > maxReadLineLength) {
			break;
		}
		if (parseAmountText(amount) !== undefined) {
			count = index + 1;
		}
	}
	return count;
}

// A yield as written, split where its amount ends: "36 cookies" makes 36 cookies, and a bare number
// counts servings. Without an amount up front, the whole text stands as the amount for the member to
// read.
function yieldFromText(text: string): ExtractedYield {
	const label = yieldLabel.exec(text);
	const labelWord = label?.[1]?.toLowerCase();
	const rest = text.slice(label?.[0].length ?? 0);
	// A word that makes the amount approximate, as in "About 12", stays with it for drafts to strip.
	const approximation = approximationWord.exec(rest)?.[0] ?? '';
	const words = rest.slice(approximation.length).split(/\s+/);
	const count = amountWordCount(words);
	if (count === 0) {
		return { kind: yieldKind(labelWord, rest), amount: rest === '' ? text : rest };
	}
	const amount = `${approximation}${words.slice(0, count).join(' ')}`;
	const unit = words.slice(count).join(' ');
	if (yieldKind(labelWord, unit) === 'servings') {
		return { kind: 'servings', amount };
	}
	return unit === '' ? { kind: 'makes', amount } : { kind: 'makes', amount, unit };
}

// WP Recipe Maker and Tasty Recipes write ["4", "4 servings"]; the entry with words says more.
function recipeYield(recipe: SchemaNode<Recipe>, graph: JsonLdGraph): ExtractedYield | undefined {
	const texts = distinctEntries(recipe.recipeYield, graph)
		.map(yieldText)
		.filter((text) => text !== undefined);
	const hasWords = (text: string) => /\p{L}/u.test(text);
	const [text] = texts.toSorted(
		(first, second) =>
			Number(hasWords(second)) - Number(hasWords(first)) || second.length - first.length
	);
	return text === undefined ? undefined : yieldFromText(text);
}

function isoMinutes(text: string): number | undefined {
	try {
		const duration = parseIsoDuration(text.toUpperCase());
		// A year or month has no fixed length.
		if (duration.years || duration.months) {
			return undefined;
		}
		return (
			(duration.weeks ?? 0) * minutesPerWeek +
			(duration.days ?? 0) * minutesPerDay +
			(duration.hours ?? 0) * minutesPerHour +
			(duration.minutes ?? 0) +
			(duration.seconds ?? 0) / secondsPerMinute
		);
	} catch {
		return undefined;
	}
}

function writtenMinutes(text: string): number {
	let total = 0;
	for (const [, amount, unit] of text.matchAll(writtenDuration)) {
		total += Number(amount) * (unit?.toLowerCase().startsWith('h') ? minutesPerHour : 1);
	}
	return total;
}

// Whole minutes, or undefined when the time is missing, unreadable, or zero, as in "PT0S".
function minutes(value: unknown): number | undefined {
	const text = singleLine(value);
	if (text === undefined) {
		return undefined;
	}
	const total = Math.round((isoDuration.test(text) ? isoMinutes(text) : writtenMinutes(text)) ?? 0);
	return total > 0 ? total : undefined;
}

// Everyone the value names, as "A, B, and C".
function names(value: unknown, graph: JsonLdGraph): string | undefined {
	const written = distinctEntries(value, graph)
		.map((entry) =>
			isObject(entry)
				? singleLine((entry as SchemaNode<Person | Organization>).name)
				: singleLine(entry)
		)
		.filter((name) => name !== undefined);
	return written.length === 0 ? undefined : andList([...new Set(written)]);
}

// The value's entries, a text listing several with commas split into one entry each, since pages
// write ["Dessert", "Snack"] and "Dessert, Snack" alike. Other entries, such as a node naming a diet by
// its @id, stay whole.
function separatedEntries(value: unknown, graph: JsonLdGraph): unknown[] {
	return distinctEntries(value, graph).flatMap((entry) =>
		typeof entry === 'string'
			? textLines(entry)
					.flatMap((line) => line.split(','))
					.map((text) => text.trim())
					.filter((text) => text !== '')
			: [entry]
	);
}

function separatedTexts(value: unknown, graph: JsonLdGraph): string[] {
	return separatedEntries(value, graph).filter((entry) => typeof entry === 'string');
}

// Where the page files the recipe, from what its categories, keywords, and diets name. A page whose
// categories name no chapter gives none, for the member to choose.
function recipeFiling(
	recipe: SchemaNode<Recipe>,
	graph: JsonLdGraph
): Pick<ExtractedRecipe, 'chapter' | 'holidays' | 'diets'> {
	const keywords = separatedTexts(recipe.keywords, graph);
	return {
		chapter: chapterFromCategories(separatedTexts(recipe.recipeCategory, graph)) ?? undefined,
		holidays: holidaysFromKeywords(keywords),
		diets: withImpliedDiets([
			...dietsFromSchemaOrg(separatedEntries(recipe.suitableForDiet, graph)),
			...dietsFromKeywords(keywords),
		]),
	};
}

// Reads a recipe from the page's schema.org Recipe JSON-LD, which recipe plugins and publishers emit
// for search engines.
export class JsonLdPageRecipeExtractor implements PageRecipeExtractor {
	async extract(page: WebPage): Promise<Extraction | null> {
		const graph = graphOf(page.html);
		const node = mainRecipe(graph, new URL(page.url));
		if (node === undefined) {
			return null;
		}

		const recipe: SchemaNode<Recipe> = node;
		const lists = recipeLists(recipe, graph);
		if (
			lists === null ||
			(lists.ingredientSections.length === 0 && lists.instructionSections.length === 0)
		) {
			return null;
		}

		const extracted: ExtractedRecipe = {
			title: singleLine(recipe.name),
			description: singleLine(recipe.description),
			source: names(recipe.author, graph) ?? names(recipe.publisher, graph),
			yield: recipeYield(recipe, graph),
			times: {
				prepMinutes: minutes(recipe.prepTime),
				cookMinutes: minutes(recipe.cookTime),
				totalMinutes: minutes(recipe.totalTime),
			},
			...lists,
			...recipeFiling(recipe, graph),
			reviewNotes: [],
		};
		return { recipe: extracted };
	}
}
