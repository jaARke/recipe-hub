import { onTestFinished, vi } from 'vitest';
import { prefersReducedMotion } from '@/lib/reduced-motion';

// Asks for less motion for this test alone, as a reader can: each zoom and pan then lands at once, so
// a test of where it lands waits on no animation frame, which WebKit on CI can go a second without.
// The test file mocks '@/lib/reduced-motion' with { spy: true }.
export function preferLessMotion() {
	if (!vi.isMockFunction(prefersReducedMotion)) {
		throw new Error("preferLessMotion needs vi.mock('@/lib/reduced-motion', { spy: true })");
	}
	const prefers = prefersReducedMotion;
	prefers.mockReturnValue(true);
	onTestFinished(() => {
		prefers.mockReset();
	});
}
