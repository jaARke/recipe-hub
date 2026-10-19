import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { Button, buttonVariants } from '@/components/ui/button';

describe('buttonVariants', () => {
	it("gives a link drawn as an outline button its variant's border color, not the base's", () => {
		const classes = buttonVariants({ variant: 'outline' }).split(' ');

		expect(classes).toContain('border-edge');
		expect(classes).not.toContain('border-transparent');
	});
});

describe('Button', () => {
	it('points the cursor at it as a link does, until it is disabled', async () => {
		await render(
			<>
				<Button>Save</Button>
				<Button disabled>Saving</Button>
			</>
		);

		expect(getComputedStyle(page.getByRole('button', { name: 'Save' }).element()).cursor).toBe(
			'pointer'
		);
		expect(
			getComputedStyle(page.getByRole('button', { name: 'Saving' }).element()).cursor
		).not.toBe('pointer');
	});
});
