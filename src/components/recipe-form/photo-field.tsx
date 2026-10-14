'use client';

import {
	ArrowDownIcon,
	ArrowUpIcon,
	CircleAlertIcon,
	ImagePlusIcon,
	StarIcon,
	type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { describedBy } from '@/components/forms/described-by';
import { FieldNote, type FieldNoteContent } from '@/components/forms/field-note';
import { FieldProblem } from '@/components/forms/problem-summary';
import { ItemActionsMenu, type ItemAction } from '@/components/recipe-form/item-actions-menu';
import { normalizePhoto, UnreadablePhotoError } from '@/components/recipe-form/photo-processing';
import { newPhotoPathname, type PhotoUploader } from '@/components/recipe-form/photo-upload';
import {
	filledText,
	type PhotoEdit,
	type PhotoFailure,
	type ProblemTarget,
	type RecipeFormPhoto,
} from '@/components/recipe-form/recipe-form-values';
import { describePositionMove, itemName } from '@/components/recipe-form/sectioned-list';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
} from '@/components/recipe/recipe-image-viewer';
import { RecipePhoto, RecipeScanImage } from '@/components/recipe/recipe-photo';
import {
	Attachment,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
} from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
} from '@/components/ui/empty';
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import type { RecipeImage, RecipeImageRole } from '@/domain/recipe/recipe-image';

const failureMessages: Record<PhotoFailure, string> = {
	unreadable: 'This browser can’t read this photo. Try Safari, or save it as a JPEG first.',
	upload: 'This photo didn’t upload. Remove it and add it again.',
};

type PhotoFieldProps = {
	// Starts every id in the field, so the form can link to its problems.
	idPrefix: string;
	role: RecipeImageRole;
	legend: string;
	description: string;
	// The most photos the field takes: a recipe's limit for the role, or fewer, as an import reads.
	limit: number;
	photos: readonly RecipeFormPhoto[];
	// The id the form gives the next photo it adds.
	nextId: number;
	dispatch: React.Dispatch<PhotoEdit>;
	// Where this environment keeps new photos of this role.
	uploadFolder: string;
	uploader: PhotoUploader;
	// About the photos together, such as too many pages to read at once.
	error?: string;
	// The note on each photo to check, as when reviewing a draft.
	noteFor?: (target: ProblemTarget) => FieldNoteContent | undefined;
};

// The ids of the field's parts, which the form's problem summary links to, and where the form
// moves focus from note to note.
function photoFieldIds(prefix: string) {
	return {
		description: `${prefix}-description`,
		error: `${prefix}-error`,
		choose: `${prefix}-choose`,
		limit: `${prefix}-limit`,
		actions: (photoId: number) => `${prefix}-photo-${photoId}-actions`,
		alt: (photoId: number) => `${prefix}-photo-${photoId}-alt`,
		photoError: (photoId: number) => `${prefix}-photo-${photoId}-error`,
		photoNote: (photoId: number) => `${prefix}-photo-${photoId}-note`,
	};
}

function countPhotos(count: number) {
	return `${count} ${count === 1 ? 'photo' : 'photos'}`;
}

// Text and links can be dragged too; only drags that carry files concern the drop area.
function carriesFiles(event: React.DragEvent) {
	return event.dataTransfer.types.includes('Files');
}

// The chosen file's name, or the photo's place for one the recipe already has. Scans are the pages
// of the original recipe, so their names never repeat a dish photo's.
function photoName(photo: RecipeFormPhoto, index: number, role: RecipeImageRole): string {
	return photo.fileName ?? `${role === 'dish' ? 'Photo' : 'Page'} ${index + 1}`;
}

function attachmentState(photo: RecipeFormPhoto) {
	switch (photo.upload.status) {
		case 'processing':
			return 'processing';
		case 'uploading':
			return 'uploading';
		case 'failed':
			return 'error';
		case 'uploaded':
		case 'saved':
			return 'done';
	}
}

function photoStatus(photo: RecipeFormPhoto, isCover: boolean): string | undefined {
	switch (photo.upload.status) {
		case 'processing':
			return 'Preparing';
		case 'uploading':
			return 'Uploading';
		case 'failed':
			return photo.upload.failure === 'unreadable' ? 'Can’t read this photo' : 'Didn’t upload';
		case 'uploaded':
			return isCover ? 'Cover photo' : 'Uploaded';
		case 'saved':
			return isCover ? 'Cover photo' : undefined;
	}
}

// Made here rather than on choosing, so the URL is revoked whenever the thumbnail unmounts or its
// page is hidden, and made again when it shows.
function LocalPhotoThumbnail({ file }: { file: File }) {
	const imageRef = React.useRef<HTMLImageElement>(null);

	React.useEffect(() => {
		const image = imageRef.current;
		if (image === null) {
			return;
		}
		const url = URL.createObjectURL(file);
		image.src = url;
		return () => URL.revokeObjectURL(url);
	}, [file]);

	// next/image needs its source at render time; this one is made and revoked in the effect.
	// eslint-disable-next-line @next/next/no-img-element
	return <img ref={imageRef} alt="" />;
}

// The title beside it names the photo, so the thumbnail is decorative; a saved photo's is a button that
// opens the viewer, which names it.
function PhotoThumbnail({
	photo,
	role,
	viewerImages,
}: {
	photo: RecipeFormPhoto;
	role: RecipeImageRole;
	viewerImages: readonly RecipeImage[];
}) {
	const { upload } = photo;
	switch (upload.status) {
		case 'processing':
			return (
				<AttachmentMedia>
					<Spinner aria-hidden="true" />
				</AttachmentMedia>
			);
		case 'failed':
			return (
				<AttachmentMedia>
					<CircleAlertIcon aria-hidden="true" />
				</AttachmentMedia>
			);
		case 'uploading':
		case 'uploaded':
			return (
				<AttachmentMedia variant="image">
					<LocalPhotoThumbnail file={upload.file} />
				</AttachmentMedia>
			);
		case 'saved':
			// The button rounds and clips the photo itself, so its focus ring draws outside the thumbnail.
			return (
				<AttachmentMedia variant="image" className="overflow-visible">
					<RecipeImageViewerTrigger
						index={viewerImages.findIndex((image) => image.pathname === upload.pathname)}
						className="size-full rounded-lg"
					>
						{role === 'dish' ? (
							<RecipePhoto
								pathname={upload.pathname}
								alt=""
								sizes="40px"
								loading="lazy"
								className="size-full"
							/>
						) : (
							<RecipeScanImage
								pathname={upload.pathname}
								alt=""
								loading="lazy"
								fit="cover"
								className="size-full"
							/>
						)}
					</RecipeImageViewerTrigger>
				</AttachmentMedia>
			);
	}
}

// Photos of one role: a drop area and a button to choose them, then each photo with its progress.
// Every chosen photo is resized and re-encoded in the browser, then uploaded straight to storage.
function PhotoField({
	idPrefix,
	role,
	legend,
	description,
	limit,
	photos,
	nextId,
	dispatch,
	uploadFolder,
	uploader,
	error,
	noteFor,
}: PhotoFieldProps) {
	const inputRef = React.useRef<HTMLInputElement>(null);
	// Children fire their own enter and leave events; the depth tells a real leave from a move onto a child.
	const dragDepth = React.useRef(0);
	const [isDragging, setIsDragging] = React.useState(false);
	const [announcement, setAnnouncement] = React.useState('');
	// One for each photo still processing or uploading, so removing it or leaving the page stops it.
	const uploadsRef = React.useRef(new Map<number, AbortController>());
	const ids = photoFieldIds(idPrefix);
	const isFull = photos.length >= limit;
	const limitMessage = `You can add up to ${limit} photos here. Remove one to add another.`;
	// Saved photos open the viewer, so the member can see one larger or read the original while checking
	// the form; a new photo shows only its thumbnail. A dish photo shows its description as it will be
	// saved, and a scan saves none.
	const viewerImages: RecipeImage[] = photos.flatMap(({ upload, alt }) =>
		upload.status === 'saved'
			? [
					{
						role,
						pathname: upload.pathname,
						alt: role === 'dish' ? filledText(alt) : undefined,
					},
				]
			: []
	);

	React.useEffect(() => {
		const uploads = uploadsRef.current;
		return () => {
			for (const [photoId, controller] of uploads) {
				controller.abort();
				// A hidden page keeps its state, so the photo shows it never finished.
				dispatch({ type: 'failPhoto', photoId, failure: 'upload' });
			}
			uploads.clear();
		};
	}, [dispatch]);

	async function processPhoto(photoId: number, file: File) {
		const controller = new AbortController();
		const uploads = uploadsRef.current;
		uploads.set(photoId, controller);
		try {
			const photo = await normalizePhoto(file, role);
			if (controller.signal.aborted) {
				return;
			}
			const pathname = newPhotoPathname(uploadFolder);
			dispatch({ type: 'startPhotoUpload', photoId, pathname, file: photo.file });
			await uploader(pathname, photo.file, {
				signal: controller.signal,
				onProgress: (fraction) => dispatch({ type: 'setPhotoProgress', photoId, fraction }),
			});
			if (controller.signal.aborted) {
				return;
			}
			dispatch({ type: 'finishPhotoUpload', photoId });
			setAnnouncement(`Uploaded ${file.name}.`);
		} catch (error) {
			// A cancelled upload can fail with any error, so the signal is what tells.
			if (controller.signal.aborted) {
				return;
			}
			const failure = error instanceof UnreadablePhotoError ? 'unreadable' : 'upload';
			dispatch({ type: 'failPhoto', photoId, failure });
			setAnnouncement(`${file.name}: ${failureMessages[failure]}`);
		} finally {
			uploads.delete(photoId);
		}
	}

	// Photos past the limit are left out, and the announcement says so.
	function addFiles(files: readonly File[]) {
		if (files.length === 0) {
			return;
		}
		const added = files.slice(0, Math.max(limit - photos.length, 0));
		const leftOut = files.length - added.length;
		if (added.length > 0) {
			dispatch({ type: 'addPhotos', role, fileNames: added.map((file) => file.name) });
			added.forEach((file, index) => void processPhoto(nextId + index, file));
		}
		const sentences = [
			added.length > 0 && `Added ${countPhotos(added.length)}.`,
			leftOut > 0 && `${countPhotos(leftOut)} didn’t fit. ${limitMessage}`,
		];
		setAnnouncement(sentences.filter((sentence) => typeof sentence === 'string').join(' '));
	}

	function removePhoto(photo: RecipeFormPhoto, index: number) {
		uploadsRef.current.get(photo.id)?.abort();
		const neighbor = photos[index + 1] ?? photos[index - 1];
		flushSync(() => {
			dispatch({ type: 'removePhoto', photoId: photo.id });
			setAnnouncement(`Removed ${photoName(photo, index, role)}.`);
		});
		document
			.getElementById(neighbor === undefined ? ids.choose : ids.actions(neighbor.id))
			?.focus();
	}

	// The menu gives focus back to its trigger, which stays in place as the photo moves to the front.
	function makeCover(photo: RecipeFormPhoto, index: number) {
		flushSync(() => {
			dispatch({ type: 'makeCoverPhoto', photoId: photo.id });
			setAnnouncement(
				`${photoName(photo, index, role)} is now the cover photo, first in the list.`
			);
		});
		document.getElementById(ids.actions(photo.id))?.scrollIntoView({ block: 'nearest' });
	}

	// Pages are read in order, so scans move up and down; the menu gives focus back to its trigger.
	function movePhoto(photo: RecipeFormPhoto, index: number, toIndex: number) {
		flushSync(() => {
			dispatch({ type: 'movePhoto', photoId: photo.id, toIndex });
			setAnnouncement(
				describePositionMove(
					itemName(photoName(photo, index, role), 'photo'),
					index,
					toIndex,
					photos.length
				)
			);
		});
		document.getElementById(ids.actions(photo.id))?.scrollIntoView({ block: 'nearest' });
	}

	function photoActions(photo: RecipeFormPhoto, index: number): ItemAction[] {
		if (role === 'scan') {
			const moves: { label: string; icon: LucideIcon; toIndex: number }[] = [
				{ label: 'Move up', icon: ArrowUpIcon, toIndex: index - 1 },
				{ label: 'Move down', icon: ArrowDownIcon, toIndex: index + 1 },
			];
			return moves.map(({ label, icon, toIndex }) => ({
				label,
				icon,
				onSelect:
					toIndex < 0 || toIndex >= photos.length
						? undefined
						: () => movePhoto(photo, index, toIndex),
			}));
		}
		const isCover = index === 0;
		const failed = photo.upload.status === 'failed';
		return [
			{
				label: 'Use as cover photo',
				icon: StarIcon,
				onSelect: isCover || failed ? undefined : () => makeCover(photo, index),
			},
		];
	}

	function handleDragEnter(event: React.DragEvent) {
		if (!carriesFiles(event)) {
			return;
		}
		event.preventDefault();
		dragDepth.current += 1;
		setIsDragging(true);
	}

	function handleDragLeave(event: React.DragEvent) {
		if (!carriesFiles(event)) {
			return;
		}
		dragDepth.current -= 1;
		if (dragDepth.current === 0) {
			setIsDragging(false);
		}
	}

	function handleDragOver(event: React.DragEvent) {
		if (!carriesFiles(event)) {
			return;
		}
		// Cancelling dragover is what makes the element a drop target.
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function handleDrop(event: React.DragEvent) {
		event.preventDefault();
		dragDepth.current = 0;
		setIsDragging(false);
		addFiles(Array.from(event.dataTransfer.files));
	}

	function renderPhoto(photo: RecipeFormPhoto, index: number) {
		const name = photoName(photo, index, role);
		const isCover = role === 'dish' && index === 0;
		const status = photoStatus(photo, isCover);
		const failure = photo.upload.status === 'failed' ? photo.upload.failure : undefined;
		const note = noteFor?.({ kind: 'photo', id: photo.id });

		return (
			<li key={photo.id} className="flex flex-col gap-3">
				<Attachment state={attachmentState(photo)} className="w-full">
					<PhotoThumbnail photo={photo} role={role} viewerImages={viewerImages} />
					<AttachmentContent>
						<AttachmentTitle>{name}</AttachmentTitle>
						{status !== undefined && <AttachmentDescription>{status}</AttachmentDescription>}
						{photo.upload.status === 'uploading' && (
							// A fixed locale, so the server and the browser format the value alike.
							<Progress
								value={Math.round(photo.upload.fraction * 100)}
								locale="en-US"
								aria-label={`Uploading ${name}`}
								className="mt-2"
							/>
						)}
					</AttachmentContent>
					<AttachmentActions>
						<ItemActionsMenu
							triggerId={ids.actions(photo.id)}
							itemLabel={name}
							actions={photoActions(photo, index)}
							onRemove={() => removePhoto(photo, index)}
						/>
					</AttachmentActions>
				</Attachment>
				{failure !== undefined && (
					<p className="text-sm text-destructive">{failureMessages[failure]}</p>
				)}
				{photo.error !== undefined && (
					// Takes focus after a failed save or import in place of a field.
					<FieldProblem id={ids.photoError(photo.id)} tabIndex={-1}>
						{photo.error}
					</FieldProblem>
				)}
				{note !== undefined && <FieldNote id={ids.photoNote(photo.id)} name={name} {...note} />}
				{role === 'dish' && failure === undefined && (
					<Field>
						<FieldLabel htmlFor={ids.alt(photo.id)}>
							Describe the photo<span className="sr-only">: {name}</span>
						</FieldLabel>
						<Input
							id={ids.alt(photo.id)}
							value={photo.alt}
							onChange={(event) =>
								dispatch({ type: 'setPhotoAlt', photoId: photo.id, alt: event.target.value })
							}
						/>
					</Field>
				)}
			</li>
		);
	}

	return (
		<FieldSet aria-describedby={describedBy(ids.description, error !== undefined && ids.error)}>
			<FieldLegend>{legend}</FieldLegend>
			<FieldDescription id={ids.description}>{description}</FieldDescription>
			{error !== undefined && (
				// Takes focus after a failed import in place of a field.
				<FieldError id={ids.error} tabIndex={-1}>
					{error}
				</FieldError>
			)}
			<Empty
				data-dragging={isDragging || undefined}
				className="border transition-colors data-dragging:border-primary data-dragging:bg-accent"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<ImagePlusIcon aria-hidden="true" />
					</EmptyMedia>
					{isFull ? (
						<EmptyDescription id={ids.limit}>{limitMessage}</EmptyDescription>
					) : (
						<EmptyDescription>Drag photos here, or</EmptyDescription>
					)}
				</EmptyHeader>
				<EmptyContent>
					{/* Stays focusable when full, so focus is not lost as the last photo that fits is chosen. */}
					<Button
						id={ids.choose}
						type="button"
						variant="outline"
						disabled={isFull}
						focusableWhenDisabled
						aria-describedby={isFull ? ids.limit : undefined}
						onClick={() => inputRef.current?.click()}
					>
						Choose photos
					</Button>
				</EmptyContent>
				{/* The visible button opens this native picker, so the input stays out of the tab order.
				It has no name, so the form never sends the files themselves. */}
				<input
					ref={inputRef}
					type="file"
					accept="image/*"
					multiple
					tabIndex={-1}
					aria-hidden="true"
					className="sr-only"
					onChange={(event) => {
						addFiles(Array.from(event.target.files ?? []));
						// Clearing the value lets the same file be chosen again after it is removed.
						event.target.value = '';
					}}
				/>
			</Empty>
			{photos.length > 0 && (
				<RecipeImageViewer role={role} title={legend} images={viewerImages}>
					<ul aria-label={legend} className="flex flex-col gap-4">
						{photos.map((photo, index) => renderPhoto(photo, index))}
					</ul>
				</RecipeImageViewer>
			)}
			<p role="status" aria-live="polite" className="sr-only">
				{announcement}
			</p>
		</FieldSet>
	);
}

export { PhotoField, photoFieldIds, photoName };
