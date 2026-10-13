import 'server-only';
import {
	createRemoteJWKSet,
	customFetch,
	errors,
	jwtVerify,
	type FetchImplementation,
	type JWTPayload,
	type RemoteJWKSet,
} from 'jose';

// GitHub Actions' OIDC issuer, the key set it publishes, and the one algorithm it signs with.
const githubIssuer = 'https://token.actions.githubusercontent.com';
const githubKeySetUrl = new URL(`${githubIssuer}/.well-known/jwks`);
const githubSigningAlgorithm = 'RS256';

// The job a token must come from, by the claims GitHub sets on every Actions token.
export type GitHubActionsJob = {
	// The audience the job asked for its token.
	audience: string;
	// The repository, as owner/name.
	repository: string;
	// The workflow file that ran and the ref it ran from, as owner/name/path@ref. GitHub sets
	// workflow_ref on every token; job_workflow_ref only names a reusable workflow.
	workflowRef: string;
	// The event that started the run.
	eventName: string;
};

type GitHubActionsTokenVerifierOptions = GitHubActionsJob & {
	// jose's seam for tests: GitHub's key set is fetched through it, and every check still runs.
	fetch?: FetchImplementation;
};

// jose's errors are refusals of the token, except a key set GitHub failed to serve (a timeout, a
// response that is not a key set, or a malformed one), which is an outage and is thrown on.
function isRefusal(error: unknown): boolean {
	return (
		error instanceof errors.JOSEError &&
		error.code !== errors.JOSEError.code &&
		!(error instanceof errors.JWKSTimeout) &&
		!(error instanceof errors.JWKSInvalid)
	);
}

// Verifies that a token is a GitHub Actions OIDC token from one job. GitHub's keys are fetched on
// first use and kept, as jose's remote key set does, so each instance should live as long as the app.
export class GitHubActionsTokenVerifier {
	private readonly job: GitHubActionsJob;
	private readonly keys: RemoteJWKSet;

	constructor(options: GitHubActionsTokenVerifierOptions) {
		const { fetch, ...job } = options;
		this.job = job;
		this.keys = createRemoteJWKSet(githubKeySetUrl, { [customFetch]: fetch });
	}

	// Signed by GitHub, unexpired, for the audience, and naming the job's repository, workflow, and
	// event. Throws only when GitHub's keys cannot be read.
	async verify(token: string): Promise<boolean> {
		let claims: JWTPayload;
		try {
			({ payload: claims } = await jwtVerify(token, this.keys, {
				issuer: githubIssuer,
				audience: this.job.audience,
				algorithms: [githubSigningAlgorithm],
				requiredClaims: ['exp'],
			}));
		} catch (error) {
			if (isRefusal(error)) {
				return false;
			}
			throw error;
		}

		return (
			claims.repository === this.job.repository &&
			claims.workflow_ref === this.job.workflowRef &&
			claims.event_name === this.job.eventName
		);
	}
}
