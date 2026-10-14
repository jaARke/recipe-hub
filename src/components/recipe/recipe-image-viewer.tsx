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

// Each role's slide shape, narrowed on a short screen so the slide is at most the screen's height less
// 12rem: the dialog's margin and padding, its title, and a one-line caption beside Previous and Next.
const viewerSlideClasses = {
	dish: 'aspect-4/3 max-w-[calc((100dvh-12rem)*4/3)]',
	scan: 'aspect-3/4 max-w-[calc((100dvh-12rem)*3/4)]',
} as const satisfies Record<RecipeImageRole, string>;

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
	const popupRef = React.useRef<HTMLDivElement>(null);
	// The carousel button the viewer opens on; with one image there is none, and Close takes focus.
	const initialFocusRef = React.useRef<HTMLButtonElement>(null);

	return (
		<RecipeImageViewerContext.Provider value={context}>
			<Dialog>
				{({ payload }) => (
					<>
						{children}
						{/* At most the screen's height less a margin, like its width; the slide shrinks to fit, so
						only a caption longer than a line makes it scroll. */}
						<DialogContent
							ref={popupRef}
							initialFocus={initialFocusRef}
							className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
						>
							{/* Clears the close button in the corner. */}
							<DialogHeader className="pr-8">
								<DialogTitle>{title}</DialogTitle>
							</DialogHeader>
							<RecipeImageCarousel
								role={role}
								images={images}
								startIndex={typeof payload === 'number' ? payload : 0}
								popupRef={popupRef}
								initialFocusRef={initialFocusRef}
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
			className={cn('block overflow-hidden transition-shadow hover:shadow-md', className)}
		>
			{children}
		</DialogTrigger>
	);
}

type InitialFocusProps = {
	startIndex: number;
	initialFocusRef: React.RefObject<HTMLButtonElement | null>;
};

type RecipeImageCarouselProps = RecipeImageViewerContextValue &
	InitialFocusProps & {
		// The viewer's popup, which takes the arrow keys the carousel does not.
		popupRef: React.RefObject<HTMLDivElement | null>;
	};

function RecipeImageCarousel({
	role,
	images,
	startIndex,
	popupRef,
	initialFocusRef,
}: RecipeImageCarouselProps) {
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

	// The carousel takes arrow keys only while it holds focus, so the rest of the viewer, such as Close,
	// takes them here. The popup stops arrow keys from bubbling past it, and those the carousel handled
	// arrive default-prevented.
	React.useEffect(() => {
		const popup = popupRef.current;
		if (api === undefined || popup === null) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) {
				return;
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				api.scrollPrev();
			} else if (event.key === 'ArrowRight') {
				event.preventDefault();
				api.scrollNext();
			}
		};
		popup.addEventListener('keydown', onKeyDown);
		return () => {
			popup.removeEventListener('keydown', onKeyDown);
		};
	}, [api, popupRef]);

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
								className={cn('mx-auto rounded-md', viewerSlideClasses.dish)}
							/>
						) : (
							<RecipeScanImage
								pathname={image.pathname}
								alt={image.alt ?? ''}
								className={cn('mx-auto rounded-md', viewerSlideClasses.scan)}
							/>
						)}
					</CarouselItem>
				))}
			</CarouselContent>
			<RecipeImageCaption
				role={role}
				images={images}
				index={current}
				startIndex={startIndex}
				initialFocusRef={initialFocusRef}
			/>
		</Carousel>
	);
}

// The current image's description and place, announced as it changes, beside Previous and Next.
function RecipeImageCaption({
	role,
	images,
	index,
	startIndex,
	initialFocusRef,
}: RecipeImageViewerContextValue & InitialFocusProps & { index: number }) {
	const alt = images[index]?.alt;
	if (images.length === 1) {
		return alt === undefined ? null : <p>{alt}</p>;
	}

	const labels = imageViewerLabels(role);
	// The viewer opens on the button that moves on rather than a disabled one: Next, or Previous from
	// the last image.
	const opensOnNext = startIndex < images.length - 1;
	return (
		<div className="flex items-start justify-between gap-4">
			<div role="status" aria-live="polite" className="flex min-w-0 flex-col gap-1">
				{alt !== undefined && <p>{alt}</p>}
				<p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
					{imagePositionLabel(role, index, images.length)}
				</p>
			</div>
			<div className="flex shrink-0 gap-2">
				{/* Below the image rather than beside it, 44 px for a finger, and focusable at either end so
				focus stays put. */}
				<CarouselPrevious
					ref={opensOnNext ? undefined : initialFocusRef}
					className="static pointer-coarse:size-11"
					aria-label={labels.previous}
					focusableWhenDisabled
				/>
				<CarouselNext
					ref={opensOnNext ? initialFocusRef : undefined}
					className="static pointer-coarse:size-11"
					aria-label={labels.next}
					focusableWhenDisabled
				/>
			</div>
		</div>
	);
}

export { RecipeImageViewer, RecipeImageViewerTrigger };
