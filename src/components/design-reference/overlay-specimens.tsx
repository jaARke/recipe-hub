import {
	ChevronDownIcon,
	CopyIcon,
	HeartIcon,
	LinkIcon,
	MailIcon,
	PencilIcon,
	PrinterIcon,
	Share2Icon,
	Trash2Icon,
} from 'lucide-react';
import { Specimen } from '@/components/design-reference/reference-section';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const tooltipSides = ['top', 'right', 'bottom', 'left'] as const;

function SampleTabs({
	variant,
	orientation,
}: {
	variant: 'default' | 'line';
	orientation: 'horizontal' | 'vertical';
}) {
	return (
		<Tabs defaultValue="ingredients" orientation={orientation}>
			<TabsList variant={variant}>
				<TabsTrigger value="ingredients">Ingredients</TabsTrigger>
				<TabsTrigger value="steps">Steps</TabsTrigger>
				<TabsTrigger value="notes">Notes</TabsTrigger>
				<TabsTrigger value="history" disabled>
					History
				</TabsTrigger>
			</TabsList>
			<TabsContent value="ingredients" className="text-muted-foreground">
				Eight ingredients in two sections.
			</TabsContent>
			<TabsContent value="steps" className="text-muted-foreground">
				Seven steps, about 35 minutes in all.
			</TabsContent>
			<TabsContent value="notes" className="text-muted-foreground">
				June cut her biscuits with a juice glass.
			</TabsContent>
		</Tabs>
	);
}

function TabsSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-3">
			<Specimen label='variant="default"'>
				<SampleTabs variant="default" orientation="horizontal" />
			</Specimen>
			<Specimen label='variant="line"'>
				<SampleTabs variant="line" orientation="horizontal" />
			</Specimen>
			<Specimen label='orientation="vertical"'>
				<SampleTabs variant="default" orientation="vertical" />
			</Specimen>
		</div>
	);
}

function DialogSpecimen() {
	return (
		<Specimen label="Escape or the close button dismisses; focus returns to the trigger">
			<div className="flex flex-wrap gap-3">
				<Dialog>
					<DialogTrigger render={<Button variant="destructive" />}>
						<Trash2Icon data-icon="inline-start" aria-hidden="true" />
						Delete recipe
					</DialogTrigger>
					<DialogContent showCloseButton={false}>
						<DialogHeader>
							<DialogTitle>Delete Buttermilk biscuits?</DialogTitle>
							<DialogDescription>
								The recipe and its photos leave the collection. This cannot be undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<DialogClose render={<Button variant="outline" />}>Keep recipe</DialogClose>
							<DialogClose render={<Button variant="destructive" />}>Delete</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<Dialog>
					<DialogTrigger render={<Button variant="outline" />}>
						<Share2Icon data-icon="inline-start" aria-hidden="true" />
						Share recipe
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Share Buttermilk biscuits</DialogTitle>
							<DialogDescription>Anyone who is signed in can open this link.</DialogDescription>
						</DialogHeader>
						<Field>
							<FieldLabel htmlFor="dialog-share-link">Link</FieldLabel>
							<Input
								id="dialog-share-link"
								readOnly
								defaultValue="https://recipes.example/buttermilk-biscuits"
							/>
						</Field>
						<DialogFooter showCloseButton>
							<Button>
								<CopyIcon data-icon="inline-start" aria-hidden="true" />
								Copy link
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</Specimen>
	);
}

function DropdownMenuSpecimen() {
	return (
		<Specimen label="Groups, shortcuts, a submenu, checkbox and radio items, disabled and destructive items">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="outline" />}>
					Recipe actions
					<ChevronDownIcon data-icon="inline-end" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Recipe</DropdownMenuLabel>
						<DropdownMenuItem>
							<PencilIcon aria-hidden="true" />
							Edit
							<DropdownMenuShortcut>E</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuItem>
							<PrinterIcon aria-hidden="true" />
							Print
							<DropdownMenuShortcut>P</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuItem disabled>
							<CopyIcon aria-hidden="true" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<Share2Icon aria-hidden="true" />
								Share
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuItem>
									<LinkIcon aria-hidden="true" />
									Copy link
								</DropdownMenuItem>
								<DropdownMenuItem>
									<MailIcon aria-hidden="true" />
									Email
								</DropdownMenuItem>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>Show</DropdownMenuLabel>
						<DropdownMenuCheckboxItem defaultChecked>Notes</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem>Original scans</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuRadioGroup defaultValue="original">
						<DropdownMenuLabel>Servings</DropdownMenuLabel>
						<DropdownMenuRadioItem value="half">Half batch</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="original">Original</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="double">Double batch</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">
						<Trash2Icon aria-hidden="true" />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</Specimen>
	);
}

function TooltipSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="On icon buttons: hover or focus to open">
				<div className="flex flex-wrap gap-3">
					<Tooltip>
						<TooltipTrigger render={<Button variant="outline" size="icon" aria-label="Print" />}>
							<PrinterIcon aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>Print</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={<Button variant="outline" size="icon" aria-label="Copy link" />}
						>
							<LinkIcon aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>Copy link</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={<Button variant="outline" size="icon" aria-label="Add to favorites" />}
						>
							<HeartIcon aria-hidden="true" />
						</TooltipTrigger>
						<TooltipContent>Add to favorites</TooltipContent>
					</Tooltip>
				</div>
			</Specimen>
			<Specimen label="Sides">
				<div className="flex flex-wrap gap-3">
					{tooltipSides.map((side) => (
						<Tooltip key={side}>
							<TooltipTrigger render={<Button variant="outline" size="sm" />}>
								{side}
							</TooltipTrigger>
							<TooltipContent side={side}>Tooltip on the {side}</TooltipContent>
						</Tooltip>
					))}
				</div>
			</Specimen>
		</div>
	);
}

export { DialogSpecimen, DropdownMenuSpecimen, TabsSpecimen, TooltipSpecimen };
