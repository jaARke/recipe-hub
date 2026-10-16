import { describe, expect, it } from 'vitest';
import {
	changeEnd,
	steppedFieldUndo,
	undoCommandOfInput,
	undoCommandOfKeys,
	withTypedChange,
	type FieldUndo,
} from '@/components/forms/field-undo';

// The steps once each value in turn is typed into a field that showed the first, each change of
// the input type given with it.
function typed(start: string, changes: readonly (readonly [string, string?])[]): FieldUndo {
	let undo: FieldUndo | undefined;
	let value = start;
	for (const [next, inputType] of changes) {
		undo = withTypedChange(undo, value, next, inputType);
		value = next;
	}
	if (undo === undefined) {
		throw new Error('Nothing was typed.');
	}
	return undo;
}

function step(undo: FieldUndo | undefined, command: 'undo' | 'redo'): FieldUndo | undefined {
	return undo === undefined ? undefined : steppedFieldUndo(undo, command);
}

describe('withTypedChange', () => {
	it('makes one step of a run of typing, and another of typing where the caret moved to', () => {
		const undo = typed('flour', [
			['flour,', 'insertText'],
			['flour, ', 'insertText'],
			['flour, s', 'insertText'],
			['1flour, s', 'insertText'],
			['1 flour, s', 'insertText'],
		]);

		expect(undo.undoValues).toEqual(['flour', 'flour, s']);
		expect(undo.value).toBe('1 flour, s');
	});

	it('makes a step of deleting after typing, and one of a run of deleting either way', () => {
		expect(
			typed('2 egg', [
				['2 eggs', 'insertText'],
				['2 eggs,', 'insertText'],
				['2 eggs', 'deleteContentBackward'],
				['2 egg', 'deleteContentBackward'],
			]).undoValues
		).toEqual(['2 egg', '2 eggs,']);
		expect(
			typed('a cup', [
				[' cup', 'deleteContentForward'],
				['cup', 'deleteContentForward'],
			]).undoValues
		).toEqual(['a cup']);
	});

	it('keeps a composed character in the typing around it', () => {
		expect(
			typed('caf', [
				['caf´', 'insertCompositionText'],
				['café', 'insertCompositionText'],
				['café!', 'insertText'],
			]).undoValues
		).toEqual(['caf']);
	});

	it('makes a step of its own of a paste, a cut, or a change of no known kind', () => {
		expect(
			typed('flour', [
				['flour,', 'insertText'],
				['flour, sifted', 'insertFromPaste'],
				['flour, sifted!', 'insertText'],
				['flour, sifted', 'deleteByCut'],
				['flour, sifted.', undefined],
			]).undoValues
		).toEqual(['flour', 'flour,', 'flour, sifted', 'flour, sifted!', 'flour, sifted']);
	});
});

describe('steppedFieldUndo', () => {
	it('undoes and redoes step by step, and stops at either end', () => {
		const undo = typed('flour', [
			['flour,', 'insertText'],
			['1flour,', 'insertText'],
		]);

		const once = step(undo, 'undo');
		const twice = step(once, 'undo');
		expect(once?.value).toBe('flour,');
		expect(twice?.value).toBe('flour');
		expect(step(twice, 'undo')).toBeUndefined();

		const redone = step(step(twice, 'redo'), 'redo');
		expect(redone?.value).toBe('1flour,');
		expect(step(redone, 'redo')).toBeUndefined();
		expect(step(redone, 'undo')?.value).toBe('flour,');
	});

	it('drops what was undone once typing goes on, which starts a step of its own', () => {
		const undone = step(
			typed('flour', [
				['flour,', 'insertText'],
				['flour, s', 'insertText'],
			]),
			'undo'
		);
		if (undone === undefined) {
			throw new Error('Nothing was undone.');
		}

		const retyped = withTypedChange(undone, 'flour', 'flour.', 'insertText');
		expect(retyped).toEqual({
			undoValues: ['flour'],
			redoValues: [],
			value: 'flour.',
			lastChange: { kind: 'typing', from: 5, to: 6 },
		});
		expect(step(retyped, 'redo')).toBeUndefined();
	});
});

describe('changeEnd', () => {
	it('is where the changed text ends in the value after', () => {
		expect(changeEnd('2 eggs, beaten', '2 eggs')).toBe(6);
		expect(changeEnd('2 eggs', '2 eggs, beaten')).toBe(14);
		expect(changeEnd('About 1 cup flour', '1 cup flour')).toBe(0);
		expect(changeEnd('1 cup flour', '1 cup sugar')).toBe(10);
	});
});

describe('undoCommandOfKeys', () => {
	const none = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

	it('reads ⌘Z and ⇧⌘Z on Apple’s platforms, leaving Ctrl and ⌘Y alone', () => {
		expect(undoCommandOfKeys({ ...none, key: 'z', metaKey: true }, true)).toBe('undo');
		expect(undoCommandOfKeys({ ...none, key: 'Z', metaKey: true, shiftKey: true }, true)).toBe(
			'redo'
		);
		expect(undoCommandOfKeys({ ...none, key: 'z', ctrlKey: true }, true)).toBeUndefined();
		expect(undoCommandOfKeys({ ...none, key: 'y', metaKey: true }, true)).toBeUndefined();
		expect(undoCommandOfKeys({ ...none, key: 'y', ctrlKey: true }, true)).toBeUndefined();
		expect(
			undoCommandOfKeys({ ...none, key: 'z', metaKey: true, altKey: true }, true)
		).toBeUndefined();
	});

	it('reads Ctrl+Z, Ctrl+Y, and Ctrl+Shift+Z elsewhere, leaving the Windows key alone', () => {
		expect(undoCommandOfKeys({ ...none, key: 'z', ctrlKey: true }, false)).toBe('undo');
		expect(undoCommandOfKeys({ ...none, key: 'y', ctrlKey: true }, false)).toBe('redo');
		expect(undoCommandOfKeys({ ...none, key: 'Z', ctrlKey: true, shiftKey: true }, false)).toBe(
			'redo'
		);
		expect(undoCommandOfKeys({ ...none, key: 'z', metaKey: true }, false)).toBeUndefined();
		expect(undoCommandOfKeys({ ...none, key: 'z' }, false)).toBeUndefined();
	});
});

describe('undoCommandOfInput', () => {
	it('reads the browser’s own undo and redo, and nothing else', () => {
		expect(undoCommandOfInput('historyUndo')).toBe('undo');
		expect(undoCommandOfInput('historyRedo')).toBe('redo');
		expect(undoCommandOfInput('insertText')).toBeUndefined();
	});
});
