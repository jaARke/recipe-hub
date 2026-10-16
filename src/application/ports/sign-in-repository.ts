import 'server-only';

// What Better Auth stores for signing in: a session for each sign-in, with the IP address and browser
// it began from, and a verification for each sign-in code or passkey challenge until it is used.
// Better Auth refuses either once it expires but keeps its row.
export interface SignInRepository {
	// Deletes every session that expired before the given time, and returns how many it deleted.
	deleteSessionsExpiredBefore(cutoff: Date): Promise<number>;
	// Deletes every verification that expired before the given time, and returns how many it deleted.
	deleteVerificationsExpiredBefore(cutoff: Date): Promise<number>;
}
