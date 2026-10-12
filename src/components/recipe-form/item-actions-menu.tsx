'use client';

import { EllipsisVerticalIcon, Trash2Icon, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// A choice in an item's menu. Without onSelect it shows but can't be chosen, as Move up can't at
// the top of a list.
export type ItemAction = {
	label: string;
	icon: LucideIcon;
	onSelect: (() => void) | undefined;
};

type ItemActionsMenuProps = {
	triggerId: string;
	// Names the item, such as "Step 2, For the glaze".
	itemLabel: string;
	actions: readonly ItemAction[];
	onRemove: () => void;
};

// One button for everything an item can do, ending with Remove, so a row on a phone keeps a single
// control beside its field.
function ItemActionsMenu({ triggerId, itemLabel, actions, onRemove }: ItemActionsMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						id={triggerId}
						type="button"
						variant="ghost"
						size="icon"
						aria-label={`Actions for ${itemLabel}`}
					/>
				}
			>
				<EllipsisVerticalIcon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				{actions.length > 0 && (
					<>
						<DropdownMenuGroup>
							{actions.map(({ label, icon: Icon, onSelect }) => (
								<DropdownMenuItem key={label} disabled={onSelect === undefined} onClick={onSelect}>
									<Icon aria-hidden="true" />
									{label}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuItem variant="destructive" onClick={onRemove}>
					<Trash2Icon aria-hidden="true" />
					Remove
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { ItemActionsMenu };
