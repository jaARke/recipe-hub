'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { LiveAnnouncer, useLiveAnnouncement } from '@/components/forms/live-announcement';
import { useHydrated } from '@/components/forms/use-hydrated';
import type { RecipeScale } from '@/components/recipe/recipe-scale-provider';
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
	formatScaledToLine,
	formatScaledYield,
	formatScaleStepperLabel,
	scaleFactor,
	scaleStepperValue,
} from '@/domain/recipe/recipe-yield';

const smallButtonClassName = 'pointer-coarse:h-11 pointer-coarse:px-4';

// A tap leaves no keyboard focus to show, and focusing a field from one raises the phone's keyboard.
function pressedByTouch(event: React.MouseEvent): boolean {
	return 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType === 'touch';
}

// The stepper, labelled above it by what the recipe yields, then Reset while the recipe is scaled
// and the caller's action. A typed value applies as it is typed, held to the stepper's steps, and
// the field shows the held value once it is left; each change the reader settles on, a press, an
// arrow key, or leaving the field, is announced as the yield it scales to.
function RecipeScaleStepper({ scale, action }: { scale: RecipeScale; action?: React.ReactNode }) {
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
		<div className="flex flex-col gap-2">
			<Label htmlFor={inputId} className="text-base">
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
					<NumberFieldGroup>
						<NumberFieldDecrement />
						<NumberFieldInput ref={inputRef} />
						<NumberFieldIncrement ref={increaseRef} />
					</NumberFieldGroup>
				</NumberField>
				{value !== stepper.original && (
					<Button variant="outline" size="sm" className={smallButtonClassName} onClick={reset}>
						Reset
					</Button>
				)}
				{action}
			</div>
			<LiveAnnouncer announcement={announcement} />
		</div>
	);
}

// What the scale reads as text: the yield at the recipe's own scale, or what it is scaled to.
function scaleText({ recipeYield, factor }: RecipeScale): string {
	return factor === 1
		? formatScaledYield(recipeYield, factor)
		: formatScaledToLine(recipeYield, factor);
}

// In cooking mode the scale is text, so a finger resting on the screen cannot rescale the recipe
// mid-cook; Change brings the stepper back, with Done in its row to return to the text.
function CookingScale({ scale }: { scale: RecipeScale }) {
	const [changing, setChanging] = React.useState(false);
	const toggleId = React.useId();

	// The button moves between the text's row and the stepper's, so focus moves with it.
	function toggle() {
		flushSync(() => setChanging(!changing));
		document.getElementById(toggleId)?.focus();
	}

	const toggleButton = (
		<Button
			id={toggleId}
			variant="outline"
			size="sm"
			className={smallButtonClassName}
			onClick={toggle}
		>
			{changing ? 'Done' : 'Change'}
		</Button>
	);
	return changing ? (
		<RecipeScaleStepper scale={scale} action={toggleButton} />
	) : (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<p className="text-base">{scaleText(scale)}</p>
			{toggleButton}
		</div>
	);
}

// The recipe's scale at its Ingredients heading: the stepper, or in cooking mode the scale as text.
// The printout shows neither, and says what a scaled recipe was scaled to.
function RecipeScaleControls({ scale, cooking }: { scale: RecipeScale; cooking: boolean }) {
	return (
		<>
			<div className="print:hidden">
				{cooking ? <CookingScale scale={scale} /> : <RecipeScaleStepper scale={scale} />}
			</div>
			{scale.factor !== 1 && (
				<p className="hidden text-base print:block">
					{formatScaledToLine(scale.recipeYield, scale.factor)}
				</p>
			)}
		</>
	);
}

export { RecipeScaleControls };
