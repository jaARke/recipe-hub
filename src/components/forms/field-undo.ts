// A text field's own undo, which steps back only through what was typed into that field. A browser
// keeps one undo stack for its page, so its own undo can change a field other than the focused one.

export type UndoCommand = 'undo' | 'redo';

type ChangeKind = 'typing' | 'deleting';

// Where a change was typed: its start, and its end in the value after it.
type TypedChange = { kind: ChangeKind; from: number; to: number };

// A field's steps, each kept as the whole value, since the fields are short.
export type FieldUndo = {
	// The value before each step, the latest last.
	undoValues: readonly string[];
	// The value each undone step made, the latest undone last.
	redoValues: readonly string[];
	// What the steps end at.
	value: string;
	// The latest change typed, which the next one joins when it carries on from it.
	lastChange?: TypedChange;
};

// Browsers make one step of a run of typing, or of deleting, and one of anything else, such as a
// paste, a cut, or a spelling fix. The keys are the Input Events spec's inputType values.
const changeKinds = new Map<string, ChangeKind>([
	['insertText', 'typing'],
	['insertCompositionText', 'typing'],
	['insertLineBreak', 'typing'],
	['deleteContent', 'deleting'],
	['deleteContentBackward', 'deleting'],
	['deleteContentForward', 'deleting'],
	['deleteWordBackward', 'deleting'],
	['deleteWordForward', 'deleting'],
	['deleteSoftLineBackward', 'deleting'],
	['deleteSoftLineForward', 'deleting'],
	['deleteEntireSoftLine', 'deleting'],
	['deleteHardLineBackward', 'deleting'],
	['deleteHardLineForward', 'deleting'],
]);

const historyCommands = new Map<string, UndoCommand>([
	['historyUndo', 'undo'],
	['historyRedo', 'redo'],
]);

// The part of a value a change replaced: where it starts, and where it ends before and after.
type ChangedSpan = { from: number; endBefore: number; endAfter: number };

function changedSpan(before: string, after: string): ChangedSpan {
	const shorter = Math.min(before.length, after.length);
	let from = 0;
	while (from < shorter && before[from] === after[from]) {
		from += 1;
	}
	let unchangedEnd = 0;
	while (
		unchangedEnd < shorter - from &&
		before[before.length - 1 - unchangedEnd] === after[after.length - 1 - unchangedEnd]
	) {
		unchangedEnd += 1;
	}
	return { from, endBefore: before.length - unchangedEnd, endAfter: after.length - unchangedEnd };
}

function continues(
	last: TypedChange | undefined,
	kind: ChangeKind | undefined,
	span: ChangedSpan
): boolean {
	return (
		last !== undefined && last.kind === kind && span.from <= last.to && span.endBefore >= last.from
	);
}

// The field's steps once a change is typed into it, given the steps that end at the value before.
// A change joins the step before it when it is the same kind and starts where the latest change left
// off, as browsers group typing; moving the caret, or turning from typing to deleting, starts a step.
export function withTypedChange(
	undo: FieldUndo | undefined,
	before: string,
	after: string,
	inputType: string | undefined
): FieldUndo {
	const kind = inputType === undefined ? undefined : changeKinds.get(inputType);
	const span = changedSpan(before, after);
	const lastChange = kind === undefined ? undefined : { kind, from: span.from, to: span.endAfter };
	if (undo !== undefined && continues(undo.lastChange, kind, span)) {
		return { undoValues: undo.undoValues, redoValues: [], value: after, lastChange };
	}
	return {
		undoValues: [...(undo?.undoValues ?? []), before],
		redoValues: [],
		value: after,
		lastChange,
	};
}

// The field's steps once one is undone or redone, or undefined where there is none to take. Typing
// after either starts a new step.
export function steppedFieldUndo(undo: FieldUndo, command: UndoCommand): FieldUndo | undefined {
	if (command === 'undo') {
		const value = undo.undoValues.at(-1);
		return value === undefined
			? undefined
			: {
					undoValues: undo.undoValues.slice(0, -1),
					redoValues: [...undo.redoValues, undo.value],
					value,
				};
	}
	const value = undo.redoValues.at(-1);
	return value === undefined
		? undefined
		: {
				undoValues: [...undo.undoValues, undo.value],
				redoValues: undo.redoValues.slice(0, -1),
				value,
			};
}

// Where the text a step changed ends, which is where undo and redo leave the caret.
export function changeEnd(before: string, after: string): number {
	return changedSpan(before, after).endAfter;
}

type UndoKeys = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

// ⌘Z and ⇧⌘Z on Apple's platforms; Ctrl+Z, and Ctrl+Y or Ctrl+Shift+Z, elsewhere. On a Mac, Ctrl+Y
// pastes what Ctrl+K cut, and ⌘Y opens the browser's history.
export function undoCommandOfKeys(keys: UndoKeys, apple: boolean): UndoCommand | undefined {
	const held = apple ? keys.metaKey && !keys.ctrlKey : keys.ctrlKey && !keys.metaKey;
	if (!held || keys.altKey) {
		return undefined;
	}
	switch (keys.key.toLowerCase()) {
		case 'z':
			return keys.shiftKey ? 'redo' : 'undo';
		case 'y':
			return apple || keys.shiftKey ? undefined : 'redo';
		default:
			return undefined;
	}
}

// The browser's own undo or redo, as from its Edit menu or a gesture.
export function undoCommandOfInput(inputType: string): UndoCommand | undefined {
	return historyCommands.get(inputType);
}
