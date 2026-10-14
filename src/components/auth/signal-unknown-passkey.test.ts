import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signalUnknownPasskey } from '@/components/auth/signal-unknown-passkey';

const credentialId = 'c2FtcGxlLWNyZWRlbnRpYWw';

beforeEach(() => {
	vi.stubGlobal('location', { hostname: 'recipes.example.com' });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('signalUnknownPasskey', () => {
	it("signals the credential with the page's host as its RP ID", async () => {
		const signalUnknownCredential = vi.fn(async () => {});
		vi.stubGlobal('PublicKeyCredential', { signalUnknownCredential });

		await signalUnknownPasskey(credentialId);

		expect(signalUnknownCredential).toHaveBeenCalledExactlyOnceWith({
			rpId: 'recipes.example.com',
			credentialId,
		});
	});

	it('does nothing in a browser without the Signal API', async () => {
		vi.stubGlobal('PublicKeyCredential', {});

		await expect(signalUnknownPasskey(credentialId)).resolves.toBeUndefined();
	});

	it('does nothing in a browser without WebAuthn', async () => {
		vi.stubGlobal('PublicKeyCredential', undefined);

		await expect(signalUnknownPasskey(credentialId)).resolves.toBeUndefined();
	});

	it('settles when the browser refuses the signal', async () => {
		vi.stubGlobal('PublicKeyCredential', {
			signalUnknownCredential: vi.fn(async () => {
				throw new DOMException('The RP ID does not match the page.', 'SecurityError');
			}),
		});

		await expect(signalUnknownPasskey(credentialId)).resolves.toBeUndefined();
	});
});
