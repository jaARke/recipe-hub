'use client';

import { cn } from 'cn';
import { MinusIcon, PlusIcon, ScanIcon } from 'lucide-react';
import * as React from 'react';
import {
	TransformComponent,
	TransformWrapper,
	type ReactZoomPanPinchContentRef,
} from 'react-zoom-pan-pinch';
import { imageFit, imageShape } from '@/components/recipe/recipe-image-shape';
import { ShownRecipeImage, type ShownImage } from '@/components/recipe/shown-recipe-image';
import { Button } from '@/components/ui/button';
import type { ImageSize } from '@/domain/recipe/recipe-image';
import { prefersReducedMotion, subscribeToReducedMotion } from '@/lib/reduced-motion';

// One image's zoom, which the buttons and keys around it drive.
export type ImageZoom = ReactZoomPanPinchContentRef;

// A frame's width and height on screen, as CSS lengths, so its image is fetched at the size it shows.
export type ZoomFrameSize = { width: string; height: string };

// Scales are of the image whole in its frame, which is 100%.
const maxZoomScale = 5;
// What the buttons and + and − add or take away.
const zoomStep = 0.5;
// A double tap or click zooms from whole to 250% at the point, and back.
const doubleTapZoomStep = 1.5;
// Above this the image is zoomed: a drag pans it rather than swiping to the next image.
const zoomedAboveScale = 1.01;
// How far an arrow key pans a zoomed image, in pixels.
const keyPanPixels = 80;
// How long a button's, key's, or double click's zoom or pan takes, unless motion is reduced.
const zoomAnimationMilliseconds = 200;

// An arrow moves the view, as scrolling does, so the image moves the other way.
const keyPans: Partial<Record<string, { x: number; y: number }>> = {
	ArrowLeft: { x: keyPanPixels, y: 0 },
	ArrowRight: { x: -keyPanPixels, y: 0 },
	ArrowUp: { x: 0, y: keyPanPixels },
	ArrowDown: { x: 0, y: -keyPanPixels },
};

// Describes the frame's keys to a screen reader; anyone else has the buttons and gestures.
const zoomKeysHint = 'Plus and minus zoom, and 0 fits. While zoomed, the arrow keys pan.';

function useReducedMotion(): boolean {
	return React.useSyncExternalStore(subscribeToReducedMotion, prefersReducedMotion, () => false);
}

function zoomAnimationTime(): number {
	return prefersReducedMotion() ? 0 : zoomAnimationMilliseconds;
}

// Read as it is now, for a gesture or key that must know before React renders.
function isZoomed(zoom: ImageZoom | null): boolean {
	return zoom !== null && zoom.instance.state.scale > zoomedAboveScale;
}

function useZoomScale(zoom: ImageZoom | null): number {
	const subscribe = React.useCallback(
		(onChange: () => void) => (zoom === null ? () => undefined : zoom.instance.onChange(onChange)),
		[zoom]
	);
	return React.useSyncExternalStore(
		subscribe,
		() => zoom?.instance.state.scale ?? 1,
		() => 1
	);
}

// The zoom's keys, wherever the caller takes them: + and − zoom, 0 fits, and the arrows pan a
// zoomed image. True when the key was the zoom's; the arrows are the caller's while the image is
// whole. A held key starts each step from wherever the last has reached, so it zooms or pans on
// smoothly.
function handleZoomKey(zoom: ImageZoom | null, event: React.KeyboardEvent): boolean {
	// Ctrl or Cmd with + and − zooms the page, as the browser has it.
	if (zoom === null || event.altKey || event.ctrlKey || event.metaKey) {
		return false;
	}
	const time = zoomAnimationTime();
	switch (event.key) {
		case '+':
		case '=':
			void zoom.zoomIn(zoomStep, time);
			return true;
		case '-':
		case '_':
			void zoom.zoomOut(zoomStep, time);
			return true;
		case '0':
			void zoom.resetTransform(time);
			return true;
	}
	const pan = keyPans[event.key];
	if (pan === undefined || !isZoomed(zoom)) {
		return false;
	}
	void zoom.panBy(pan.x, pan.y, time);
	return true;
}

// The box an image fills whole in its frame, which is a size container: as wide as the frame allows,
// or as tall. It is the image at 100%, which the zoom scales.
function containedBoxStyle({ width, height }: ImageSize): React.CSSProperties {
	return {
		width: `min(100cqw, 100cqh * ${width} / ${height})`,
		height: `min(100cqh, 100cqw * ${height} / ${width})`,
	};
}

// The image's width whole in its frame, times its zoom rounded up, so a zoomed image is fetched
// sharp enough without asking for a new size at every step of a pinch.
function zoomedImageSizes(
	frame: ZoomFrameSize,
	{ width, height }: ImageSize,
	scale: number
): string {
	return `min(${scale} * (${frame.width}), ${scale} * (${frame.height}) * ${width} / ${height})`;
}

// The library's stylesheet sizes its frame to its content and is not in a layer, so it outranks the
// utilities; these inline styles fill the caller's box instead.
const frameStyle: React.CSSProperties = { width: '100%', height: '100%', containerType: 'size' };

type ZoomableRecipeImageProps = {
	image: ShownImage;
	alt: string;
	// Names the frame, which takes focus for the zoom's keys.
	label: string;
	frame: ZoomFrameSize;
	// False for a slide off to the side, which takes no gestures and is whole when it next shows.
	active?: boolean;
	// Given the zoom once the image is laid out, for the controls around it.
	zoomRef?: React.Ref<ImageZoom>;
	// The frame's look; the caller's box sizes it.
	className?: string;
	imageClassName?: string;
};

// An image whole in its frame that zooms and pans: pinch, Ctrl or Cmd with the wheel or a trackpad's
// pinch toward the pointer, a double tap or click to 250% at the point and back, and a drag or a
// trackpad's scroll to pan while zoomed. Whole, a drag is the caller's, such as a carousel's swipe.
function ZoomableRecipeImage({
	image,
	alt,
	label,
	frame,
	active = true,
	zoomRef,
	className,
	imageClassName,
}: ZoomableRecipeImageProps) {
	const ownZoomRef = React.useRef<ImageZoom | null>(null);
	const [zoomed, setZoomed] = React.useState(false);
	// The zoom the image is fetched for, in whole steps.
	const [fetchedScale, setFetchedScale] = React.useState(1);
	const reducedMotion = useReducedMotion();
	const hintId = React.useId();
	const shape = imageShape(image.size);

	// Whole again when it shows another image, or goes off to the side. Animated, which also stops a
	// zoom still under way, as a change at once would not.
	React.useEffect(() => {
		void ownZoomRef.current?.resetTransform(zoomAnimationTime());
	}, [active, image.pathname]);

	return (
		<TransformWrapper
			ref={zoomRef}
			disabled={!active}
			maxScale={maxZoomScale}
			centerOnInit
			centerZoomedOut
			// A wheel scrolls the page unless Ctrl or Cmd is held; a trackpad's pinch reads as Ctrl.
			wheel={{ activationKeys: (keys) => keys.includes('Control') || keys.includes('Meta') }}
			trackPadPanning={{ disabled: !zoomed }}
			panning={{ disabled: !zoomed, velocityDisabled: reducedMotion }}
			doubleClick={
				zoomed
					? { mode: 'reset', animationTime: reducedMotion ? 0 : zoomAnimationMilliseconds }
					: {
							mode: 'zoomIn',
							step: doubleTapZoomStep,
							animationTime: reducedMotion ? 0 : zoomAnimationMilliseconds,
						}
			}
			zoomAnimation={{ disabled: reducedMotion }}
			autoAlignment={{ disabled: reducedMotion }}
			velocityAnimation={{ disabled: reducedMotion }}
			onInit={(zoom) => {
				ownZoomRef.current = zoom;
			}}
			onTransform={(_zoom, { scale }) => {
				setZoomed(scale > zoomedAboveScale);
				setFetchedScale(Math.max(1, Math.ceil(scale - 0.01)));
			}}
		>
			<TransformComponent
				wrapperClass={cn(
					'touch-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
					zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
					className
				)}
				wrapperStyle={frameStyle}
				wrapperProps={{
					role: 'group',
					'aria-label': label,
					'aria-describedby': hintId,
					tabIndex: active ? 0 : -1,
				}}
				contentStyle={containedBoxStyle(shape)}
			>
				<ShownRecipeImage
					image={image}
					alt={alt}
					sizes={zoomedImageSizes(frame, shape, fetchedScale)}
					fit={imageFit(image.size)}
					className={cn('size-full', imageClassName)}
				/>
			</TransformComponent>
			<span id={hintId} hidden>
				{zoomKeysHint}
			</span>
		</TransformWrapper>
	);
}

// Zoom out, the zoom as a percentage, zoom in, and fit; 44 px under a finger.
function RecipeImageZoomControls({
	zoom,
	className,
}: {
	zoom: ImageZoom | null;
	className?: string;
}) {
	const scale = useZoomScale(zoom);
	const zoomed = scale > zoomedAboveScale;

	return (
		<div role="group" aria-label="Zoom" className={cn('items-center', className)}>
			<Button
				variant="ghost"
				size="icon"
				className="pointer-coarse:size-11"
				aria-label="Zoom out"
				disabled={!zoomed}
				focusableWhenDisabled
				onClick={() => void zoom?.zoomOut(zoomStep, zoomAnimationTime())}
			>
				<MinusIcon aria-hidden="true" />
			</Button>
			<span aria-hidden="true" className="w-12 text-center text-sm tabular-nums">
				{Math.round(scale * 100)}%
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="pointer-coarse:size-11"
				aria-label="Zoom in"
				disabled={scale >= maxZoomScale}
				focusableWhenDisabled
				onClick={() => void zoom?.zoomIn(zoomStep, zoomAnimationTime())}
			>
				<PlusIcon aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="pointer-coarse:size-11"
				aria-label="Fit the whole image"
				disabled={!zoomed}
				focusableWhenDisabled
				onClick={() => void zoom?.resetTransform(zoomAnimationTime())}
			>
				<ScanIcon aria-hidden="true" />
			</Button>
		</div>
	);
}

export { handleZoomKey, isZoomed, RecipeImageZoomControls, ZoomableRecipeImage };
