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
	// The control's id, by which focus, the browser's undo, and text typed before the page hydrated find
	// the field.
	id: string;
	value: string;
	// Sets the field to each value typed into it, and to each value undo and redo step to.
	setValue: (value: string) => void;
};

type TextControl = HTMLInputElement | HTMLTextAreaElement;

// What a reader left in a control: its text, and where its caret or selection was.
type ControlText = {
	value: string;
	selectionStart: number | null;
	selectionEnd: number | null;
};

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

function isTextControl(element: Node | null): element is TextControl {
	return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
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
	if (focusedOwner !== undefined && isTextControl(focused)) {
		focusedOwner.step(focused, command);
	}
}

// Apple's platforms take ⌘ for shortcuts where others take Ctrl, which MDN names as the use for
// navigator.platform.
function onApplePlatform(): boolean {
	return /^(Mac|iPhone|iPad)/u.test(navigator.platform);
}

// What the control shows for this value, as the browser normalizes it: an input drops line breaks,
// and a textarea makes each one a line feed. A copy of the control reads that without touching it.
function shownValue(control: TextControl, value: string): string {
	const copy = control.cloneNode(false);
	if (!isTextControl(copy)) {
		return value;
	}
	copy.value = value;
	return copy.value;
}

// What was typed into the fields' controls while the server's HTML showed and the page's script had
// yet to run: the text each control shows that its field's value doesn't. Fields created in the
// browser have no controls yet.
function textTypedBeforeHydration(
	fields: readonly UndoableField[]
): ReadonlyMap<string, ControlText> {
	const typed = new Map<string, ControlText>();
	for (const field of fields) {
		const control = document.getElementById(field.id);
		if (isTextControl(control) && control.value !== shownValue(control, field.value)) {
			const { value, selectionStart, selectionEnd } = control;
			typed.set(field.id, { value, selectionStart, selectionEnd });
		}
	}
	return typed;
}

// Undo and redo for the fields, each stepping through only what was typed into it. The browser's one
// undo stack for the page could change a field other than the focused one, and it redoes only what it
// undid itself, so the shortcuts are handled here and its own undo steps the focused field instead. A
// field the form changes some other way starts its steps over. Text typed before the page hydrated
// becomes the field's value, as one step.
export function useFieldUndo(fields: readonly UndoableField[]) {
	const undos = React.useRef(new Map<string, FieldUndo>());
	// Read as the fields first render, before hydrating a textarea sets it back to the server's text.
	const [typedBeforeHydration] = React.useState(() =>
		typeof document === 'undefined'
			? new Map<string, ControlText>()
			: textTypedBeforeHydration(fields)
	);

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
		if (field !== undefined) {
			setTyped(field, value, event instanceof InputEvent ? event.inputType : undefined);
		}
	}

	function setTyped(field: UndoableField, value: string, inputType: string | undefined) {
		if (value !== field.value) {
			undos.current.set(
				field.id,
				withTypedChange(undos.current.get(field.id), field.value, value, inputType)
			);
		}
		field.setValue(value);
	}

	// Each field takes what was typed before the page hydrated, or the next render would put the
	// server's text back in its control. A textarea hydration set back shows the text again first, with
	// its selection, so that render leaves the caret where the reader had it.
	const keepTypedBeforeHydration = React.useEffectEvent(() => {
		for (const [id, typed] of typedBeforeHydration) {
			const field = fieldWithId(id);
			const control = document.getElementById(id);
			if (field === undefined || !isTextControl(control)) {
				continue;
			}
			if (control.value !== typed.value) {
				control.value = typed.value;
				if (control === document.activeElement) {
					control.setSelectionRange(typed.selectionStart, typed.selectionEnd);
				}
			}
			setTyped(field, typed.value, undefined);
		}
	});

	// A layout effect, so the page never paints the server's text over what was typed. Once, not again
	// when a page Next keeps shows again.
	const keptTypedBeforeHydration = React.useRef(false);
	React.useLayoutEffect(() => {
		if (keptTypedBeforeHydration.current) {
			return;
		}
		keptTypedBeforeHydration.current = true;
		keepTypedBeforeHydration();
	}, []);

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
