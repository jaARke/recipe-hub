import { describe, expect, it } from 'vitest';
import {
	ForbiddenError,
	requireAdmin,
	requireMember,
	SignInRequiredError,
} from '@/application/authorization';
import { adminActor, anonymousActor, memberActor } from '@/application/testing/actors';

describe('requireMember', () => {
	it('refuses an anonymous visitor', () => {
		expect(() => requireMember(anonymousActor())).toThrow(SignInRequiredError);
	});

	it.each([memberActor(), adminActor()])('returns the $role', (actor) => {
		expect(requireMember(actor)).toBe(actor);
	});
});

describe('requireAdmin', () => {
	it('refuses an anonymous visitor', () => {
		expect(() => requireAdmin(anonymousActor())).toThrow(SignInRequiredError);
	});

	it('refuses a member who is not an admin', () => {
		expect(() => requireAdmin(memberActor())).toThrow(ForbiddenError);
	});

	it('returns an admin', () => {
		const admin = adminActor();

		expect(requireAdmin(admin)).toBe(admin);
	});
});
