import {
	exportJWK,
	generateKeyPair,
	SignJWT,
	UnsecuredJWT,
	type CryptoKey,
	type FetchImplementation,
	type JWK,
	type JWTPayload,
} from 'jose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	GitHubActionsTokenVerifier,
	type GitHubActionsJob,
} from '@/infrastructure/auth/github-actions-token-verifier';

const issuer = 'https://token.actions.githubusercontent.com';
const keyId = 'github-test-key';

const job: GitHubActionsJob = {
	audience: 'https://github.com/octo-org',
	repository: 'octo-org/octo-repo',
	workflowRef: 'octo-org/octo-repo/.github/workflows/cleanup.yml@refs/heads/main',
	eventName: 'pull_request_target',
};

// What GitHub puts in the job's token, beyond the times it sets when signing.
const jobClaims: JWTPayload = {
	iss: issuer,
	aud: job.audience,
	repository: job.repository,
	workflow_ref: job.workflowRef,
	event_name: job.eventName,
};

let githubKey: CryptoKey;
let otherKey: CryptoKey;
let keySet: { keys: JWK[] };
let fetchedUrls: string[];

beforeAll(async () => {
	const github = await generateKeyPair('RS256');
	githubKey = github.privateKey;
	otherKey = (await generateKeyPair('RS256')).privateKey;
	keySet = {
		keys: [{ ...(await exportJWK(github.publicKey)), kid: keyId, alg: 'RS256', use: 'sig' }],
	};
});

beforeEach(() => {
	fetchedUrls = [];
});

// GitHub's key set, served locally through jose's fetch seam, so no request leaves the test.
const serveKeySet: FetchImplementation = async (url) => {
	fetchedUrls.push(url);
	return Response.json(keySet);
};

function createVerifier(fetch: FetchImplementation = serveKeySet): GitHubActionsTokenVerifier {
	return new GitHubActionsTokenVerifier({ ...job, fetch });
}

// A token as GitHub issues it for the job, with any claim replaced.
function signToken(
	claims: JWTPayload = {},
	{ key = githubKey, expiresAt = '5m' }: { key?: CryptoKey; expiresAt?: string | number } = {}
): Promise<string> {
	return new SignJWT({ ...jobClaims, ...claims })
		.setProtectedHeader({ alg: 'RS256', kid: keyId })
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(key);
}

describe('verify', () => {
	it("accepts the job's token, checked against GitHub's key set", async () => {
		await expect(createVerifier().verify(await signToken())).resolves.toBe(true);
		expect(fetchedUrls).toEqual(['https://token.actions.githubusercontent.com/.well-known/jwks']);
	});

	it('keeps the key set for later tokens', async () => {
		const verifier = createVerifier();

		await verifier.verify(await signToken());
		await verifier.verify(await signToken());

		expect(fetchedUrls).toHaveLength(1);
	});

	it.each([
		['another repository', { repository: 'octo-org/other-repo' }],
		[
			'another workflow',
			{ workflow_ref: 'octo-org/octo-repo/.github/workflows/ci.yml@refs/heads/main' },
		],
		[
			'the workflow from another branch',
			{ workflow_ref: 'octo-org/octo-repo/.github/workflows/cleanup.yml@refs/heads/feature' },
		],
		['another event', { event_name: 'pull_request' }],
		['another audience', { aud: 'https://github.com/other-org' }],
		['another issuer', { iss: 'https://issuer.example.com' }],
		['no repository', { repository: undefined }],
	])('refuses a token for %s', async (_, claims) => {
		await expect(createVerifier().verify(await signToken(claims))).resolves.toBe(false);
	});

	it('refuses an expired token', async () => {
		const expired = await signToken({}, { expiresAt: Math.floor(Date.now() / 1000) - 60 });

		await expect(createVerifier().verify(expired)).resolves.toBe(false);
	});

	it('refuses a token without an expiry', async () => {
		const token = await new SignJWT(jobClaims)
			.setProtectedHeader({ alg: 'RS256', kid: keyId })
			.sign(githubKey);

		await expect(createVerifier().verify(token)).resolves.toBe(false);
	});

	it('refuses an unsigned token', async () => {
		const unsigned = new UnsecuredJWT(jobClaims).setExpirationTime('5m').encode();

		await expect(createVerifier().verify(unsigned)).resolves.toBe(false);
	});

	it("refuses a token signed with a key that is not GitHub's", async () => {
		const forged = await signToken({}, { key: otherKey });

		await expect(createVerifier().verify(forged)).resolves.toBe(false);
	});

	it('refuses a token that is not a JWT', async () => {
		await expect(createVerifier().verify('not-a-token')).resolves.toBe(false);
	});

	it('throws when GitHub fails to serve its key set, as an outage rather than a refusal', async () => {
		const unavailable: FetchImplementation = async () => new Response(null, { status: 503 });

		await expect(createVerifier(unavailable).verify(await signToken())).rejects.toThrow();
	});
});
