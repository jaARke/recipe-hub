import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';

// Flags in the authenticator data: user present and verified, backed up, with a credential attached.
const registrationFlags = 0x01 | 0x04 | 0x08 | 0x10 | 0x40;

// A new P-256 public key as COSE: key type EC2, algorithm ES256, curve P-256, then x and y.
function cosePublicKey(): Uint8Array {
	const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
	const { x, y } = publicKey.export({ format: 'jwk' });
	return isoCBOR.encode(
		new Map<number, number | Uint8Array>([
			[1, 2],
			[3, -7],
			[-1, 1],
			[-2, Buffer.from(x ?? '', 'base64url')],
			[-3, Buffer.from(y ?? '', 'base64url')],
		])
	);
}

type PasskeyRegistration = {
	// From the registration options Better Auth sent.
	challenge: string;
	origin: string;
	// Names the authenticator's model, such as a password manager.
	aaguid: string;
};

// What a browser sends to verify a new passkey, as an authenticator makes one without attestation,
// which the passkey plugin asks for. The RP ID is the origin's host, as a browser's default is.
export function passkeyRegistrationResponse({ challenge, origin, aaguid }: PasskeyRegistration) {
	const credentialId = randomBytes(16);
	const credentialIdLength = Buffer.alloc(2);
	credentialIdLength.writeUInt16BE(credentialId.length);
	const authenticatorData = Buffer.concat([
		createHash('sha256').update(new URL(origin).hostname).digest(),
		Buffer.of(registrationFlags),
		// The signature counter.
		Buffer.alloc(4),
		Buffer.from(aaguid.replaceAll('-', ''), 'hex'),
		credentialIdLength,
		credentialId,
		cosePublicKey(),
	]);
	const attestationObject = isoCBOR.encode(
		new Map<string, string | Uint8Array | Map<string, string>>([
			['fmt', 'none'],
			['attStmt', new Map<string, string>()],
			['authData', authenticatorData],
		])
	);
	const clientData = { type: 'webauthn.create', challenge, origin, crossOrigin: false };

	return {
		id: credentialId.toString('base64url'),
		rawId: credentialId.toString('base64url'),
		type: 'public-key',
		response: {
			clientDataJSON: Buffer.from(JSON.stringify(clientData)).toString('base64url'),
			attestationObject: Buffer.from(attestationObject).toString('base64url'),
			transports: ['internal'],
		},
		clientExtensionResults: {},
	};
}
