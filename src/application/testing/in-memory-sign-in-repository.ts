import type { SignInRepository } from '@/application/ports/sign-in-repository';

// Holds only when each session and verification expires, which is all the port reads.
export class InMemorySignInRepository implements SignInRepository {
	private sessionExpiries: Date[] = [];
	private verificationExpiries: Date[] = [];

	get sessionCount(): number {
		return this.sessionExpiries.length;
	}

	get verificationCount(): number {
		return this.verificationExpiries.length;
	}

	async deleteSessionsExpiredBefore(cutoff: Date): Promise<number> {
		const kept = this.sessionExpiries.filter((expiresAt) => expiresAt >= cutoff);
		const deleted = this.sessionExpiries.length - kept.length;
		this.sessionExpiries = kept;
		return deleted;
	}

	async deleteVerificationsExpiredBefore(cutoff: Date): Promise<number> {
		const kept = this.verificationExpiries.filter((expiresAt) => expiresAt >= cutoff);
		const deleted = this.verificationExpiries.length - kept.length;
		this.verificationExpiries = kept;
		return deleted;
	}

	// Stands in for Better Auth, which starts a session at each sign-in.
	addSession(expiresAt: Date): void {
		this.sessionExpiries.push(expiresAt);
	}

	// Stands in for Better Auth, which stores a verification for each code and passkey challenge.
	addVerification(expiresAt: Date): void {
		this.verificationExpiries.push(expiresAt);
	}
}
