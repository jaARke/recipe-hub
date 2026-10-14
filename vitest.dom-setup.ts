import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library unmounts after each test only where the runner's hooks are globals; Vitest's are not.
afterEach(() => {
	cleanup();
});
