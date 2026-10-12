import { fieldErrorsFrom } from '@/components/forms/field-errors';
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

// The recipe form's value and every edit to it. Pure, so the form's behavior is tested without a
// browser. Sections, items, tags, and photos carry ids that stay with them as they move, and a
// problem attaches to the item it names, so it follows that item.

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
	// Set once a section has a heading or a second section is added, and never cleared, so a heading
	// field never disappears while it holds text or has focus.
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
	fieldErrors: Partial<Record<RecipeFormErrorField, string>>;
	// About the recipe as a whole, or a problem that names nothing in the form.
	formError?: string;
	// Sections, items, tags, and photos all take the next id, so ids are unique within the form.
	nextId: number;
};

// Where a problem shows: a field, a whole list, a section or its heading, an item, or a photo.
type ProblemTarget =
	| { kind: 'field'; field: RecipeFormErrorField }
	| { kind: 'list'; list: RecipeFormListName }
	| { kind: 'section' | 'heading' | 'item' | 'photo'; id: number };

// Keyed by the path a problem takes in the recipe content, such as ingredientSections.0.lines.2.
export type ProblemTargets = ReadonlyMap<string, ProblemTarget>;

// The value as sent, and where each of its problems shows.
export type RecipeFormSubmission = {
	payload: RecipeFormPayload;
	targets: ProblemTargets;
};

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
	// Adds each comma-separated tag in the text and clears the tag field.
	| { type: 'addTags'; text: string }
	| { type: 'removeTag'; tagId: number }
	// The photos take the next ids, in order.
	| { type: 'addPhotos'; role: RecipeImageRole; fileNames: readonly string[] }
	| { type: 'startPhotoUpload'; photoId: number; pathname: string; file: File }
	| { type: 'setPhotoProgress'; photoId: number; fraction: number }
	| { type: 'finishPhotoUpload'; photoId: number }
	| { type: 'failPhoto'; photoId: number; failure: PhotoFailure }
	| { type: 'removePhoto'; photoId: number }
	| { type: 'makeCoverPhoto'; photoId: number }
	| { type: 'setPhotoAlt'; photoId: number; alt: string }
	| { type: 'attachErrors'; fieldErrors: FieldErrors; targets: ProblemTargets }
	| { type: 'load'; values: RecipeFormValues };

// Each list's items, under the name the recipe content gives them.
const itemKeys = {
	ingredientSections: 'lines',
	instructionSections: 'steps',
} as const satisfies Record<RecipeFormListName, string>;

const photoRoles = ['dish', 'scan'] as const satisfies readonly RecipeImageRole[];

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
function filledText(text: string): string | undefined {
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

// A photo still being processed or uploaded, which saving must wait for.
export function isPhotoInProgress(photo: RecipeFormPhoto): boolean {
	return photo.upload.status === 'processing' || photo.upload.status === 'uploading';
}

export function hasPhotosInProgress(values: RecipeFormValues): boolean {
	return photoRoles.some((role) => values.photos[role].some(isPhotoInProgress));
}

// The pathname of a stored photo; one still uploading, or one that failed, has none to save.
function storedPathname({ upload }: RecipeFormPhoto): string | undefined {
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

function targetKey(target: ProblemTarget): string {
	switch (target.kind) {
		case 'field':
			return `field:${target.field}`;
		case 'list':
			return `list:${target.list}`;
		default:
			return `${target.kind}:${target.id}`;
	}
}

// Replaces every error in the form with these. The first problem for each target wins, and one
// that names nothing in the form shows as a problem with the whole recipe.
function withErrors(
	values: RecipeFormValues,
	fieldErrors: FieldErrors,
	targets: ProblemTargets
): RecipeFormValues {
	const messages = new Map<string, string>();
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
		} else if (!messages.has(targetKey(target))) {
			messages.set(targetKey(target), message);
		}
	}

	const errorFor = (target: ProblemTarget) => messages.get(targetKey(target));
	const listWithErrors = (list: RecipeFormListName): RecipeFormList => ({
		...values[list],
		error: errorFor({ kind: 'list', list }),
		sections: values[list].sections.map((section) => ({
			...section,
			headingError: errorFor({ kind: 'heading', id: section.id }),
			error: errorFor({ kind: 'section', id: section.id }),
			items: section.items.map((item) => ({
				...item,
				error: errorFor({ kind: 'item', id: item.id }),
			})),
		})),
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
// attach through the same paths a save's do, so they show from the start.
export function recipeFormValues(
	content?: RecipeContent | RecipeDraftContent,
	problems: readonly Problem[] = []
): RecipeFormValues {
	let nextId = 0;
	const newId = () => nextId++;
	const targets = new Map<string, ProblemTarget>();

	const listFrom = (
		list: RecipeFormListName,
		sections: readonly ContentSection[] | undefined
	): RecipeFormList => {
		if (sections === undefined || sections.length === 0) {
			return {
				sections: [{ id: newId(), heading: '', items: [{ id: newId(), text: '' }] }],
				showsHeadings: false,
			};
		}
		return {
			sections: sections.map((section, sectionIndex) => {
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
			}),
			showsHeadings:
				sections.length > 1 || sections.some((section) => section.heading !== undefined),
		};
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

	const values: RecipeFormValues = {
		text,
		yieldKind: recipeYield?.kind ?? 'servings',
		ingredientSections,
		instructionSections,
		tags,
		photos,
		fieldErrors: {},
		nextId,
	};
	return problems.length === 0 ? values : withErrors(values, fieldErrorsFrom(problems), targets);
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
function updatePhoto(
	values: RecipeFormValues,
	photoId: number,
	update: (photo: RecipeFormPhoto) => RecipeFormPhoto | undefined
): RecipeFormValues {
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
function updateUpload(
	values: RecipeFormValues,
	photoId: number,
	update: (upload: PhotoUpload) => PhotoUpload | undefined
): RecipeFormValues {
	return updatePhoto(values, photoId, (photo) => {
		const upload = update(photo.upload);
		return upload === undefined ? photo : { ...photo, upload };
	});
}

export function editRecipeForm(values: RecipeFormValues, edit: RecipeFormEdit): RecipeFormValues {
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
		case 'removeSection':
			// A list always keeps one section.
			if (values[edit.list].sections.length === 1) {
				return values;
			}
			return updateSections(values, edit.list, (sections) =>
				sections.filter((section) => section.id !== edit.sectionId)
			);
		case 'setHeading':
			return updateSection(values, edit.list, edit.sectionId, (section) => ({
				...section,
				heading: edit.heading,
			}));
		case 'addTags': {
			const labels = tagLabelsFrom(edit.text);
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
		case 'makeCoverPhoto': {
			const cover = values.photos.dish.find((photo) => photo.id === edit.photoId);
			if (cover === undefined) {
				return values;
			}
			const others = values.photos.dish.filter((photo) => photo.id !== edit.photoId);
			return { ...values, photos: { ...values.photos, dish: [cover, ...others] } };
		}
		case 'setPhotoAlt':
			return updatePhoto(values, edit.photoId, (photo) => ({ ...photo, alt: edit.alt }));
		case 'attachErrors':
			return withErrors(values, edit.fieldErrors, edit.targets);
		case 'load':
			return edit.values;
	}
}
