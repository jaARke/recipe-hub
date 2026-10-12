'use client';

import { cn } from 'cn';
import * as React from 'react';
import {
	imagePositionLabel,
	imageViewerLabels,
	viewImageLabel,
} from '@/components/recipe/recipe-image-viewer-labels';
import { RecipePhoto, RecipeScanImage } from '@/components/recipe/recipe-photo';
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
	type CarouselApi,
} from '@/components/ui/carousel';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import type { RecipeImage, RecipeImageRole } from '@/domain/recipe/recipe-image';

type RecipeImageViewerContextValue = {
	role: RecipeImageRole;
	images: readonly RecipeImage[];
};

type RecipeImageViewerProps = RecipeImageViewerContextValue & {
	// Names the dialog.
	title: string;
	// The triggers, laid out by the caller.
	children: React.ReactNode;
};

// The dialog is at most 42rem wide with 1.5rem of padding on each side.
const viewerPhotoSizes = '(min-width: 704px) 624px, calc(100vw - 80px)';

const RecipeImageViewerContext = React.createContext<RecipeImageViewerContextValue | null>(null);

function useRecipeImageViewer(): RecipeImageViewerContextValue {
	const context = React.useContext(RecipeImageViewerContext);
	if (context === null) {
		throw new Error('useRecipeImageViewer must be used within a <RecipeImageViewer />');
	}
	return context;
}

// Every image whole, one at a time; a trigger's payload is the index the viewer opens at.
function RecipeImageViewer({ role, images, title, children }: RecipeImageViewerProps) {
	const context = React.useMemo(() => ({ role, images }), [role, images]);

	return (
		<RecipeImageViewerContext.Provider value={context}>
			<Dialog>
				{({ payload }) => (
					<>
						{children}
						{/* Scrolls on a screen too short for the photo and its caption, such as a phone on its side. */}
						<DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
							{/* Clears the close button in the corner. */}
							<DialogHeader className="pr-8">
								<DialogTitle>{title}</DialogTitle>
							</DialogHeader>
							<RecipeImageCarousel
								role={role}
								images={images}
								startIndex={typeof payload === 'number' ? payload : 0}
							/>
						</DialogContent>
					</>
				)}
			</Dialog>
		</RecipeImageViewerContext.Provider>
	);
}

// Opens the viewer at one image. The caller sizes and rounds it around the image it holds.
function RecipeImageViewerTrigger({
	index,
	className,
	children,
}: {
	index: number;
	className: string;
	children: React.ReactNode;
}) {
	const { role, images } = useRecipeImageViewer();

	return (
		<DialogTrigger
			payload={index}
			aria-label={viewImageLabel(role, index, images.length, images[index]?.alt)}
			className={cn(
				// The links' focus treatment, which the base styles give anchors only.
				'block overflow-hidden transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1',
				className
			)}
		>
			{children}
		</DialogTrigger>
	);
}

function RecipeImageCarousel({
	role,
	images,
	startIndex,
}: RecipeImageViewerContextValue & { startIndex: number }) {
	const labels = imageViewerLabels(role);
	const [api, setApi] = React.useState<CarouselApi>();
	const [current, setCurrent] = React.useState(startIndex);

	React.useEffect(() => {
		if (api === undefined) {
			return;
		}
		const onSelect = () => setCurrent(api.selectedScrollSnap());
		api.on('select', onSelect);
		return () => {
			api.off('select', onSelect);
		};
	}, [api]);

	return (
		<Carousel
			opts={{ startIndex }}
			setApi={setApi}
			aria-label={labels.region}
			className="flex flex-col gap-4"
		>
			<CarouselContent>
				{images.map((image, index) => (
					// Only the current image is read, as its caption says; the others are off to the sides.
					<CarouselItem
						key={image.pathname}
						aria-label={imagePositionLabel(role, index, images.length)}
						aria-hidden={index !== current}
					>
						{role === 'dish' ? (
							<RecipePhoto
								pathname={image.pathname}
								alt={image.alt ?? ''}
								sizes={viewerPhotoSizes}
								fit="contain"
								className="aspect-4/3 rounded-md"
							/>
						) : (
							<RecipeScanImage
								pathname={image.pathname}
								alt={image.alt ?? ''}
								className="aspect-4/3 rounded-md"
							/>
						)}
					</CarouselItem>
				))}
			</CarouselContent>
			<RecipeImageCaption role={role} images={images} index={current} />
		</Carousel>
	);
}

// The current image's description and place, announced as it changes, beside Previous and Next.
function RecipeImageCaption({
	role,
	images,
	index,
}: RecipeImageViewerContextValue & { index: number }) {
	const alt = images[index]?.alt;
	if (images.length === 1) {
		return alt === undefined ? null : <p>{alt}</p>;
	}

	const labels = imageViewerLabels(role);
	return (
		<div className="flex items-start justify-between gap-4">
			<div role="status" className="flex min-w-0 flex-col gap-1">
				{alt !== undefined && <p>{alt}</p>}
				<p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
					{imagePositionLabel(role, index, images.length)}
				</p>
			</div>
			<div className="flex shrink-0 gap-2">
				{/* Below the image rather than beside it, and focusable at either end so focus stays put. */}
				<CarouselPrevious className="static" aria-label={labels.previous} focusableWhenDisabled />
				<CarouselNext className="static" aria-label={labels.next} focusableWhenDisabled />
			</div>
		</div>
	);
}

export { RecipeImageViewer, RecipeImageViewerTrigger };
