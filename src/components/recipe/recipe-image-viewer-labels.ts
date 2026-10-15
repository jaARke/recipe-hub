import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import { sentenceCase } from '@/domain/text';

type ImageViewerLabels = {
	// Names the carousel region.
	region: string;
	previous: string;
	next: string;
};

// A dish photo is a photo; a scan is a page of the recipe as first written.
const imageViewerWording = {
	dish: { item: 'photo', items: 'photos' },
	scan: { item: 'page', items: 'pages' },
} as const satisfies Record<RecipeImageRole, { item: string; items: string }>;

export function imageViewerLabels(role: RecipeImageRole): ImageViewerLabels {
	const { item, items } = imageViewerWording[role];
	return { region: sentenceCase(items), previous: `Previous ${item}`, next: `Next ${item}` };
}

// "Photo 2 of 4", counting from one.
export function imagePositionLabel(role: RecipeImageRole, index: number, count: number): string {
	return `${sentenceCase(imageViewerWording[role].item)} ${index + 1} of ${count}`;
}

// Names the control that opens the viewer at an image, with the image's description when it has one.
export function viewImageLabel(
	role: RecipeImageRole,
	index: number,
	count: number,
	alt: string | undefined
): string {
	const { item } = imageViewerWording[role];
	const label = count === 1 ? `View ${item}` : `View ${item} ${index + 1} of ${count}`;
	return alt === undefined ? label : `${label}: ${alt}`;
}
