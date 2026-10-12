import {
	BookOpenIcon,
	CircleAlertIcon,
	EllipsisIcon,
	ImageIcon,
	InfoIcon,
	OctagonXIcon,
	PlusIcon,
	XIcon,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Specimen } from '@/components/design-reference/reference-section';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

// Words, not color alone, carry each state, kept short enough for the vertical layout.
const attachmentStates = [
	{
		state: 'idle',
		name: 'biscuits-plated.jpg',
		description: 'Ready to upload',
		media: <ImageIcon aria-hidden="true" />,
	},
	{
		state: 'uploading',
		name: 'recipe-card-front.jpg',
		description: 'Uploading · 64%',
		media: <Spinner />,
	},
	{
		state: 'processing',
		name: 'recipe-card-back.jpg',
		description: 'Processing photo',
		media: <Spinner />,
	},
	{
		state: 'error',
		name: 'pie-slice.heic',
		description: 'Upload failed',
		media: <CircleAlertIcon aria-hidden="true" />,
	},
	{
		state: 'done',
		name: 'soup-pot.jpg',
		description: 'Uploaded',
		media: <ImageIcon aria-hidden="true" />,
	},
] as const;

const attachmentSizes = ['default', 'sm', 'xs'] as const;

function SampleAttachment({
	state,
	name,
	description,
	media,
	size,
	orientation,
}: {
	name: string;
	description: string;
	media: ReactNode;
} & Pick<ComponentProps<typeof Attachment>, 'state' | 'size' | 'orientation'>) {
	return (
		<Attachment state={state} size={size} orientation={orientation}>
			<AttachmentMedia>{media}</AttachmentMedia>
			<AttachmentContent>
				<AttachmentTitle>{name}</AttachmentTitle>
				<AttachmentDescription>{description}</AttachmentDescription>
			</AttachmentContent>
			<AttachmentActions>
				<AttachmentAction
					// A vertical attachment's action sits over its media, which may be a photo.
					variant={orientation === 'vertical' ? 'secondary' : 'ghost'}
					aria-label={`Remove ${name}`}
				>
					<XIcon aria-hidden="true" />
				</AttachmentAction>
			</AttachmentActions>
		</Attachment>
	);
}

function AttachmentSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen label="States: idle, uploading, processing, error, done">
				<ul className="flex flex-wrap gap-3">
					{attachmentStates.map((attachment) => (
						<li key={attachment.state}>
							<SampleAttachment {...attachment} />
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label='orientation="vertical"'>
				<ul className="flex flex-wrap gap-3">
					{attachmentStates.map((attachment) => (
						<li key={attachment.state}>
							<SampleAttachment {...attachment} orientation="vertical" />
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Sizes: default, sm, xs">
				<ul className="flex flex-wrap items-center gap-3">
					{attachmentSizes.map((size) => (
						<li key={size}>
							<SampleAttachment
								size={size}
								name={`biscuits-${size}.jpg`}
								description="1.2MB"
								media={<ImageIcon aria-hidden="true" />}
							/>
						</li>
					))}
				</ul>
			</Specimen>
		</div>
	);
}

function CardSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label='size="default" with header, action, content, and footer' frame="bare">
				<Card>
					<CardHeader>
						<CardTitle>Grandpa Lou&apos;s kitchen</CardTitle>
						<CardDescription>Twelve recipes, most of them soups.</CardDescription>
						<CardAction>
							<Button variant="ghost" size="icon-sm" aria-label="Collection actions">
								<EllipsisIcon aria-hidden="true" />
							</Button>
						</CardAction>
					</CardHeader>
					<CardContent>
						<p>
							Lou wrote everything on index cards and kept them in a coffee tin above the stove.
						</p>
					</CardContent>
					<CardFooter className="gap-2 border-t">
						<Button size="sm">Open collection</Button>
						<Button size="sm" variant="ghost">
							Share
						</Button>
					</CardFooter>
				</Card>
			</Specimen>
			<Specimen label='size="sm"' frame="bare">
				<Card size="sm">
					<CardHeader>
						<CardTitle>Weeknight chicken soup</CardTitle>
						<CardDescription>From Grandpa Lou</CardDescription>
					</CardHeader>
					<CardContent>
						<p>Ready in under an hour with a store-bought rotisserie chicken.</p>
					</CardContent>
				</Card>
			</Specimen>
		</div>
	);
}

function AlertSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label='variant="default" with an icon, title, and description' frame="bare">
				<Alert>
					<InfoIcon aria-hidden="true" />
					<AlertTitle>Some steps need review</AlertTitle>
					<AlertDescription>
						Two steps were hard to read in the photo. Check them before saving.
					</AlertDescription>
				</Alert>
			</Specimen>
			<Specimen label='variant="destructive" with an icon, title, and description' frame="bare">
				<Alert variant="destructive">
					<OctagonXIcon aria-hidden="true" />
					<AlertTitle>We couldn&apos;t save the recipe</AlertTitle>
					<AlertDescription>Check your connection and try again.</AlertDescription>
				</Alert>
			</Specimen>
		</div>
	);
}

function SkeletonSpecimen() {
	return (
		<Specimen label="Placeholders sized to the content they stand in for">
			<div className="flex items-center gap-4">
				<Skeleton className="size-10 rounded-full" />
				<div className="flex flex-1 flex-col gap-2">
					<Skeleton className="h-4 w-full max-w-60" />
					<Skeleton className="h-4 w-full max-w-40" />
				</div>
			</div>
		</Specimen>
	);
}

function SpinnerSpecimen() {
	return (
		<Specimen label="Default size, larger, inline with text, and in a button">
			<div className="flex flex-wrap items-center gap-6">
				<Spinner />
				<Spinner className="size-6" />
				<span className="flex items-center gap-2 text-sm text-muted-foreground">
					<Spinner />
					Loading recipes
				</span>
				<Button variant="outline" disabled focusableWhenDisabled>
					<Spinner data-icon="inline-start" />
					Importing
				</Button>
			</div>
		</Specimen>
	);
}

const progressSamples = [
	{ name: 'biscuits-plated.jpg', value: 0 },
	{ name: 'recipe-card-front.jpg', value: 64 },
	{ name: 'soup-pot.jpg', value: 100 },
] as const;

function ProgressSpecimen() {
	return (
		<Specimen label="At 0, 64, and 100: ProgressLabel gives the bar its accessible name, and ProgressValue its percent">
			<div className="flex max-w-sm flex-col gap-6">
				{progressSamples.map(({ name, value }) => (
					// Fixed, like the site's other formats, so the server and browser render the same text.
					<Progress key={name} value={value} locale="en-US">
						<ProgressLabel>Uploading {name}</ProgressLabel>
						<ProgressValue />
					</Progress>
				))}
			</div>
		</Specimen>
	);
}

function EmptySpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label='Outlined, with EmptyMedia variant="icon" and an action' frame="bare">
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<BookOpenIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No recipes in this collection</EmptyTitle>
						<EmptyDescription>Add one to start the collection.</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button>
							<PlusIcon data-icon="inline-start" aria-hidden="true" />
							Add a recipe
						</Button>
					</EmptyContent>
				</Empty>
			</Specimen>
			<Specimen label='Default, with EmptyMedia variant="default"'>
				<Empty>
					<EmptyHeader>
						<EmptyMedia>
							<BookOpenIcon aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No matching recipes</EmptyTitle>
						<EmptyDescription>Try a different ingredient or source.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</Specimen>
		</div>
	);
}

function SeparatorSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label='orientation="horizontal"'>
				<div className="flex flex-col gap-4">
					<p className="text-sm">Ingredients</p>
					<Separator />
					<p className="text-sm">Steps</p>
				</div>
			</Specimen>
			<Specimen label='orientation="vertical"'>
				<div className="flex h-5 items-center gap-4 text-sm">
					<span>Edit</span>
					<Separator orientation="vertical" />
					<span>Print</span>
					<Separator orientation="vertical" />
					<span>Share</span>
				</div>
			</Specimen>
		</div>
	);
}

export {
	AlertSpecimen,
	AttachmentSpecimen,
	CardSpecimen,
	EmptySpecimen,
	ProgressSpecimen,
	SeparatorSpecimen,
	SkeletonSpecimen,
	SpinnerSpecimen,
};
