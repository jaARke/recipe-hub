'use client';

import { cn } from 'cn';
import { HeartIcon } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import * as React from 'react';
import type { FormState } from '@/components/forms/form-state';
import { toast } from '@/components/ui/toast';
import { Toggle } from '@/components/ui/toggle';

// The toggle's label and so its name, whatever its state: aria-pressed says whether the recipe is a
// favorite, as WAI-ARIA's toggle button pattern has it.
const favoriteLabel = 'Favorite';

// What a change that failed in transport, such as over a lost connection, says.
const failureMessage = 'Check your connection and try again.';

// The setFavorite Server Action, or a stand-in on the design reference.
type SetFavoriteAction = (recipeId: string, favorite: boolean) => Promise<FormState>;

type FavoriteToggleProps = {
	recipeId: string;
	// Whether the reader has the recipe as a favorite, as the server last rendered it.
	favorite: boolean;
	setFavoriteAction: SetFavoriteAction;
};

// The heart a favorite toggle holds, filled red while the toggle is pressed.
function FavoriteHeartIcon({ className, ...props }: React.ComponentProps<typeof HeartIcon>) {
	return (
		<HeartIcon
			aria-hidden="true"
			className={cn(
				'group-aria-pressed/toggle:fill-favorite group-aria-pressed/toggle:text-favorite',
				className
			)}
			{...props}
		/>
	);
}

// Shows a change at once and holds it while the action runs, whose refresh brings back what was
// saved. A refused change, such as one past a device's limit, goes back, and a toast says why.
function FavoriteToggle({ recipeId, favorite, setFavoriteAction }: FavoriteToggleProps) {
	const [pressed, setPressed] = React.useOptimistic(favorite);

	function changePressed(next: boolean) {
		React.startTransition(async () => {
			setPressed(next);
			let result: FormState;
			try {
				result = await setFavoriteAction(recipeId, next);
			} catch (error) {
				unstable_rethrow(error);
				result = { status: 'error', message: failureMessage, fieldErrors: {} };
			}
			if (result.status === 'error') {
				toast.add({
					type: 'error',
					title: next ? 'Couldn’t add this favorite' : 'Couldn’t remove this favorite',
					description: result.message,
				});
			}
		});
	}

	return (
		<Toggle
			variant="outline"
			pressed={pressed}
			onPressedChange={changePressed}
			// Its icon spaced as a button's is. The dark theme's edge is dimmer than its text, so a pressed
			// toggle's edge brightens to the text's color.
			className="gap-1.5 aria-pressed:border-foreground"
		>
			<FavoriteHeartIcon data-icon="inline-start" />
			{favoriteLabel}
		</Toggle>
	);
}

export { FavoriteHeartIcon, FavoriteToggle };
