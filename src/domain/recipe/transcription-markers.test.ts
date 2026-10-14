import { describe, expect, it } from 'vitest';
import {
	transcriptionMarkerRuns,
	transcriptionMarkersIn,
} from '@/domain/recipe/transcription-markers';

describe('transcriptionMarkerRuns', () => {
	it('splits the text around each marker, keeping the rest as written', () => {
		expect(transcriptionMarkerRuns('1/2 c. butter [?], softened [illegible]')).toEqual([
			{ text: '1/2 c. butter ' },
			{ text: '[?]', marker: 'unsure' },
			{ text: ', softened ' },
			{ text: '[illegible]', marker: 'illegible' },
		]);
	});

	it('reads a capitalized marker, and markers side by side', () => {
		expect(transcriptionMarkerRuns('[Illegible][?]')).toEqual([
			{ text: '[Illegible]', marker: 'illegible' },
			{ text: '[?]', marker: 'unsure' },
		]);
	});

	it('leaves text without a marker whole, and a bare question mark alone', () => {
		expect(transcriptionMarkerRuns('Done? Cool [5 minutes].')).toEqual([
			{ text: 'Done? Cool [5 minutes].' },
		]);
		expect(transcriptionMarkerRuns('')).toEqual([]);
	});
});

describe('transcriptionMarkersIn', () => {
	it('names each kind of marker once, illegible first', () => {
		expect(transcriptionMarkersIn('Bake [?] until [illegible], then [?]')).toEqual([
			'illegible',
			'unsure',
		]);
		expect(transcriptionMarkersIn('Bake until golden.')).toEqual([]);
	});
});
