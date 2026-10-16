'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import {
	changeEnd,
	steppedFieldUndo,
	undoCommandOfInput,
	undoCommandOfKeys,
	withTypedChange,
	type FieldUndo,
	type UndoCommand,
} from '@/components/forms/field-undo';

// A text field the form keeps its own undo for.
export type UndoableField = {
	// The control's id, by which focus and the browser's undo find the field.
	id: string;
	value: string;
	// Sets the field to each value typed into it, and to each value undo and redo step to.
	setValue: (value: string) => void;
};

type TextControl = HTMLInputElement | HTMLTextAreaElement;

// What the page's one listener asks of each useFieldUndo mounted: whether a control is one of its
// fields, and to step one.
type FieldUndoOwner = {
	owns: (target: EventTarget | null) => boolean;
	step: (control: TextControl, command: UndoCommand) => void;
};

const owners = new Set<FieldUndoOwner>();

function ownerOf(target: EventTarget | null): FieldUndoOwner | undefined {
	for (const owner of owners) {
		if (owner.owns(target)) {
			return owner;
		}
	}
	return undefined;
}

// The browser's own undo, as from its Edit menu, goes to the field its page-wide stack would change,
// which may not be the focused one. One listener serves every useFieldUndo: when the field it goes to,
// or the focused one, keeps its own undo, the browser's goes no further, and the focused field, if it
// keeps one, steps instead.
function handleHistoryInput(event: InputEvent) {
	const command = undoCommandOfInput(event.inputType);
	if (command === undefined) {
		return;
	}
	const focused = document.activeElement;
	const focusedOwner = ownerOf(focused);
	if (focusedOwner === undefined && ownerOf(event.target) === undefined) {
		return;
	}
	event.preventDefault();
	if (
		focusedOwner !== undefined &&
		(focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)
	) {
		focusedOwner.step(focused, command);
	}
}

// Apple's platforms take ⌘ for shortcuts where others take Ctrl, which MDN names as the use for
// navigator.platform.
function onApplePlatform(): boolean {
	return /^(Mac|iPhone|iPad)/u.test(navigator.platform);
}

// Undo and redo for the fields, each stepping through only what was typed into it. The browser's one
// undo stack for the page could change a field other than the focused one, and it redoes only what it
// undid itself, so the shortcuts are handled here and its own undo steps the focused field instead. A
// field the form changes some other way starts its steps over.
export function useFieldUndo(fields: readonly UndoableField[]) {
	const undos = React.useRef(new Map<string, FieldUndo>());

	function fieldWithId(id: string): UndoableField | undefined {
		return fields.find((field) => field.id === id);
	}

	// A layout effect, so no handler sees steps that end at a value the field no longer shows.
	React.useLayoutEffect(() => {
		for (const [id, undo] of undos.current) {
			if (fieldWithId(id)?.value !== undo.value) {
				undos.current.delete(id);
			}
		}
	});

	function step(control: TextControl, command: UndoCommand) {
		const field = fieldWithId(control.id);
		const undo = undos.current.get(control.id);
		const stepped = undo === undefined ? undefined : steppedFieldUndo(undo, command);
		if (field === undefined || stepped === undefined) {
			return;
		}
		undos.current.set(field.id, stepped);
		flushSync(() => field.setValue(stepped.value));
		const caret = changeEnd(field.value, stepped.value);
		control.setSelectionRange(caret, caret);
	}

	const owns = React.useEffectEvent(
		(target: EventTarget | null) =>
			target instanceof Element && fieldWithId(target.id) !== undefined
	);
	const stepOwned = React.useEffectEvent(step);

	React.useEffect(() => {
		const owner = { owns, step: stepOwned };
		if (owners.size === 0) {
			document.addEventListener('beforeinput', handleHistoryInput);
		}
		owners.add(owner);
		return () => {
			owners.delete(owner);
			if (owners.size === 0) {
				document.removeEventListener('beforeinput', handleHistoryInput);
			}
		};
	}, []);

	// Sets the field to a value typed into it, as one of its steps. The input event that typed it tells
	// what kind of change it was.
	function setTypedValue(id: string, value: string, event: Event) {
		const field = fieldWithId(id);
		if (field === undefined) {
			return;
		}
		if (value !== field.value) {
			const inputType = event instanceof InputEvent ? event.inputType : undefined;
			undos.current.set(id, withTypedChange(undos.current.get(id), field.value, value, inputType));
		}
		field.setValue(value);
	}

	// For each field's onKeyDown. True for an undo or redo shortcut, which the browser then never sees,
	// even with no step to take, since its own undo could change another field.
	function handleKeyDown(event: React.KeyboardEvent<TextControl>): boolean {
		const command = event.nativeEvent.isComposing
			? undefined
			: undoCommandOfKeys(event, onApplePlatform());
		if (command === undefined || fieldWithId(event.currentTarget.id) === undefined) {
			return false;
		}
		event.preventDefault();
		step(event.currentTarget, command);
		return true;
	}

	return { setTypedValue, handleKeyDown };
}
