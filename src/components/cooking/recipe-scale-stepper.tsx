'use client';

import * as React from 'react';
import type { RecipeScale } from '@/components/cooking/use-cooking-url';
import { LiveAnnouncer, useLiveAnnouncement } from '@/components/forms/live-announcement';
import { useHydrated } from '@/components/forms/use-hydrated';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
	NumberField,
	NumberFieldDecrement,
	NumberFieldGroup,
	NumberFieldIncrement,
	NumberFieldInput,
} from '@/components/ui/number-field';
import {
	formatScaledYield,
	formatScaleStepperLabel,
	scaleFactor,
	scaleStepperValue,
} from '@/domain/recipe/recipe-yield';

// A tap leaves no keyboard focus to show, and focusing a field from one raises the phone's keyboard.
function pressedByTouch(event: React.MouseEvent): boolean {
	return 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType === 'touch';
}

// The stepper, labelled above it by what the recipe yields, then Reset while the recipe is scaled,
// after the stepper so its buttons never move under a finger. A typed value applies as it is typed,
// held to the stepper's steps, and the field shows the held value once it is left; each change the
// cook settles on, a press, an arrow key, or leaving the field, is announced as the yield it scales
// to. Every target is 44 px or more, for a cook's hands.
function RecipeScaleStepper({ scale }: { scale: RecipeScale }) {
	const { recipeYield, stepper, value, setValue } = scale;
	// A press before hydration would scale nothing, so the stepper waits for it.
	const hydrated = useHydrated();
	const inputId = React.useId();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const increaseRef = React.useRef<HTMLButtonElement>(null);
	const [announcement, announce] = useLiveAnnouncement();

	function announceValue(next: number) {
		announce(
			formatScaledYield(recipeYield, scaleFactor(stepper, scaleStepperValue(stepper, next)))
		);
	}

	// Reset leaves as it is pressed, so focus moves to the field, or after a tap to Increase, which
	// raises no keyboard.
	function reset(event: React.MouseEvent) {
		(pressedByTouch(event) ? increaseRef : inputRef).current?.focus();
		setValue(stepper.original);
		announceValue(stepper.original);
	}

	return (
		<div className="flex flex-col gap-3">
			<Label htmlFor={inputId} className="w-fit text-lg font-semibold">
				{formatScaleStepperLabel(recipeYield)}
			</Label>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<NumberField
					id={inputId}
					value={value}
					min={stepper.min}
					max={stepper.max}
					step={stepper.step}
					disabled={!hydrated}
					onValueChange={(next) => {
						// A cleared field keeps the scale until a number is typed.
						if (next !== null) {
							setValue(next);
						}
					}}
					onValueCommitted={(next) => {
						if (next !== null) {
							announceValue(next);
						}
					}}
				>
					<NumberFieldGroup className="h-12 bg-card">
						<NumberFieldDecrement className="size-12" />
						<NumberFieldInput ref={inputRef} className="w-16 font-heading text-2xl font-semibold" />
						<NumberFieldIncrement ref={increaseRef} className="size-12" />
					</NumberFieldGroup>
				</NumberField>
				{value !== stepper.original && (
					<Button variant="outline" className="h-11 px-4" onClick={reset}>
						Reset
					</Button>
				)}
			</div>
			<LiveAnnouncer announcement={announcement} />
		</div>
	);
}

export { RecipeScaleStepper };
