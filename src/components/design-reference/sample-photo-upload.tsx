'use client';

import { FileIcon, ImagePlusIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { flushSync } from 'react-dom';
import {
	Attachment,
	AttachmentAction,
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
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';

type ChosenFile = {
	id: number;
	file: File;
};

type FileSelection = {
	files: readonly ChosenFile[];
	nextId: number;
};

// Compact notation scales the unit with the size, such as 820KB or 2.4MB.
const fileSizeFormat = new Intl.NumberFormat('en-US', {
	style: 'unit',
	unit: 'byte',
	notation: 'compact',
	unitDisplay: 'narrow',
});

function countFiles(count: number) {
	return `${count} ${count === 1 ? 'file' : 'files'}`;
}

function isImage(file: File) {
	return file.type.startsWith('image/');
}

// Text and links can be dragged too; only drags that carry files concern the drop area.
function carriesFiles(event: DragEvent) {
	return event.dataTransfer.types.includes('Files');
}

function focusElement(id: string) {
	document.getElementById(id)?.focus();
}

function PhotoThumbnail({ file }: { file: File }) {
	const imageRef = useRef<HTMLImageElement>(null);

	// Made here rather than on choosing, so the URL is revoked whenever the thumbnail unmounts or its
	// route is hidden, and recreated when it shows again.
	useEffect(() => {
		const image = imageRef.current;

		if (!image) {
			return;
		}

		const url = URL.createObjectURL(file);
		image.src = url;
		return () => URL.revokeObjectURL(url);
	}, [file]);

	// next/image needs its source at render time; this one is created and revoked in the effect.
	// eslint-disable-next-line @next/next/no-img-element
	return <img ref={imageRef} alt="" />;
}

function ChosenFileAttachment({
	file,
	removeButtonId,
	onRemove,
}: {
	file: File;
	removeButtonId: string;
	onRemove: () => void;
}) {
	const image = isImage(file);

	return (
		<Attachment state={image ? 'idle' : 'error'} orientation="vertical">
			<AttachmentMedia variant={image ? 'image' : 'icon'}>
				{image ? <PhotoThumbnail file={file} /> : <FileIcon aria-hidden="true" />}
			</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{file.name}</AttachmentTitle>
				<AttachmentDescription>
					{image ? fileSizeFormat.format(file.size) : 'Not an image'}
				</AttachmentDescription>
			</AttachmentContent>
			<AttachmentActions>
				<AttachmentAction
					id={removeButtonId}
					variant="secondary"
					aria-label={`Remove ${file.name}`}
					onClick={onRemove}
				>
					<XIcon aria-hidden="true" />
				</AttachmentAction>
			</AttachmentActions>
		</Attachment>
	);
}

// Nothing uploads, so chosen files stay idle.
function SamplePhotoUpload() {
	const baseId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	// Children fire their own enter and leave events; the depth tells a real leave from a move onto a child.
	const dragDepth = useRef(0);
	const [isDragging, setIsDragging] = useState(false);
	const [selection, setSelection] = useState<FileSelection>({ files: [], nextId: 0 });
	const [announcement, setAnnouncement] = useState('');
	const ids = {
		description: `${baseId}-description`,
		choose: `${baseId}-choose`,
		remove: (fileId: number) => `${baseId}-remove-${fileId}`,
	};

	function addFiles(files: readonly File[]) {
		if (files.length === 0) {
			return;
		}

		setSelection({
			nextId: selection.nextId + files.length,
			files: [
				...selection.files,
				...files.map((file, index) => ({ id: selection.nextId + index, file })),
			],
		});
		// The running total keeps repeated selections from producing identical, unannounced text.
		setAnnouncement(
			`Added ${countFiles(files.length)}. ${countFiles(selection.files.length + files.length)} chosen.`
		);
	}

	function removeFile(removed: ChosenFile, fileIndex: number) {
		const neighbor = selection.files[fileIndex - 1] ?? selection.files[fileIndex + 1];
		// Commits synchronously so focus can move once the file is gone.
		flushSync(() => {
			setSelection({
				...selection,
				files: selection.files.filter((_, index) => index !== fileIndex),
			});
			setAnnouncement(`Removed ${removed.file.name}.`);
		});
		focusElement(neighbor ? ids.remove(neighbor.id) : ids.choose);
	}

	function handleDragEnter(event: DragEvent) {
		if (!carriesFiles(event)) {
			return;
		}

		event.preventDefault();
		dragDepth.current += 1;
		setIsDragging(true);
	}

	function handleDragLeave(event: DragEvent) {
		if (!carriesFiles(event)) {
			return;
		}

		dragDepth.current -= 1;

		if (dragDepth.current === 0) {
			setIsDragging(false);
		}
	}

	function handleDragOver(event: DragEvent) {
		if (!carriesFiles(event)) {
			return;
		}

		// Cancelling dragover is what makes the element a drop target.
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth.current = 0;
		setIsDragging(false);
		addFiles(Array.from(event.dataTransfer.files));
	}

	return (
		<FieldSet aria-describedby={ids.description}>
			<FieldLegend>Photos</FieldLegend>
			<FieldDescription id={ids.description}>
				Photos of the finished dish or scans of the original recipe.
			</FieldDescription>
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
					<EmptyDescription>Drag photos here, or</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						id={ids.choose}
						type="button"
						variant="outline"
						onClick={() => inputRef.current?.click()}
					>
						Choose photos
					</Button>
				</EmptyContent>
				{/* The visible button opens this native picker, so the input stays out of the tab order. */}
				<input
					ref={inputRef}
					type="file"
					name="photos"
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
			{selection.files.length > 0 && (
				<ul aria-label="Chosen photos" className="flex flex-wrap gap-3">
					{selection.files.map((chosen, fileIndex) => (
						<li key={chosen.id}>
							<ChosenFileAttachment
								file={chosen.file}
								removeButtonId={ids.remove(chosen.id)}
								onRemove={() => removeFile(chosen, fileIndex)}
							/>
						</li>
					))}
				</ul>
			)}
			<p role="status" className="sr-only">
				{announcement}
			</p>
		</FieldSet>
	);
}

export { SamplePhotoUpload };
