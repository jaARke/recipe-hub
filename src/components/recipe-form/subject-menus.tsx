'use client';

import { EllipsisIcon, EyeIcon, Trash2Icon, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useConfirmActionDialogOpener } from '@/components/forms/confirm-action-dialog';
import type { FormAction } from '@/components/forms/form-state';
import { DeleteDraftDialog, type DeletedDraft } from '@/components/recipe-form/delete-draft-dialog';
import { DeleteRecipeDialog } from '@/components/recipe-form/delete-recipe-dialog';
import { useHeldDraft, useReleaseDraft } from '@/components/recipe-form/held-draft';
import type { RecipeFormEntrySubject } from '@/components/recipe-form/recipe-form-autosave';
import { removeRecipeFormChanges } from '@/components/recipe-form/use-recipe-form-autosave';
import { contributePath, recipeListPath, recipePath } from '@/components/recipe/recipe-paths';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Menus of what can be done to a recipe or a draft as a whole, each a ⋯ button at the end of what
// it acts on: an editing page's heading, or a row in the list of drafts. Delete confirms in a dialog
// and, once confirmed, removes the member's unsaved changes kept in this browser with it.

// 44 px for a finger, as the recipe page's actions are.
const touchSizeClassNames = {
	trigger: 'pointer-coarse:size-11',
	item: 'pointer-coarse:min-h-11',
} as const;

type SubjectMenuProps = {
	// Names the button for what the menu acts on, such as "Recipe actions".
	label: string;
	// The button, which takes focus back as its dialog closes.
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	children: React.ReactNode;
};

// The menu opens toward the page, from the button at the end of the row.
function SubjectMenu({ label, triggerRef, children }: SubjectMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				ref={triggerRef}
				render={
					<Button
						variant="outline"
						size="icon"
						aria-label={label}
						className={touchSizeClassNames.trigger}
					/>
				}
			>
				<EllipsisIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function SubjectMenuItem({
	icon: Icon,
	children,
	...props
}: Omit<React.ComponentProps<typeof DropdownMenuItem>, 'className'> & { icon: LucideIcon }) {
	return (
		<DropdownMenuItem className={touchSizeClassNames.item} {...props}>
			<Icon aria-hidden="true" />
			{children}
		</DropdownMenuItem>
	);
}

type DraftMenuProps = {
	// Names the button, as "Draft actions" beside a page's heading or with the draft's name in a list.
	label: string;
	draft: DeletedDraft;
	// The recipe's title as saved, if it has one yet.
	title: string | undefined;
	// The form whose unsaved changes in this browser go with the draft.
	formSubject: RecipeFormEntrySubject;
	memberId: string;
	action: FormAction;
	// Where the page it was open on leaves for once it is deleted. A list stays, and the page renders
	// again without it.
	leavesFor?: string;
};

// Delete draft, for a draft open in the recipe form or listed among the member's drafts.
function DraftMenu({
	label,
	draft,
	title,
	formSubject,
	memberId,
	action,
	leavesFor,
}: DraftMenuProps) {
	const router = useRouter();
	const releaseDraft = useReleaseDraft();
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const opener = useConfirmActionDialogOpener(triggerRef);

	return (
		<>
			<SubjectMenu label={label} triggerRef={triggerRef}>
				<SubjectMenuItem
					variant="destructive"
					icon={Trash2Icon}
					onClick={() => opener.handle.open(null)}
				>
					Delete draft
				</SubjectMenuItem>
			</SubjectMenu>
			<DeleteDraftDialog
				draft={draft}
				title={title}
				opener={opener}
				action={action}
				onDeleted={() => {
					removeRecipeFormChanges(memberId, formSubject);
					// The page lets go of it if its form holds it, so its list of drafts stops showing it.
					releaseDraft?.(draft.id);
					// The draft is gone, so the drafts left take its place in the history.
					if (leavesFor !== undefined) {
						router.replace(leavesFor);
					}
				}}
			/>
		</>
	);
}

// A draft's page's menu once its form holds a saved draft, opened or just saved; a new recipe has
// none. Deleting it leaves for the start page, which lists the drafts left.
function HeldDraftMenu({ memberId, action }: { memberId: string; action: FormAction }) {
	const draft = useHeldDraft();
	if (draft === undefined) {
		return null;
	}
	return (
		<DraftMenu
			label="Draft actions"
			draft={{ kind: 'saved', id: draft.id }}
			title={draft.title}
			formSubject={{ kind: 'draft', draftId: draft.id }}
			memberId={memberId}
			action={action}
			leavesFor={contributePath}
		/>
	);
}

// The edit page's menu: View recipe, then Delete recipe, which leaves for the list of recipes.
function EditedRecipeMenu({
	recipe,
	memberId,
	action,
}: {
	recipe: { id: string; slug: string; title: string };
	memberId: string;
	action: FormAction;
}) {
	const router = useRouter();
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const opener = useConfirmActionDialogOpener(triggerRef);

	return (
		<>
			<SubjectMenu label="Recipe actions" triggerRef={triggerRef}>
				<SubjectMenuItem icon={EyeIcon} render={<Link href={recipePath(recipe.slug)} />}>
					View recipe
				</SubjectMenuItem>
				<DropdownMenuSeparator />
				<SubjectMenuItem
					variant="destructive"
					icon={Trash2Icon}
					onClick={() => opener.handle.open(null)}
				>
					Delete recipe
				</SubjectMenuItem>
			</SubjectMenu>
			<DeleteRecipeDialog
				recipeId={recipe.id}
				title={recipe.title}
				opener={opener}
				action={action}
				onDeleted={() => {
					removeRecipeFormChanges(memberId, { kind: 'recipe', recipeId: recipe.id });
					// The edit page is gone, so the list takes its place in the history.
					router.replace(recipeListPath);
				}}
			/>
		</>
	);
}

export { DraftMenu, EditedRecipeMenu, HeldDraftMenu };
