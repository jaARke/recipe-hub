import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/button';

describe('buttonVariants', () => {
	it("gives a link drawn as an outline button its variant's border color, not the base's", () => {
		const classes = buttonVariants({ variant: 'outline' }).split(' ');

		expect(classes).toContain('border-edge');
		expect(classes).not.toContain('border-transparent');
	});
});
