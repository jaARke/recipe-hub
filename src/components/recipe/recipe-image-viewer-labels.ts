import type { RecipeImageRole } from '@/domain/recipe/recipe-image';
import { sentenceCase } from '@/domain/text';

type ImageViewerLabels = {
	// Names the carousel region.
	region: string;
	previous: string;
	next: string;
	// Names the spinner while the viewer loads.
	loading: string;
	// Names a description long enough to scroll.
	description: string;
};

// A dish photo is a photo; a scan is a page of the recipe as first written.
const imageViewerWording = {
	dish: { item: 'photo', items: 'photos' },
	scan: { item: 'page', items: 'pages' },
} as const satisfies Record<RecipeImageRole, { item: string; items: string }>;

export function imageViewerLabels(role: RecipeImageRole): ImageViewerLabels {
	const { item, items } = imageViewerWording[role];
	return {
		region: sentenceCase(items),
		previous: `Previous ${item}`,
		next: `Next ${item}`,
		loading: `Loading the ${items}`,
		description: `${sentenceCase(item)} description`,
	};
}

// "Photo 2 of 4", counting from one.
export function imagePositionLabel(role: RecipeImageRole, index: number, count: number): string {
	return `${sentenceCase(imageViewerWording[role].item)} ${index + 1} of ${count}`;
}

// Names a thumbnail that shows its image: "Show photo 2 of 4".
export function showImageLabel(role: RecipeImageRole, index: number, count: number): string {
	return `Show ${imageViewerWording[role].item} ${index + 1} of ${count}`;
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
