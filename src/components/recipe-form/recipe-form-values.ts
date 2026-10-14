import type { FieldErrors } from '@/components/forms/form-state';
import type { RecipeFormPayload } from '@/components/recipe-form/recipe-form-fields';
import type { ItemPlace } from '@/components/recipe-form/sectioned-list';
import type { Problem } from '@/domain/problem';
import type { Amount } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import { parseAmountText } from '@/domain/recipe/ingredient-parser';
import type { RecipeContent } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';
import { tagKey, uniqueTagLabels } from '@/domain/recipe/tag-normalization';
import {
	transcriptionMarkersIn,
	type TranscriptionMarker,
} from '@/domain/recipe/transcription-markers';

// The recipe form's value and every edit to it. Pure, so the form's behavior is tested without a
// browser. Sections, items, tags, and photos carry ids that stay with them as they move, and a
// problem or a review note attaches to the item it names, so it follows that item.

export type RecipeFormListName = 'ingredientSections' | 'instructionSections';

// One ingredient as written, or one step.
export type RecipeFormItem = {
	id: number;
	text: string;
	error?: string;
};

export type RecipeFormSection = {
	id: number;
	heading: string;
	items: readonly RecipeFormItem[];
	headingError?: string;
	// About the section's items together, such as a heading with nothing under it.
	error?: string;
};

export type RecipeFormList = {
	sections: readonly RecipeFormSection[];
	// Set once a section has a heading or a heading error, or a second section is added. Typing never
	// clears it, so a heading field never disappears while it holds text or has focus; removing
	// sections can.
	showsHeadings: boolean;
	// About the list as a whole, such as having no ingredients at all.
	error?: string;
};

export type RecipeFormTag = {
	id: number;
	label: string;
};

export type PhotoFailure = 'unreadable' | 'upload';

// From choosing a photo to storing it. A photo the recipe already has is saved.
export type PhotoUpload =
	| { status: 'saved'; pathname: string }
	| { status: 'processing' }
	| { status: 'uploading'; pathname: string; file: File; fraction: number }
	| { status: 'uploaded'; pathname: string; file: File }
	| { status: 'failed'; failure: PhotoFailure };

export type RecipeFormPhoto = {
	id: number;
	// The chosen file's name; a saved photo has none.
	fileName?: string;
	// A description for people who can't see the photo; the form asks for it on dish photos only.
	alt: string;
	upload: PhotoUpload;
	error?: string;
};

export type RecipeFormText = {
	title: string;
	description: string;
	source: string;
	notes: string;
	prepMinutes: string;
	cookMinutes: string;
	totalMinutes: string;
	yieldAmount: string;
	yieldUnit: string;
	// A tag still being typed, which saving adds like the others.
	tagDraft: string;
};

export type RecipeFormTextField = keyof RecipeFormText;

// The fields a problem can land on directly. Problems with tags show at the tag field.
export type RecipeFormErrorField = Exclude<RecipeFormTextField, 'tagDraft'> | 'tags';

export type RecipeYieldKind = RecipeYield['kind'];

export type RecipeFormValues = {
	text: RecipeFormText;
	yieldKind: RecipeYieldKind;
	ingredientSections: RecipeFormList;
	instructionSections: RecipeFormList;
	tags: readonly RecipeFormTag[];
	photos: Readonly<Record<RecipeImageRole, readonly RecipeFormPhoto[]>>;
	// A save's errors, which mark their fields invalid.
	fieldErrors: Partial<Record<RecipeFormErrorField, string>>;
	// About the recipe as a whole, or a problem that names nothing in the form.
	formError?: string;
	// A loaded draft's problems, which the member checks against the original; they are not errors,
	// and a save's errors leave them. Keyed by where each shows, so a note follows its item; a
	// removed item's note matches nothing again, since ids are never reused.
	reviewNotes: ReadonlyMap<ProblemKey, RecipeFormReviewNote>;
	// Sections, items, tags, and photos all take the next id, so ids are unique within the form.
	nextId: number;
};

// The photo fields' part of the value, which the photo import keeps on its own.
export type RecipeFormPhotoValues = Pick<RecipeFormValues, 'photos' | 'nextId'>;

// Where a problem shows: a field, a whole list, a section or its heading, an item, or a photo.
export type ProblemTarget =
	| { kind: 'field'; field: RecipeFormErrorField }
	| { kind: 'list'; list: RecipeFormListName }
	| { kind: 'section' | 'heading' | 'item' | 'photo'; id: number };

// One for each place a problem can show, the whole recipe included.
export type ProblemKey =
	| 'form'
	| `field:${RecipeFormErrorField}`
	| `list:${RecipeFormListName}`
	| `${'section' | 'heading' | 'item' | 'photo'}:${number}`;

// A draft's note on one place, open until the member edits what it is on or says it looks right.
export type RecipeFormReviewNote = {
	message: string;
	status: 'open' | 'resolved';
};

// Where a problem or a note shows, with what the form names the place by.
export type RecipeFormLocation =
	| { kind: 'form' }
	| { kind: 'field'; field: RecipeFormErrorField }
	| { kind: 'list'; list: RecipeFormListName }
	| { kind: 'section' | 'heading'; list: RecipeFormListName; sectionIndex: number; id: number }
	| { kind: 'item'; list: RecipeFormListName; place: ItemPlace; id: number }
	| { kind: 'photo'; role: RecipeImageRole; index: number; id: number };

// A save's error, with where it shows.
export type RecipeFormProblem = {
	message: string;
	target: RecipeFormLocation;
};

// Something to check against the original before saving: an open review note, transcription
// markers left in the text, or both.
export type RecipeFormCheck = {
	target: RecipeFormLocation;
	// The open note's message.
	note?: string;
	markers: readonly TranscriptionMarker[];
	// Whether the member can say it looks right as it is. Markers are edited away, and a field the
	// recipe needs is filled in.
	confirmable: boolean;
};

// Keyed by the path a problem takes in the recipe content, such as ingredientSections.0.lines.2.
export type ProblemTargets = ReadonlyMap<string, ProblemTarget>;

// The value as sent, and where each of its problems shows.
export type RecipeFormSubmission = {
	payload: RecipeFormPayload;
	targets: ProblemTargets;
};

// The edits a photo field makes, which the photo import makes too.
export type PhotoEdit =
	// The photos take the next ids, in order.
	| { type: 'addPhotos'; role: RecipeImageRole; fileNames: readonly string[] }
	| { type: 'startPhotoUpload'; photoId: number; pathname: string; file: File }
	| { type: 'setPhotoProgress'; photoId: number; fraction: number }
	| { type: 'finishPhotoUpload'; photoId: number }
	| { type: 'failPhoto'; photoId: number; failure: PhotoFailure }
	| { type: 'removePhoto'; photoId: number }
	| { type: 'makeCoverPhoto'; photoId: number }
	// Within the photo's own field.
	| { type: 'movePhoto'; photoId: number; toIndex: number }
	| { type: 'setPhotoAlt'; photoId: number; alt: string };

export type RecipeFormEdit =
	| { type: 'setText'; field: RecipeFormTextField; text: string }
	| { type: 'setYieldKind'; kind: RecipeYieldKind }
	| { type: 'setItemText'; list: RecipeFormListName; itemId: number; text: string }
	| { type: 'addItem'; list: RecipeFormListName; sectionId: number }
	| { type: 'removeItem'; list: RecipeFormListName; itemId: number }
	// The destination indexes the list as it is without the item.
	| { type: 'moveItem'; list: RecipeFormListName; itemId: number; to: ItemPlace }
	| { type: 'addSection'; list: RecipeFormListName }
	| { type: 'removeSection'; list: RecipeFormListName; sectionId: number }
	| { type: 'setHeading'; list: RecipeFormListName; sectionId: number; heading: string }
	// Adds each tag not already chosen, as tagLabelsToAdd finds them, and clears the tag field.
	| { type: 'addTags'; labels: readonly string[] }
	| { type: 'removeTag'; tagId: number }
	| PhotoEdit
	| { type: 'attachErrors'; fieldErrors: FieldErrors; targets: ProblemTargets }
	// The member says the place looks right as it is, which resolves its note.
	| { type: 'resolveReviewNote'; target: ProblemTarget | { kind: 'form' } };

// Each list's items, under the name the recipe content gives them.
const itemKeys = {
	ingredientSections: 'lines',
	instructionSections: 'steps',
} as const satisfies Record<RecipeFormListName, string>;

const photoRoles = ['dish', 'scan'] as const satisfies readonly RecipeImageRole[];

// Text fields in the order the form shows them, around the lists and the tags.
const fieldsBeforeLists = [
	'title',
	'description',
	'source',
	'prepMinutes',
	'cookMinutes',
	'totalMinutes',
	'yieldAmount',
	'yieldUnit',
] as const satisfies readonly RecipeFormErrorField[];
const fieldsAfterLists = ['notes', 'tags'] as const satisfies readonly RecipeFormErrorField[];

// Problems whose paths never change, whatever the form holds.
const fixedTargets: ProblemTargets = new Map<string, ProblemTarget>([
	['title', { kind: 'field', field: 'title' }],
	['description', { kind: 'field', field: 'description' }],
	['source', { kind: 'field', field: 'source' }],
	['notes', { kind: 'field', field: 'notes' }],
	['times.prepMinutes', { kind: 'field', field: 'prepMinutes' }],
	['times.cookMinutes', { kind: 'field', field: 'cookMinutes' }],
	['times.totalMinutes', { kind: 'field', field: 'totalMinutes' }],
	['yield', { kind: 'field', field: 'yieldAmount' }],
	['yield.unit', { kind: 'field', field: 'yieldUnit' }],
	['tags', { kind: 'field', field: 'tags' }],
	['ingredientSections', { kind: 'list', list: 'ingredientSections' }],
	['instructionSections', { kind: 'list', list: 'instructionSections' }],
]);

const blankText: RecipeFormText = {
	title: '',
	description: '',
	source: '',
	notes: '',
	prepMinutes: '',
	cookMinutes: '',
	totalMinutes: '',
	yieldAmount: '',
	yieldUnit: '',
	tagDraft: '',
};

function isBlank(text: string): boolean {
	return text.trim() === '';
}

// Blank optional text is left out of the payload, as the domain expects.
export function filledText(text: string): string | undefined {
	return isBlank(text) ? undefined : text.trim();
}

// Heading fields show for more than one section, or for one whose heading holds text or has an
// error, so the error has a field to show beside.
export function sectionsShowHeadings(
	sections: readonly { heading?: string; headingError?: string }[]
): boolean {
	return (
		sections.length > 1 ||
		sections.some(
			({ heading = '', headingError }) => !isBlank(heading) || headingError !== undefined
		)
	);
}

function minutesText(minutes: number | undefined): string {
	return minutes === undefined ? '' : String(minutes);
}

// Each comma-separated tag in the text, trimmed, without blanks.
export function tagLabelsFrom(text: string): string[] {
	return text
		.split(',')
		.map((label) => label.trim())
		.filter((label) => label !== '');
}

// The labels that add a tag: each tag once, by key, and none already chosen.
export function tagLabelsToAdd(
	tags: readonly RecipeFormTag[],
	labels: readonly string[]
): string[] {
	const chosenKeys = new Set(tags.map((tag) => tagKey(tag.label)));
	return uniqueTagLabels(labels).filter((label) => !chosenKeys.has(tagKey(label)));
}

// A photo still being processed or uploaded, which saving must wait for.
export function isPhotoInProgress(photo: RecipeFormPhoto): boolean {
	return photo.upload.status === 'processing' || photo.upload.status === 'uploading';
}

export function hasPhotosInProgress(values: RecipeFormPhotoValues): boolean {
	return photoRoles.some((role) => values.photos[role].some(isPhotoInProgress));
}

// The pathname of a stored photo; one still uploading, or one that failed, has none to save.
export function storedPathname({ upload }: RecipeFormPhoto): string | undefined {
	return upload.status === 'saved' || upload.status === 'uploaded' ? upload.pathname : undefined;
}

// Records where problems with a section, its heading, and its items show, at the section's place
// in the content.
function addSectionTargets(
	targets: Map<string, ProblemTarget>,
	list: RecipeFormListName,
	sectionIndex: number,
	sectionId: number,
	itemIds: readonly number[]
) {
	const sectionPath = `${list}.${sectionIndex}`;
	targets.set(sectionPath, { kind: 'section', id: sectionId });
	targets.set(`${sectionPath}.heading`, { kind: 'heading', id: sectionId });
	itemIds.forEach((itemId, itemIndex) => {
		targets.set(`${sectionPath}.${itemKeys[list]}.${itemIndex}`, { kind: 'item', id: itemId });
	});
}

// The target for the longest part of the path that names one, so a problem with any part of a
// line, such as ingredientSections.0.lines.2.amount.max, lands on the line.
function problemTarget(path: string, targets: ProblemTargets): ProblemTarget | undefined {
	const segments = path.split('.');
	for (let length = segments.length; length > 0; length -= 1) {
		const prefix = segments.slice(0, length).join('.');
		const target = targets.get(prefix) ?? fixedTargets.get(prefix);
		if (target !== undefined) {
			return target;
		}
	}
	return undefined;
}

// What the form keeps a review note by, which follows an item, section, or photo as it moves.
export function problemKey(target: ProblemTarget | { kind: 'form' }): ProblemKey {
	switch (target.kind) {
		case 'form':
			return 'form';
		case 'field':
			return `field:${target.field}`;
		case 'list':
			return `list:${target.list}`;
		default:
			return `${target.kind}:${target.id}`;
	}
}

// Replaces every error in the form with these, leaving the review notes. The first problem for each
// target wins, and one that names nothing in the form shows as a problem with the whole recipe.
function withErrors(
	values: RecipeFormValues,
	fieldErrors: FieldErrors,
	targets: ProblemTargets
): RecipeFormValues {
	const messages = new Map<ProblemKey, string>();
	const formFieldErrors: RecipeFormValues['fieldErrors'] = {};
	let formError: string | undefined;
	for (const [path, message] of Object.entries(fieldErrors)) {
		if (message === undefined) {
			continue;
		}
		const target = problemTarget(path, targets);
		if (target === undefined) {
			formError ??= message;
		} else if (target.kind === 'field') {
			formFieldErrors[target.field] ??= message;
		} else if (!messages.has(problemKey(target))) {
			messages.set(problemKey(target), message);
		}
	}

	const errorFor = (target: ProblemTarget) => messages.get(problemKey(target));
	const listWithErrors = (list: RecipeFormListName): RecipeFormList => {
		const sections = values[list].sections.map((section) => ({
			...section,
			headingError: errorFor({ kind: 'heading', id: section.id }),
			error: errorFor({ kind: 'section', id: section.id }),
			items: section.items.map((item) => ({
				...item,
				error: errorFor({ kind: 'item', id: item.id }),
			})),
		}));
		return {
			sections,
			showsHeadings: values[list].showsHeadings || sectionsShowHeadings(sections),
			error: errorFor({ kind: 'list', list }),
		};
	};
	const photosWithErrors = (role: RecipeImageRole) =>
		values.photos[role].map((photo) => ({
			...photo,
			error: errorFor({ kind: 'photo', id: photo.id }),
		}));

	return {
		...values,
		ingredientSections: listWithErrors('ingredientSections'),
		instructionSections: listWithErrors('instructionSections'),
		photos: { dish: photosWithErrors('dish'), scan: photosWithErrors('scan') },
		fieldErrors: formFieldErrors,
		formError,
	};
}

// A draft's problems as one open note for each place they show, so a note on a line that also lost
// text says both: each place's distinct messages in order.
function draftReviewNotes(
	problems: readonly Problem[],
	targets: ProblemTargets
): Map<ProblemKey, RecipeFormReviewNote> {
	const places = new Map<ProblemKey, string[]>();
	for (const { path, message } of problems) {
		// Every problem that names nothing in the form is a note on the whole recipe.
		const key = problemKey(problemTarget(path, targets) ?? { kind: 'form' });
		const messages = places.get(key);
		if (messages === undefined) {
			places.set(key, [message]);
		} else if (!messages.includes(message)) {
			messages.push(message);
		}
	}
	return new Map(
		Array.from(places, ([key, messages]) => [key, { message: messages.join(' '), status: 'open' }])
	);
}

function hasOpenNote(
	reviewNotes: RecipeFormValues['reviewNotes'],
	target: ProblemTarget | { kind: 'form' }
): boolean {
	return reviewNotes.get(problemKey(target))?.status === 'open';
}

// Heading fields show as sectionsShowHeadings says, or for a heading with an open note, so the note
// has a field to sit beside.
function showsHeadingFields(
	sections: readonly RecipeFormSection[],
	reviewNotes: RecipeFormValues['reviewNotes']
): boolean {
	return (
		sectionsShowHeadings(sections) ||
		sections.some((section) => hasOpenNote(reviewNotes, { kind: 'heading', id: section.id }))
	);
}

type ContentSection = {
	heading?: string;
	texts: readonly string[];
};

// A number as plain decimals, never in exponent form ("1e-7"), which the amount parser cannot read.
function decimalText(value: number): string {
	const text = String(value);
	const exponent = /^\d+(?:\.(\d+))?e-(\d+)$/.exec(text);
	return exponent === null ? text : value.toFixed((exponent[1]?.length ?? 0) + Number(exponent[2]));
}

// The amount as the member edits it: the page's fractions when they read back exactly, and plain
// decimals otherwise, so saving an untouched yield never changes it.
function editableAmountText(amount: Amount): string {
	const formatted = formatAmount(amount);
	const read = parseAmountText(formatted);
	if (read !== undefined && read.min === amount.min && read.max === amount.max) {
		return formatted;
	}
	return amount.max === undefined
		? decimalText(amount.min)
		: `${decimalText(amount.min)} to ${decimalText(amount.max)}`;
}

// The form's starting value: empty, a recipe being edited, or a draft to review. A draft's problems
// become its review notes, which attach through the same paths a save's errors do, so they show
// from the start, joined where several land in one place.
export function recipeFormValues(
	content?: RecipeContent | RecipeDraftContent,
	problems: readonly Problem[] = []
): RecipeFormValues {
	let nextId = 0;
	const newId = () => nextId++;
	const targets = new Map<string, ProblemTarget>();

	const sectionsFrom = (
		list: RecipeFormListName,
		sections: readonly ContentSection[] | undefined
	): RecipeFormSection[] => {
		if (sections === undefined || sections.length === 0) {
			return [{ id: newId(), heading: '', items: [{ id: newId(), text: '' }] }];
		}
		return sections.map((section, sectionIndex) => {
			const id = newId();
			const items = section.texts.map((text) => ({ id: newId(), text }));
			addSectionTargets(
				targets,
				list,
				sectionIndex,
				id,
				items.map((item) => item.id)
			);
			return { id, heading: section.heading ?? '', items };
		});
	};

	const recipeYield = content?.yield;
	const times = content?.times;
	const text: RecipeFormText = {
		...blankText,
		title: content?.title ?? '',
		description: content?.description ?? '',
		source: content?.source ?? '',
		notes: content?.notes ?? '',
		prepMinutes: minutesText(times?.prepMinutes),
		cookMinutes: minutesText(times?.cookMinutes),
		totalMinutes: minutesText(times?.totalMinutes),
		yieldAmount: recipeYield === undefined ? '' : editableAmountText(recipeYield.amount),
		yieldUnit: recipeYield?.kind === 'makes' ? (recipeYield.unit ?? '') : '',
	};
	const ingredientSections = sectionsFrom(
		'ingredientSections',
		content?.ingredientSections?.map((section) => ({
			heading: section.heading,
			texts: section.lines.map((line) => line.text),
		}))
	);
	const instructionSections = sectionsFrom(
		'instructionSections',
		content?.instructionSections?.map((section) => ({
			heading: section.heading,
			texts: section.steps.map((step) => step.text),
		}))
	);
	const tags = (content?.tags ?? []).map((label) => ({ id: newId(), label }));
	const photos: Record<RecipeImageRole, RecipeFormPhoto[]> = { dish: [], scan: [] };
	(content?.images ?? []).forEach((image, index) => {
		const id = newId();
		targets.set(`images.${index}`, { kind: 'photo', id });
		photos[image.role].push({
			id,
			alt: image.alt ?? '',
			upload: { status: 'saved', pathname: image.pathname },
		});
	});

	const reviewNotes = draftReviewNotes(problems, targets);
	const listOf = (sections: readonly RecipeFormSection[]): RecipeFormList => ({
		sections,
		showsHeadings: showsHeadingFields(sections, reviewNotes),
	});
	return {
		text,
		yieldKind: recipeYield?.kind ?? 'servings',
		ingredientSections: listOf(ingredientSections),
		instructionSections: listOf(instructionSections),
		tags,
		photos,
		fieldErrors: {},
		reviewNotes,
		nextId,
	};
}

// The payload the form sends. Blank items, blank optional text, and sections with neither a heading
// nor an item are left out; a section with a heading and no items stays, so the domain flags it.
export function recipeFormSubmission(values: RecipeFormValues): RecipeFormSubmission {
	const targets = new Map<string, ProblemTarget>();

	const submittedSections = (list: RecipeFormListName) => {
		const sections: { heading?: string; texts: string[] }[] = [];
		for (const section of values[list].sections) {
			const items = section.items.filter((item) => !isBlank(item.text));
			if (isBlank(section.heading) && items.length === 0) {
				continue;
			}
			addSectionTargets(
				targets,
				list,
				sections.length,
				section.id,
				items.map((item) => item.id)
			);
			sections.push({
				heading: filledText(section.heading),
				texts: items.map((item) => item.text.trim()),
			});
		}
		return sections;
	};

	const images: RecipeFormPayload['images'] = [];
	for (const role of photoRoles) {
		for (const photo of values.photos[role]) {
			const pathname = storedPathname(photo);
			if (pathname === undefined) {
				continue;
			}
			targets.set(`images.${images.length}`, { kind: 'photo', id: photo.id });
			images.push(
				role === 'dish' ? { role, pathname, alt: filledText(photo.alt) } : { role, pathname }
			);
		}
	}

	const { text, yieldKind } = values;
	const yieldAmount = filledText(text.yieldAmount);
	const payload: RecipeFormPayload = {
		title: text.title.trim(),
		description: filledText(text.description),
		source: filledText(text.source),
		notes: filledText(text.notes),
		yield:
			yieldAmount === undefined
				? undefined
				: {
						kind: yieldKind,
						amount: yieldAmount,
						unit: yieldKind === 'makes' ? filledText(text.yieldUnit) : undefined,
					},
		times: {
			prepMinutes: filledText(text.prepMinutes),
			cookMinutes: filledText(text.cookMinutes),
			totalMinutes: filledText(text.totalMinutes),
		},
		ingredientSections: submittedSections('ingredientSections').map(({ heading, texts }) => ({
			heading,
			lines: texts,
		})),
		instructionSections: submittedSections('instructionSections').map(({ heading, texts }) => ({
			heading,
			steps: texts,
		})),
		tags: [...values.tags.map((tag) => tag.label), ...tagLabelsFrom(text.tagDraft)],
		images,
	};
	return { payload, targets };
}

// A place the form shows, with what it holds there.
type RecipeFormPlace = {
	target: RecipeFormLocation;
	error?: string;
	// The text the member edits there, which can hold transcription markers.
	text?: string;
	// The recipe needs this filled in, and it is empty.
	emptyRequired?: boolean;
};

function hasItemText(list: RecipeFormList): boolean {
	return list.sections.some((section) => section.items.some((item) => !isBlank(item.text)));
}

function fieldPlaces(
	values: RecipeFormValues,
	fields: readonly RecipeFormErrorField[]
): RecipeFormPlace[] {
	return fields.flatMap((field): RecipeFormPlace[] => {
		// The unit shows only for a yield the recipe makes, and only then is it sent.
		if (field === 'yieldUnit' && values.yieldKind !== 'makes') {
			return [];
		}
		return [
			{
				target: { kind: 'field', field },
				error: values.fieldErrors[field],
				text: field === 'tags' ? undefined : values.text[field],
				emptyRequired: field === 'title' && isBlank(values.text.title),
			},
		];
	});
}

// A list's places: the list, then each section's heading where headings show (as they do for a
// heading error), its items, and the section itself, about its items together.
function listPlaces(values: RecipeFormValues, list: RecipeFormListName): RecipeFormPlace[] {
	const { error, sections, showsHeadings } = values[list];
	const places: RecipeFormPlace[] = [
		{ target: { kind: 'list', list }, error, emptyRequired: !hasItemText(values[list]) },
	];
	sections.forEach((section, sectionIndex) => {
		if (showsHeadings) {
			places.push({
				target: { kind: 'heading', list, sectionIndex, id: section.id },
				error: section.headingError,
				text: section.heading,
			});
		}
		section.items.forEach((item, itemIndex) => {
			places.push({
				target: { kind: 'item', list, place: { sectionIndex, itemIndex }, id: item.id },
				error: item.error,
				text: item.text,
			});
		});
		places.push({
			target: { kind: 'section', list, sectionIndex, id: section.id },
			error: section.error,
		});
	});
	return places;
}

function photoPlaces(values: RecipeFormValues, role: RecipeImageRole): RecipeFormPlace[] {
	return values.photos[role].map((photo, index) => ({
		target: { kind: 'photo', role, index, id: photo.id },
		error: photo.error,
	}));
}

// Every place the form shows, in the order it shows them, starting with the whole recipe.
function recipeFormPlaces(values: RecipeFormValues): RecipeFormPlace[] {
	return [
		{ target: { kind: 'form' }, error: values.formError },
		...fieldPlaces(values, fieldsBeforeLists),
		...listPlaces(values, 'ingredientSections'),
		...listPlaces(values, 'instructionSections'),
		...fieldPlaces(values, fieldsAfterLists),
		...photoRoles.flatMap((role) => photoPlaces(values, role)),
	];
}

// Every error the form shows, in the order it shows them, starting with one about the whole recipe.
export function recipeFormProblems(values: RecipeFormValues): RecipeFormProblem[] {
	return recipeFormPlaces(values).flatMap(({ target, error }) =>
		error === undefined ? [] : [{ message: error, target }]
	);
}

// Everything left to check against the original, in the order the form shows it: the open review
// notes, and the text that still holds a transcription marker.
export function recipeFormChecks(values: RecipeFormValues): RecipeFormCheck[] {
	return recipeFormPlaces(values).flatMap(
		({ target, text, emptyRequired = false }): RecipeFormCheck[] => {
			const note = values.reviewNotes.get(problemKey(target));
			const openNote = note?.status === 'open' ? note.message : undefined;
			const markers = text === undefined ? [] : transcriptionMarkersIn(text);
			if (openNote === undefined && markers.length === 0) {
				return [];
			}
			return [
				{
					target,
					note: openNote,
					markers,
					confirmable: openNote !== undefined && markers.length === 0 && !emptyRequired,
				},
			];
		}
	);
}

function updateSections(
	values: RecipeFormValues,
	list: RecipeFormListName,
	update: (sections: readonly RecipeFormSection[]) => readonly RecipeFormSection[]
): RecipeFormValues {
	return { ...values, [list]: { ...values[list], sections: update(values[list].sections) } };
}

function updateSection(
	values: RecipeFormValues,
	list: RecipeFormListName,
	sectionId: number,
	update: (section: RecipeFormSection) => RecipeFormSection
): RecipeFormValues {
	return updateSections(values, list, (sections) =>
		sections.map((section) => (section.id === sectionId ? update(section) : section))
	);
}

// Takes the item out of its section, then puts it at the destination.
function withItemMoved(
	sections: readonly RecipeFormSection[],
	itemId: number,
	to: ItemPlace
): readonly RecipeFormSection[] {
	const item = sections.flatMap((section) => section.items).find(({ id }) => id === itemId);
	if (item === undefined) {
		return sections;
	}
	return sections.map((section, sectionIndex) => {
		const items = section.items.filter(({ id }) => id !== itemId);
		return {
			...section,
			items: sectionIndex === to.sectionIndex ? items.toSpliced(to.itemIndex, 0, item) : items,
		};
	});
}

// Applies the update to the photo with this id, whichever field it is in; undefined removes it.
function updatePhoto<Values extends RecipeFormPhotoValues>(
	values: Values,
	photoId: number,
	update: (photo: RecipeFormPhoto) => RecipeFormPhoto | undefined
): Values {
	const updated = (photos: readonly RecipeFormPhoto[]) =>
		photos.flatMap((photo) => {
			if (photo.id !== photoId) {
				return [photo];
			}
			const next = update(photo);
			return next === undefined ? [] : [next];
		});
	return {
		...values,
		photos: { dish: updated(values.photos.dish), scan: updated(values.photos.scan) },
	};
}

// Changes a photo's upload only from the status it expects, so a late report about a photo that was
// removed or reloaded changes nothing.
function updateUpload<Values extends RecipeFormPhotoValues>(
	values: Values,
	photoId: number,
	update: (upload: PhotoUpload) => PhotoUpload | undefined
): Values {
	return updatePhoto(values, photoId, (photo) => {
		const upload = update(photo.upload);
		return upload === undefined ? photo : { ...photo, upload };
	});
}

// Takes the photo out of the list, then puts it at the index; a list without it is unchanged.
function withPhotoMoved(
	photos: readonly RecipeFormPhoto[],
	photoId: number,
	toIndex: number
): readonly RecipeFormPhoto[] {
	const photo = photos.find(({ id }) => id === photoId);
	if (photo === undefined) {
		return photos;
	}
	return photos.filter(({ id }) => id !== photoId).toSpliced(toIndex, 0, photo);
}

export function editPhotos<Values extends RecipeFormPhotoValues>(
	values: Values,
	edit: PhotoEdit
): Values {
	switch (edit.type) {
		case 'addPhotos': {
			const added = edit.fileNames.map((fileName, index) => ({
				id: values.nextId + index,
				fileName,
				alt: '',
				upload: { status: 'processing' } as const,
			}));
			return {
				...values,
				photos: { ...values.photos, [edit.role]: [...values.photos[edit.role], ...added] },
				nextId: values.nextId + added.length,
			};
		}
		case 'startPhotoUpload':
			return updateUpload(values, edit.photoId, (upload) =>
				upload.status === 'processing'
					? { status: 'uploading', pathname: edit.pathname, file: edit.file, fraction: 0 }
					: undefined
			);
		case 'setPhotoProgress':
			return updateUpload(values, edit.photoId, (upload) =>
				upload.status === 'uploading' ? { ...upload, fraction: edit.fraction } : undefined
			);
		case 'finishPhotoUpload':
			return updateUpload(values, edit.photoId, (upload) =>
				upload.status === 'uploading'
					? { status: 'uploaded', pathname: upload.pathname, file: upload.file }
					: undefined
			);
		case 'failPhoto':
			return updateUpload(values, edit.photoId, (upload) =>
				upload.status === 'processing' || upload.status === 'uploading'
					? { status: 'failed', failure: edit.failure }
					: undefined
			);
		case 'removePhoto':
			return updatePhoto(values, edit.photoId, () => undefined);
		case 'makeCoverPhoto':
			return {
				...values,
				photos: { ...values.photos, dish: withPhotoMoved(values.photos.dish, edit.photoId, 0) },
			};
		case 'movePhoto':
			return {
				...values,
				photos: {
					dish: withPhotoMoved(values.photos.dish, edit.photoId, edit.toIndex),
					scan: withPhotoMoved(values.photos.scan, edit.photoId, edit.toIndex),
				},
			};
		case 'setPhotoAlt':
			return updatePhoto(values, edit.photoId, (photo) => ({ ...photo, alt: edit.alt }));
	}
}

// The places whose notes an edit answers: the text it changes, and the section and list around a
// line it changes, whose notes are about their lines. Saying a place looks right answers its note.
function answeredNoteTargets(
	values: RecipeFormValues,
	edit: RecipeFormEdit
): (ProblemTarget | { kind: 'form' })[] {
	switch (edit.type) {
		case 'setText':
			return [{ kind: 'field', field: edit.field === 'tagDraft' ? 'tags' : edit.field }];
		case 'setItemText': {
			const section = values[edit.list].sections.find(({ items }) =>
				items.some((item) => item.id === edit.itemId)
			);
			return [
				{ kind: 'item', id: edit.itemId },
				...(section === undefined ? [] : [{ kind: 'section', id: section.id } as const]),
				{ kind: 'list', list: edit.list },
			];
		}
		case 'setHeading':
			return [{ kind: 'heading', id: edit.sectionId }];
		case 'addTags':
		case 'removeTag':
			return [{ kind: 'field', field: 'tags' }];
		case 'setPhotoAlt':
			return [{ kind: 'photo', id: edit.photoId }];
		case 'resolveReviewNote':
			return [edit.target];
		default:
			return [];
	}
}

// Resolves the open notes on these places; the value stays the same object when none is open.
function withNotesResolved(
	values: RecipeFormValues,
	targets: readonly (ProblemTarget | { kind: 'form' })[]
): RecipeFormValues {
	const keys = targets
		.map(problemKey)
		.filter((key) => values.reviewNotes.get(key)?.status === 'open');
	if (keys.length === 0) {
		return values;
	}
	const reviewNotes = new Map(values.reviewNotes);
	for (const key of keys) {
		const note = reviewNotes.get(key);
		if (note !== undefined) {
			reviewNotes.set(key, { ...note, status: 'resolved' });
		}
	}
	return { ...values, reviewNotes };
}

export function editRecipeForm(values: RecipeFormValues, edit: RecipeFormEdit): RecipeFormValues {
	return withNotesResolved(editedRecipeForm(values, edit), answeredNoteTargets(values, edit));
}

function editedRecipeForm(values: RecipeFormValues, edit: RecipeFormEdit): RecipeFormValues {
	switch (edit.type) {
		case 'setText':
			return { ...values, text: { ...values.text, [edit.field]: edit.text } };
		case 'setYieldKind':
			return { ...values, yieldKind: edit.kind };
		case 'setItemText':
			return updateSections(values, edit.list, (sections) =>
				sections.map((section) => ({
					...section,
					items: section.items.map((item) =>
						item.id === edit.itemId ? { ...item, text: edit.text } : item
					),
				}))
			);
		case 'addItem':
			return {
				...updateSection(values, edit.list, edit.sectionId, (section) => ({
					...section,
					items: [...section.items, { id: values.nextId, text: '' }],
				})),
				nextId: values.nextId + 1,
			};
		case 'removeItem':
			return updateSections(values, edit.list, (sections) =>
				sections.map((section) => ({
					...section,
					items: section.items.filter((item) => item.id !== edit.itemId),
				}))
			);
		case 'moveItem':
			return updateSections(values, edit.list, (sections) =>
				withItemMoved(sections, edit.itemId, edit.to)
			);
		case 'addSection': {
			const section = {
				id: values.nextId,
				heading: '',
				items: [{ id: values.nextId + 1, text: '' }],
			};
			const list = values[edit.list];
			return {
				...values,
				[edit.list]: { ...list, sections: [...list.sections, section], showsHeadings: true },
				nextId: values.nextId + 2,
			};
		}
		case 'removeSection': {
			const list = values[edit.list];
			// A list always keeps one section.
			if (list.sections.length === 1) {
				return values;
			}
			const sections = list.sections.filter((section) => section.id !== edit.sectionId);
			return {
				...values,
				[edit.list]: {
					...list,
					sections,
					showsHeadings: showsHeadingFields(sections, values.reviewNotes),
				},
			};
		}
		case 'setHeading':
			return updateSection(values, edit.list, edit.sectionId, (section) => ({
				...section,
				heading: edit.heading,
			}));
		case 'addTags': {
			const labels = tagLabelsToAdd(values.tags, edit.labels);
			return {
				...values,
				text: { ...values.text, tagDraft: '' },
				tags: [
					...values.tags,
					...labels.map((label, index) => ({ id: values.nextId + index, label })),
				],
				nextId: values.nextId + labels.length,
			};
		}
		case 'removeTag':
			return { ...values, tags: values.tags.filter((tag) => tag.id !== edit.tagId) };
		case 'addPhotos':
		case 'startPhotoUpload':
		case 'setPhotoProgress':
		case 'finishPhotoUpload':
		case 'failPhoto':
		case 'removePhoto':
		case 'makeCoverPhoto':
		case 'movePhoto':
		case 'setPhotoAlt':
			return editPhotos(values, edit);
		case 'attachErrors':
			return withErrors(values, edit.fieldErrors, edit.targets);
		case 'resolveReviewNote':
			return values;
	}
}
