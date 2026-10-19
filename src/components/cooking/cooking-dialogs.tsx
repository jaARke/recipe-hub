'use client';

import { cn } from 'cn';
import { ListChecksIcon, ListOrderedIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import {
	CookingNotes,
	CookingScaleText,
	IngredientChecklist,
} from '@/components/cooking/cooking-ingredients';
import {
	gatherTitle,
	startsCookingGroup,
	type CookingRecipe,
	type CookingScreen,
} from '@/components/cooking/cooking-screens';
import type { CookingChecks } from '@/components/cooking/use-cooking-checks';
import type { RecipeScale } from '@/components/cooking/use-cooking-url';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';

type DialogState = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

// A top bar button: its icon alone on phones, named by its hidden label.
const topBarButtonClassName = 'h-11 min-w-11 gap-2 px-3';

// Neither dialog prints.
const contentClassName = 'gap-5 sm:max-w-lg print:hidden';

// The title beside the dialog's own Close, 44 px for a cook's hands where the shared one is smaller.
function CookingDialogHeader({ title }: { title: string }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<DialogTitle className="text-2xl">{title}</DialogTitle>
			<DialogClose render={<Button variant="ghost" size="icon" className="-mr-2 size-11" />}>
				<XIcon className="size-5" aria-hidden="true" />
				<span className="sr-only">Close</span>
			</DialogClose>
		</div>
	);
}

// The ingredients a tap away, at the servings Gather set: the checklist and the notes.
function IngredientsDialog({
	recipe,
	scale,
	checks,
	triggerClassName,
	...state
}: DialogState & {
	recipe: CookingRecipe;
	scale: RecipeScale;
	checks: CookingChecks;
	triggerClassName?: string;
}) {
	return (
		<Dialog {...state}>
			<DialogTrigger
				render={<Button variant="ghost" className={cn(topBarButtonClassName, triggerClassName)} />}
			>
				<ListChecksIcon aria-hidden="true" />
				<span className="max-sm:sr-only">Ingredients</span>
			</DialogTrigger>
			<DialogContent showCloseButton={false} className={contentClassName}>
				<CookingDialogHeader title="Ingredients" />
				<CookingScaleText scale={scale} />
				<IngredientChecklist
					sections={recipe.ingredientSections}
					factor={scale.factor}
					checks={checks}
					size="regular"
					headingTag="h3"
				/>
				{recipe.notes !== undefined && (
					<CookingNotes notes={recipe.notes} size="regular" headingTag="h3" />
				)}
			</DialogContent>
		</Dialog>
	);
}

function screenName(screen: CookingScreen): string {
	return screen.kind === 'step' ? screen.text : gatherTitle;
}

// Every screen but the finish, the steps under their sections, to jump to any; and Start over. A
// jump or Start over moves focus to the new screen's heading as the dialog closes, rather than back
// to Steps.
function StepsDialog({
	screens,
	index,
	heading,
	onPick,
	onStartOver,
	...state
}: DialogState & {
	screens: readonly CookingScreen[];
	index: number;
	// The shown screen's heading, which takes focus once a jump closes the dialog.
	heading: React.RefObject<HTMLHeadingElement | null>;
	onPick: (index: number) => void;
	onStartOver: () => void;
}) {
	// Set by a jump or Start over, and cleared as the dialog opens again.
	const moved = React.useRef(false);

	function move(change: () => void) {
		moved.current = true;
		change();
		state.onOpenChange(false);
	}

	return (
		<Dialog
			{...state}
			onOpenChange={(open) => {
				if (open) {
					moved.current = false;
				}
				state.onOpenChange(open);
			}}
		>
			<DialogTrigger render={<Button variant="ghost" className={topBarButtonClassName} />}>
				<ListOrderedIcon aria-hidden="true" />
				<span className="max-sm:sr-only">Steps</span>
			</DialogTrigger>
			<DialogContent
				showCloseButton={false}
				finalFocus={() => (moved.current ? heading.current : true)}
				className={contentClassName}
			>
				<CookingDialogHeader title="Steps" />
				<ol role="list" className="-mx-2 flex flex-col">
					{screens.slice(0, -1).map((screen, position) => {
						const sectionHeading =
							screen.kind === 'step' && startsCookingGroup(screens, position)
								? screen.sectionHeading
								: undefined;
						return (
							<li key={position}>
								{sectionHeading !== undefined && (
									<h3 className="px-2 pt-3 pb-1 text-sm font-semibold text-muted-foreground">
										{sectionHeading}
									</h3>
								)}
								<button
									type="button"
									aria-current={position === index ? 'step' : undefined}
									onClick={() => move(() => onPick(position))}
									className={cn(
										'flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-base hover:bg-state-layer',
										position === index && 'bg-accent',
										position < index && 'text-muted-foreground'
									)}
								>
									<span className="min-w-6 shrink-0 font-heading font-semibold tabular-nums">
										{screen.kind === 'step' ? screen.number : 0}
									</span>
									<span className="line-clamp-2">{screenName(screen)}</span>
								</button>
							</li>
						);
					})}
				</ol>
				<Button
					variant="outline"
					className="h-11 justify-self-start px-4"
					onClick={() => move(onStartOver)}
				>
					Start over
				</Button>
			</DialogContent>
		</Dialog>
	);
}

export { IngredientsDialog, StepsDialog };
