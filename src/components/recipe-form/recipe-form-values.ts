import type { FieldErrors } from '@/components/forms/form-state';
import type { RecipeFormPayload } from '@/components/recipe-form/recipe-form-fields';
import type { Problem } from '@/domain/problem';
import type { Amount } from '@/domain/recipe/amount';
import { formatAmount } from '@/domain/recipe/amount-format';
import { parseAmountText } from '@/domain/recipe/ingredient-parser';
import { missingContentMessages, type RecipeContent } from '@/domain/recipe/recipe';
import type { RecipeDraftContent } from '@/domain/recipe/recipe-draft';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import type { RecipeYield } from '@/domain/recipe/recipe-yield';
import { tagKey, uniqueTagLabels } from '@/domain/recipe/tag-normalization';
import {
	transcriptionMarkersIn,
	type TranscriptionMarker,
} from '@/domain/recipe/transcription-markers';

// The recipe form's value and every edit to it. Pure, so the form's behavior is tested without a
// browser. Rows, tags, and photos carry ids that stay with them as they move, and a problem or a
// review note attaches to the row it names, so it follows that row.

export type RecipeFormListName = 'ingredientSections' | 'instructionSections';

// A row of a list: a line, which is one ingredient as written or one step, or a heading over the
// lines after it, such as "For the glaze". A row keeps its id as it moves or changes kind.
export type RecipeFormRow =
	| { kind: 'item'; id: number; text: string; error?: string }
	| {
			kind: 'heading';
			id: number;
			text: string;
			error?: string;
			// About the lines under the heading together, such as there being none.
			sectionError?: string;
	  };

export type RecipeFormRowKind = RecipeFormRow['kind'];

// A row as text, such as one a pasted list makes.
export type RecipeFormRowText = Pick<RecipeFormRow, 'kind' | 'text'>;

// One flat list, which the recipe stores as sections: each heading starts one, and the lines before
// the first heading form one without a heading.
export type RecipeFormList = {
	rows: readonly RecipeFormRow[];
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
	// and a save's errors leave them. Keyed by where each shows, so a note follows its row; a
	// removed row's note matches nothing again, since ids are never reused.
	reviewNotes: ReadonlyMap<ProblemKey, RecipeFormReviewNote>;
	// Rows, tags, and photos all take the next id, so ids are unique within the form.
	nextId: number;
};

// The photo fields' part of the value, which the photo import keeps on its own.
export type RecipeFormPhotoValues = Pick<RecipeFormValues, 'photos' | 'nextId'>;

// Where a problem shows: a field, a whole list, a row, the section a heading starts (by the heading's
// id), or a photo.
export type ProblemTarget =
	| { kind: 'field'; field: RecipeFormErrorField }
	| { kind: 'list'; list: RecipeFormListName }
	| { kind: 'row' | 'section' | 'photo'; id: number };

// One for each place a problem can show, the whole recipe included.
export type ProblemKey =
	| 'form'
	| `field:${RecipeFormErrorField}`
	| `list:${RecipeFormListName}`
	| `${'row' | 'section' | 'photo'}:${number}`;

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
	// A section shows at its heading, whose index among the rows it has.
	| { kind: 'row' | 'section'; list: RecipeFormListName; index: number; id: number }
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
	| { type: 'setRowText'; list: RecipeFormListName; rowId: number; text: string }
	// A blank row, below the row with this id, or at the end without one.
	| { type: 'addRow'; list: RecipeFormListName; kind: RecipeFormRowKind; afterRowId?: number }
	// A heading's lines stay, joining the lines above it.
	| { type: 'removeRow'; list: RecipeFormListName; rowId: number }
	// The destination indexes the list as it is without the row.
	| { type: 'moveRow'; list: RecipeFormListName; rowId: number; toIndex: number }
	| { type: 'setRowKind'; list: RecipeFormListName; rowId: number; kind: RecipeFormRowKind }
	// A pasted list's rows, which take the next ids in order and go below the row, which keeps the
	// text around the paste; a row left blank gives way to them.
	| {
			type: 'pasteRows';
			list: RecipeFormListName;
			rowId: number;
			text: string;
			rows: readonly RecipeFormRowText[];
	  }
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

// Records where problems with a section, its heading, and its lines show, at the section's place in
// the content. A section's problems show at its heading's row; one without a heading has no row of
// its own, its lines joining the lines above, so its problems fall to the list's.
function addSectionTargets(
	targets: Map<string, ProblemTarget>,
	list: RecipeFormListName,
	sectionIndex: number,
	headingId: number | undefined,
	itemIds: readonly number[]
) {
	const sectionPath = `${list}.${sectionIndex}`;
	if (headingId !== undefined) {
		targets.set(sectionPath, { kind: 'section', id: headingId });
		targets.set(`${sectionPath}.heading`, { kind: 'row', id: headingId });
	}
	itemIds.forEach((itemId, itemIndex) => {
		targets.set(`${sectionPath}.${itemKeys[list]}.${itemIndex}`, { kind: 'row', id: itemId });
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

// What the form keeps a review note by, which follows a row, section, or photo as it moves.
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
	const listWithErrors = (list: RecipeFormListName): RecipeFormList => ({
		rows: values[list].rows.map((row) => {
			const error = errorFor({ kind: 'row', id: row.id });
			return row.kind === 'heading'
				? { ...row, error, sectionError: errorFor({ kind: 'section', id: row.id }) }
				: { ...row, error };
		}),
		error: errorFor({ kind: 'list', list }),
	});
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

	// A heading's row, then a row for each line. Sections without headings follow on from the lines
	// above them, so two of them in a row load as one run of lines.
	const listFrom = (
		list: RecipeFormListName,
		sections: readonly ContentSection[] | undefined
	): RecipeFormList => {
		if (sections === undefined || sections.length === 0) {
			return { rows: [{ kind: 'item', id: newId(), text: '' }] };
		}
		const rows = sections.flatMap((section, sectionIndex): RecipeFormRow[] => {
			const heading =
				section.heading === undefined
					? undefined
					: { kind: 'heading' as const, id: newId(), text: section.heading };
			const items = section.texts.map((text) => ({ kind: 'item' as const, id: newId(), text }));
			addSectionTargets(
				targets,
				list,
				sectionIndex,
				heading?.id,
				items.map((item) => item.id)
			);
			return heading === undefined ? items : [heading, ...items];
		});
		return { rows };
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
	const ingredientSections = listFrom(
		'ingredientSections',
		content?.ingredientSections?.map((section) => ({
			heading: section.heading,
			texts: section.lines.map((line) => line.text),
		}))
	);
	const instructionSections = listFrom(
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

	return {
		text,
		yieldKind: recipeYield?.kind ?? 'servings',
		ingredientSections,
		instructionSections,
		tags,
		photos,
		fieldErrors: {},
		reviewNotes: draftReviewNotes(problems, targets),
		nextId,
	};
}

// The payload the form sends, its lists as sections: each heading starts one, and the lines before
// the first heading form one without a heading. Blank rows and blank optional text are left out, so
// a blank heading's lines join the lines above it; a heading with no lines stays, so the domain flags
// it.
export function recipeFormSubmission(values: RecipeFormValues): RecipeFormSubmission {
	const targets = new Map<string, ProblemTarget>();

	const submittedSections = (list: RecipeFormListName) => {
		const sections: { heading?: string; texts: string[] }[] = [];
		let heading: RecipeFormRow | undefined;
		let items: RecipeFormRow[] = [];
		const addSection = () => {
			if (heading === undefined && items.length === 0) {
				return;
			}
			addSectionTargets(
				targets,
				list,
				sections.length,
				heading?.id,
				items.map((item) => item.id)
			);
			sections.push({
				heading: heading?.text.trim(),
				texts: items.map((item) => item.text.trim()),
			});
		};
		for (const row of values[list].rows) {
			if (isBlank(row.text)) {
				continue;
			}
			if (row.kind === 'heading') {
				addSection();
				heading = row;
				items = [];
			} else {
				items.push(row);
			}
		}
		addSection();
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

// What a recipe needs filled in, by the path a save's problem with it takes.
type RequiredContent = keyof typeof missingContentMessages;

// A place the form shows, with what it holds there.
type RecipeFormPlace = {
	target: RecipeFormLocation;
	error?: string;
	// The texts the member edits there, which can hold transcription markers.
	texts?: readonly string[];
	// Set where the recipe needs this filled in and it is empty.
	emptyRequired?: RequiredContent;
};

function hasItemText(list: RecipeFormList): boolean {
	return list.rows.some((row) => row.kind === 'item' && !isBlank(row.text));
}

// The text a field holds; the tags field holds its tags and the one being typed, which saving adds.
function fieldTexts(values: RecipeFormValues, field: RecipeFormErrorField): readonly string[] {
	return field === 'tags'
		? [...values.tags.map((tag) => tag.label), values.text.tagDraft]
		: [values.text[field]];
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
				texts: fieldTexts(values, field),
				emptyRequired: field === 'title' && isBlank(values.text.title) ? field : undefined,
			},
		];
	});
}

// A list's places: the list, then each row, and after each heading the section it starts, about
// the lines under it together, which shows at the heading's row too.
function listPlaces(values: RecipeFormValues, list: RecipeFormListName): RecipeFormPlace[] {
	const { error, rows } = values[list];
	const places: RecipeFormPlace[] = [
		{
			target: { kind: 'list', list },
			error,
			emptyRequired: hasItemText(values[list]) ? undefined : list,
		},
	];
	rows.forEach((row, index) => {
		places.push({
			target: { kind: 'row', list, index, id: row.id },
			error: row.error,
			texts: [row.text],
		});
		if (row.kind === 'heading') {
			places.push({
				target: { kind: 'section', list, index, id: row.id },
				error: row.sectionError,
			});
		}
	});
	return places;
}

// A dish photo's description is saved, unless the photo failed and has none to save.
function photoPlaces(values: RecipeFormValues, role: RecipeImageRole): RecipeFormPlace[] {
	return values.photos[role].map((photo, index) => ({
		target: { kind: 'photo', role, index, id: photo.id },
		error: photo.error,
		texts: role === 'dish' && photo.upload.status !== 'failed' ? [photo.alt] : undefined,
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

// What the browser knows a save would be refused for: each place the recipe needs filled in that is
// empty, with the message the server gives, keyed by the path of the problem.
export function recipeFormRequiredErrors(values: RecipeFormValues): FieldErrors {
	const fieldErrors: FieldErrors = {};
	for (const { emptyRequired } of recipeFormPlaces(values)) {
		if (emptyRequired !== undefined) {
			fieldErrors[emptyRequired] = missingContentMessages[emptyRequired];
		}
	}
	return fieldErrors;
}

// Everything left to check against the original, in the order the form shows it: the open review
// notes, and the text that still holds a transcription marker.
export function recipeFormChecks(values: RecipeFormValues): RecipeFormCheck[] {
	return recipeFormPlaces(values).flatMap(
		({ target, texts = [], emptyRequired }): RecipeFormCheck[] => {
			const note = values.reviewNotes.get(problemKey(target));
			const openNote = note?.status === 'open' ? note.message : undefined;
			// A line apart, so no marker spans two texts.
			const markers = transcriptionMarkersIn(texts.join('\n'));
			if (openNote === undefined && markers.length === 0) {
				return [];
			}
			return [
				{
					target,
					note: openNote,
					markers,
					confirmable:
						openNote !== undefined && markers.length === 0 && emptyRequired === undefined,
				},
			];
		}
	);
}

function updateRows(
	values: RecipeFormValues,
	list: RecipeFormListName,
	update: (rows: readonly RecipeFormRow[]) => readonly RecipeFormRow[]
): RecipeFormValues {
	return { ...values, [list]: { ...values[list], rows: update(values[list].rows) } };
}

// The row as the other kind. Its errors were about it as the kind it was, so they go; its note is
// about its text, which stays, so the note follows it.
function rowOfKind(row: RecipeFormRow, kind: RecipeFormRowKind): RecipeFormRow {
	return row.kind === kind ? row : { kind, id: row.id, text: row.text };
}

// The rows with a pasted list's rows below the row, which keeps the text around the paste, or in
// its place when that is blank.
function withRowsPasted(
	rows: readonly RecipeFormRow[],
	edit: Extract<RecipeFormEdit, { type: 'pasteRows' }>,
	firstId: number
): readonly RecipeFormRow[] {
	const index = rows.findIndex((row) => row.id === edit.rowId);
	const row = rows[index];
	if (row === undefined) {
		return rows;
	}
	const pasted = edit.rows.map(({ kind, text }, offset) => ({ kind, id: firstId + offset, text }));
	const kept = isBlank(edit.text) ? [] : [{ ...row, text: edit.text }];
	return rows.toSpliced(index, 1, ...kept, ...pasted);
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

// Takes the row or photo out of the list, then puts it at the index; a list without it is unchanged.
function withMoved<Entry extends { id: number }>(
	entries: readonly Entry[],
	entryId: number,
	toIndex: number
): readonly Entry[] {
	const entry = entries.find(({ id }) => id === entryId);
	if (entry === undefined) {
		return entries;
	}
	return entries.filter(({ id }) => id !== entryId).toSpliced(toIndex, 0, entry);
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
				photos: { ...values.photos, dish: withMoved(values.photos.dish, edit.photoId, 0) },
			};
		case 'movePhoto':
			return {
				...values,
				photos: {
					dish: withMoved(values.photos.dish, edit.photoId, edit.toIndex),
					scan: withMoved(values.photos.scan, edit.photoId, edit.toIndex),
				},
			};
		case 'setPhotoAlt':
			return updatePhoto(values, edit.photoId, (photo) => ({ ...photo, alt: edit.alt }));
	}
}

// The section the row at this index is in: the heading at or above it, or for the lines before any
// heading, the list.
function sectionTargetAt(
	rows: readonly RecipeFormRow[],
	index: number,
	list: RecipeFormListName
): ProblemTarget {
	const heading = rows.slice(0, index + 1).findLast((row) => row.kind === 'heading');
	return heading === undefined ? { kind: 'list', list } : { kind: 'section', id: heading.id };
}

// The places a list's text changes answer: a row whose text changed answers its own note, and a line
// whose text changed, or one added with text, answers its section's and its list's, whose notes are
// about their lines.
function rowChangeTargets(
	before: readonly RecipeFormRow[],
	after: readonly RecipeFormRow[],
	list: RecipeFormListName
): ProblemTarget[] {
	const textsBefore = new Map(before.map((row) => [row.id, row.text]));
	return after.flatMap((row, index): ProblemTarget[] => {
		const textBefore = textsBefore.get(row.id);
		const added = textBefore === undefined;
		if (added ? isBlank(row.text) : textBefore === row.text) {
			return [];
		}
		const own: ProblemTarget[] = added ? [] : [{ kind: 'row', id: row.id }];
		return row.kind === 'heading'
			? own
			: [...own, sectionTargetAt(after, index, list), { kind: 'list', list }];
	});
}

// The section a heading's lines join once the heading is gone or is a line itself: the section of
// its first line still in the list, or else of the row before it.
function joinedSectionTarget(
	before: readonly RecipeFormRow[],
	after: readonly RecipeFormRow[],
	headingIndex: number,
	list: RecipeFormListName
): ProblemTarget {
	const indexesAfter = new Map(after.map((row, index) => [row.id, index]));
	const lines = before.slice(headingIndex + 1);
	const nextHeading = lines.findIndex((row) => row.kind === 'heading');
	const neighbors = [
		...(nextHeading === -1 ? lines : lines.slice(0, nextHeading)),
		...before.slice(0, headingIndex).reverse(),
	];
	for (const neighbor of neighbors) {
		const index = indexesAfter.get(neighbor.id);
		if (index !== undefined) {
			return sectionTargetAt(after, index, list);
		}
	}
	return { kind: 'list', list };
}

// Moves the open note of each section an edit dissolved, by removing its heading or changing it to a
// line, to the section its lines joined, so a note is never hidden while it is open. An open note
// already there takes the moved one's message after its own.
function withDissolvedSectionNotesMoved(
	values: RecipeFormValues,
	edited: RecipeFormValues,
	list: RecipeFormListName
): RecipeFormValues {
	const before = values[list].rows;
	const after = edited[list].rows;
	const headingsAfter = new Set(after.flatMap((row) => (row.kind === 'heading' ? [row.id] : [])));
	let reviewNotes: Map<ProblemKey, RecipeFormReviewNote> | undefined;
	before.forEach((row, index) => {
		const key = problemKey({ kind: 'section', id: row.id });
		const note = edited.reviewNotes.get(key);
		if (row.kind !== 'heading' || headingsAfter.has(row.id) || note?.status !== 'open') {
			return;
		}
		reviewNotes ??= new Map(edited.reviewNotes);
		const joinedKey = problemKey(joinedSectionTarget(before, after, index, list));
		const joined = reviewNotes.get(joinedKey);
		reviewNotes.delete(key);
		reviewNotes.set(
			joinedKey,
			joined?.status === 'open' ? { ...joined, message: `${joined.message} ${note.message}` } : note
		);
	});
	return reviewNotes === undefined ? edited : { ...edited, reviewNotes };
}

// The places whose notes an edit outside the lists answers: the text it changes. Saying a place
// looks right answers its note.
function answeredNoteTargets(edit: RecipeFormEdit): (ProblemTarget | { kind: 'form' })[] {
	switch (edit.type) {
		case 'setText':
			return [{ kind: 'field', field: edit.field === 'tagDraft' ? 'tags' : edit.field }];
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
	const edited = editedRecipeForm(values, edit);
	if (!('list' in edit)) {
		return withNotesResolved(edited, answeredNoteTargets(edit));
	}
	// An edit to a list answers what its text changes answer, and keeps the notes it would hide.
	const { list } = edit;
	return withNotesResolved(
		withDissolvedSectionNotesMoved(values, edited, list),
		rowChangeTargets(values[list].rows, edited[list].rows, list)
	);
}

function editedRecipeForm(values: RecipeFormValues, edit: RecipeFormEdit): RecipeFormValues {
	switch (edit.type) {
		case 'setText':
			return { ...values, text: { ...values.text, [edit.field]: edit.text } };
		case 'setYieldKind':
			return { ...values, yieldKind: edit.kind };
		case 'setRowText':
			return updateRows(values, edit.list, (rows) =>
				rows.map((row) => (row.id === edit.rowId ? { ...row, text: edit.text } : row))
			);
		case 'addRow': {
			const added = { kind: edit.kind, id: values.nextId, text: '' };
			const after = values[edit.list].rows.findIndex((row) => row.id === edit.afterRowId);
			return {
				...updateRows(values, edit.list, (rows) =>
					after === -1 ? [...rows, added] : rows.toSpliced(after + 1, 0, added)
				),
				nextId: values.nextId + 1,
			};
		}
		case 'removeRow':
			return updateRows(values, edit.list, (rows) => rows.filter((row) => row.id !== edit.rowId));
		case 'moveRow':
			return updateRows(values, edit.list, (rows) => withMoved(rows, edit.rowId, edit.toIndex));
		case 'setRowKind':
			return updateRows(values, edit.list, (rows) =>
				rows.map((row) => (row.id === edit.rowId ? rowOfKind(row, edit.kind) : row))
			);
		case 'pasteRows':
			return {
				...updateRows(values, edit.list, (rows) => withRowsPasted(rows, edit, values.nextId)),
				nextId: values.nextId + edit.rows.length,
			};
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
