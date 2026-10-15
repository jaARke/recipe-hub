import { cn } from 'cn';
import { HeartIcon } from 'lucide-react';
import type * as React from 'react';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The heart a favorite toggle holds, filled while the toggle is pressed.
function FavoriteHeartIcon({ className, ...props }: React.ComponentProps<typeof HeartIcon>) {
	return (
		<HeartIcon
			aria-hidden="true"
			className={cn('group-aria-pressed/toggle:fill-current', className)}
			{...props}
		/>
	);
}

// Stands in for the favorite toggle in a recipe's actions, and favorites nothing.
function StandInFavoriteToggle() {
	return (
		<Tooltip>
			<TooltipTrigger render={<Toggle variant="outline" aria-label="Favorite" />}>
				<FavoriteHeartIcon />
			</TooltipTrigger>
			<TooltipContent>Favorite</TooltipContent>
		</Tooltip>
	);
}

export { FavoriteHeartIcon, StandInFavoriteToggle };
