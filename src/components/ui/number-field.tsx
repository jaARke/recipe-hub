'use client';

import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field';
import { cn } from 'cn';
import { MinusIcon, PlusIcon } from 'lucide-react';

// shadcn has no Base UI item for a number field: this follows its input, with 44 px steppers.

function NumberField({ className, ...props }: NumberFieldPrimitive.Root.Props) {
	return (
		<NumberFieldPrimitive.Root
			data-slot="number-field"
			className={cn('flex flex-col gap-2', className)}
			{...props}
		/>
	);
}

function NumberFieldGroup({ className, ...props }: NumberFieldPrimitive.Group.Props) {
	return (
		<NumberFieldPrimitive.Group
			data-slot="number-field-group"
			className={cn(
				'flex h-11 w-fit items-stretch overflow-hidden rounded-md border border-input shadow-xs transition-[color,box-shadow] has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 dark:bg-input/30 data-disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

// Hovered, the ghost button's state layer, over the field's surface.
const stepperClassName =
	"flex size-11 shrink-0 items-center justify-center text-foreground transition-colors outline-none select-none hover:bg-state-layer data-disabled:pointer-events-none data-disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4";

function NumberFieldDecrement({
	className,
	children,
	...props
}: NumberFieldPrimitive.Decrement.Props) {
	return (
		<NumberFieldPrimitive.Decrement
			data-slot="number-field-decrement"
			className={cn(stepperClassName, className)}
			{...props}
		>
			{children ?? <MinusIcon aria-hidden="true" />}
		</NumberFieldPrimitive.Decrement>
	);
}

function NumberFieldIncrement({
	className,
	children,
	...props
}: NumberFieldPrimitive.Increment.Props) {
	return (
		<NumberFieldPrimitive.Increment
			data-slot="number-field-increment"
			className={cn(stepperClassName, className)}
			{...props}
		>
			{children ?? <PlusIcon aria-hidden="true" />}
		</NumberFieldPrimitive.Increment>
	);
}

function NumberFieldInput({ className, ...props }: NumberFieldPrimitive.Input.Props) {
	return (
		<NumberFieldPrimitive.Input
			data-slot="number-field-input"
			className={cn(
				'w-16 min-w-0 border-x border-input bg-transparent px-2 text-center text-base tabular-nums outline-none disabled:cursor-not-allowed',
				className
			)}
			{...props}
		/>
	);
}

export {
	NumberField,
	NumberFieldDecrement,
	NumberFieldGroup,
	NumberFieldIncrement,
	NumberFieldInput,
};
