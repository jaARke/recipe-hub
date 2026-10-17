'use client';

import { cn } from 'cn';
import * as React from 'react';
import type * as RecipeImageViewerBodyModule from '@/components/recipe/recipe-image-viewer-body';
import { imageViewerLabels, viewImageLabel } from '@/components/recipe/recipe-image-viewer-labels';
import { RecipeImageViewerTitleBar } from '@/components/recipe/recipe-image-viewer-title-bar';
import type { ShownImage } from '@/components/recipe/shown-recipe-image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';

type RecipeImageViewerContextValue = {
	role: RecipeImageRole;
	images: readonly ShownImage[];
};

type RecipeImageViewerProps = RecipeImageViewerContextValue & {
	// Names the dialog.
	title: string;
	// The triggers, laid out by the caller.
	children: React.ReactNode;
};

type BodyImport = () => Promise<typeof RecipeImageViewerBodyModule>;

// Full screen in the page's own paper or ink, rather than a card over the page.
const viewerPopupClassName =
	'top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 text-foreground ring-0 sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100';

// A trigger fetches the body as a reader reaches for it: a hover, a focus, or a touch, which enters
// the trigger just before it presses.
const preloadOnApproach = {
	onPointerEnter: preloadRecipeImageViewerBody,
	onFocus: preloadRecipeImageViewerBody,
};

// The body brings the zoom and the carousel, which no page needs until a reader opens the viewer, so
// it loads as a chunk of its own.
const importBodyChunk: BodyImport = () => import('@/components/recipe/recipe-image-viewer-body');

let importBody = importBodyChunk;
let bodyModuleRequest: Promise<typeof RecipeImageViewerBodyModule> | undefined;

const RecipeImageViewerContext = React.createContext<RecipeImageViewerContextValue | null>(null);

// Asked for once, by whichever comes first: a trigger approached, the idle browser, or the viewer
// opening. A failed request is forgotten, so the next asks again.
function loadRecipeImageViewerBody(): Promise<typeof RecipeImageViewerBodyModule> {
	if (bodyModuleRequest === undefined) {
		const request = importBody().then(
			(module) => {
				// Marked settled the way React marks a promise it has seen settle, so use() renders the body
				// at once when the viewer opens after it arrived. next/dynamic and React.lazy suspend on each
				// page's first open however early the chunk came, and React then holds the fallback 300 ms.
				Object.assign(request, { status: 'fulfilled', value: module });
				return module;
			},
			(error: unknown) => {
				bodyModuleRequest = undefined;
				throw error;
			}
		);
		bodyModuleRequest = request;
	}
	return bodyModuleRequest;
}

// Fetches the body ahead of the viewer opening; a failure is the opening viewer's to report.
function preloadRecipeImageViewerBody() {
	loadRecipeImageViewerBody().catch(() => undefined);
}

// Fetches the body by the import given from now on, or the chunk's own without one, asking afresh.
// For tests, which hold the body back with it, since a browser cannot reset the modules it loaded.
function replaceRecipeImageViewerBodyImport(replacement: BodyImport = importBodyChunk) {
	importBody = replacement;
	bodyModuleRequest = undefined;
}

// Calls back once the page has loaded and the browser is next idle, unless cancelled first. A browser
// without idle callbacks calls back just after the load.
function whenIdleAfterLoad(callback: () => void): () => void {
	let cancel = () => {};
	const afterLoad = () => {
		if (typeof window.requestIdleCallback === 'function') {
			const handle = window.requestIdleCallback(callback);
			cancel = () => window.cancelIdleCallback(handle);
		} else {
			const handle = window.setTimeout(callback);
			cancel = () => window.clearTimeout(handle);
		}
	};
	if (document.readyState === 'complete') {
		afterLoad();
	} else {
		window.addEventListener('load', afterLoad, { once: true });
		cancel = () => window.removeEventListener('load', afterLoad);
	}
	return () => cancel();
}

function useRecipeImageViewer(): RecipeImageViewerContextValue {
	const context = React.useContext(RecipeImageViewerContext);
	if (context === null) {
		throw new Error('useRecipeImageViewer must be used within a <RecipeImageViewer />');
	}
	return context;
}

// The viewer opens on the body's button that moves on, or Close with one image. Opened before the
// body has arrived, it focuses the popup, and the button takes focus as the body arrives, unless the
// viewer has closed by then.
function useViewerInitialFocus() {
	const popupRef = React.useRef<HTMLDivElement>(null);
	const buttonRef = React.useRef<HTMLButtonElement | null>(null);
	// From an opening without the button until the button arrives or the viewer closes.
	const focusOwedRef = React.useRef(false);

	// Base UI asks as the viewer opens.
	const initialFocus = React.useCallback(() => {
		focusOwedRef.current = buttonRef.current === null;
		return buttonRef.current ?? popupRef.current;
	}, []);

	const initialFocusRef = React.useCallback((button: HTMLButtonElement | null) => {
		buttonRef.current = button;
		if (button !== null && focusOwedRef.current) {
			focusOwedRef.current = false;
			button.focus();
		}
	}, []);

	const onOpenChange = React.useCallback((open: boolean) => {
		if (!open) {
			focusOwedRef.current = false;
		}
	}, []);

	return { popupRef, initialFocus, initialFocusRef, onOpenChange };
}

// Every image whole, one at a time, full screen and zoomable; a trigger's payload is the index the
// viewer opens at.
function RecipeImageViewer({ role, images, title, children }: RecipeImageViewerProps) {
	const context = React.useMemo(() => ({ role, images }), [role, images]);
	const { popupRef, initialFocus, initialFocusRef, onOpenChange } = useViewerInitialFocus();

	React.useEffect(() => whenIdleAfterLoad(preloadRecipeImageViewerBody), []);

	return (
		<RecipeImageViewerContext.Provider value={context}>
			<Dialog onOpenChange={onOpenChange}>
				{({ payload }) => {
					const startIndex = typeof payload === 'number' ? payload : 0;
					return (
						<>
							{children}
							<DialogContent
								ref={popupRef}
								initialFocus={initialFocus}
								showCloseButton={false}
								className={viewerPopupClassName}
							>
								<React.Suspense
									fallback={
										<RecipeImageViewerLoading
											role={role}
											title={title}
											index={startIndex}
											count={images.length}
										/>
									}
								>
									<LoadedRecipeImageViewerBody
										role={role}
										images={images}
										title={title}
										startIndex={startIndex}
										initialFocusRef={initialFocusRef}
									/>
								</React.Suspense>
							</DialogContent>
						</>
					);
				}}
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
			{...preloadOnApproach}
			className={cn(
				'block cursor-zoom-in overflow-hidden transition-shadow hover:shadow-md',
				className
			)}
		>
			{children}
		</DialogTrigger>
	);
}

// Opens the viewer at its first image, named by its own text, such as "View original".
function RecipeImageViewerButton({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<DialogTrigger
			payload={0}
			{...preloadOnApproach}
			render={<Button variant="outline" className={className} />}
		>
			{children}
		</DialogTrigger>
	);
}

// The body at once when it has arrived, or suspended until it does.
function LoadedRecipeImageViewerBody(
	props: RecipeImageViewerBodyModule.RecipeImageViewerBodyProps
) {
	const body = React.use(loadRecipeImageViewerBody());
	return <body.RecipeImageViewerBody {...props} />;
}

// While the body is on its way: the title bar as the body shows it, with Close but without the
// controls the body brings, over a spinner. The popup keeps focus, which the body's button takes as
// it arrives.
function RecipeImageViewerLoading({
	role,
	title,
	index,
	count,
}: {
	role: RecipeImageRole;
	title: string;
	index: number;
	count: number;
}) {
	return (
		<>
			<RecipeImageViewerTitleBar role={role} title={title} index={index} count={count} />
			<div className="flex flex-1 items-center justify-center">
				<Spinner
					aria-label={imageViewerLabels(role).loading}
					className="size-6 text-muted-foreground"
				/>
			</div>
		</>
	);
}

export {
	RecipeImageViewer,
	RecipeImageViewerButton,
	RecipeImageViewerTrigger,
	replaceRecipeImageViewerBodyImport,
};
