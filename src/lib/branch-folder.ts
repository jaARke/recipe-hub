import { createHash } from 'node:crypto';

// A branch as one folder name: readable (lowercase letters and digits, every other run one hyphen),
// then a hash of the exact name, so feature/x and feature-x differ and no name comes out empty.
export function branchFolder(branch: string): string {
	const readable = branch
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	const hash = createHash('sha256').update(branch).digest('hex').slice(0, 8);
	return readable === '' ? hash : `${readable}-${hash}`;
}
