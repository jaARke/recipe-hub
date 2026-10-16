import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

describe('DialogContent', () => {
	it('makes its close button 44 px under a finger', async () => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Rename passkey</DialogTitle>
				</DialogContent>
			</Dialog>
		);

		const close = await screen.findByRole('button', { name: 'Close' });
		expect(close.className.split(' ')).toContain('pointer-coarse:size-11');
	});
});
