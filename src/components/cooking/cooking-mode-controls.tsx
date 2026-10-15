'use client';

import * as React from 'react';
import type { CookingMode } from '@/components/cooking/cooking-mode-provider';
import { useHydrated } from '@/components/forms/use-hydrated';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// The switch, then Start over once a row is checked, after the switch so the switch never moves.
// Start over asks nothing first, since it only clears the marks on this device, and hands focus to
// the switch as it goes. The printout is the recipe without cooking mode, so neither prints.
function CookingModeControls({
	cookingMode: { progress, setOn, startOver },
}: {
	cookingMode: CookingMode;
}) {
	// A tap before hydration would toggle nothing, so the switch waits for it.
	const hydrated = useHydrated();
	const switchRef = React.useRef<HTMLElement>(null);

	return (
		<div className="flex min-h-8 flex-wrap items-center gap-x-6 gap-y-2 print:hidden pointer-coarse:min-h-11">
			<Label className="text-base pointer-coarse:min-h-11">
				<Switch
					ref={switchRef}
					checked={progress.on}
					onCheckedChange={setOn}
					disabled={!hydrated}
				/>
				Cooking mode
			</Label>
			{progress.on && progress.checked.size > 0 && (
				<Button
					variant="outline"
					size="sm"
					className="pointer-coarse:h-11 pointer-coarse:px-4"
					onClick={() => {
						switchRef.current?.focus();
						startOver();
					}}
				>
					Start over
				</Button>
			)}
		</div>
	);
}

export { CookingModeControls };
