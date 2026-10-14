// The WebAuthn Signal API's method, which TypeScript's DOM types don't include yet.
type SignalingPublicKeyCredential = typeof PublicKeyCredential & {
	signalUnknownCredential?: (options: { rpId: string; credentialId: string }) => Promise<void>;
};

// Tells the browser the site no longer knows a passkey, so a password manager that supports the
// Signal API can stop offering it or delete it. The RP ID is the page's host, as the server's is.
// Browsers without the method are left alone, and a refused signal changes nothing for the visitor.
export async function signalUnknownPasskey(credentialId: string): Promise<void> {
	if (typeof PublicKeyCredential === 'undefined') {
		return;
	}
	const credentials: SignalingPublicKeyCredential = PublicKeyCredential;
	if (typeof credentials.signalUnknownCredential !== 'function') {
		return;
	}

	// The browser refuses an id it can't decode or an RP ID that doesn't match the page.
	await credentials
		.signalUnknownCredential({ rpId: location.hostname, credentialId })
		.catch(() => {});
}
