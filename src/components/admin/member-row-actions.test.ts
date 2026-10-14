import { describe, expect, it } from 'vitest';
import { memberRowActions } from '@/components/admin/member-row-actions';

describe('memberRowActions', () => {
	it("offers a role change and removal on another member's row", () => {
		expect(memberRowActions({ isCurrentMember: false, isOwner: false })).toEqual({
			changeRole: true,
			removeMember: true,
		});
	});

	it("offers only a role change on the admin's own row", () => {
		expect(memberRowActions({ isCurrentMember: true, isOwner: false })).toEqual({
			changeRole: true,
			removeMember: false,
		});
	});

	it("offers nothing on the owner's row, whoever reads it", () => {
		const nothing = { changeRole: false, removeMember: false };

		expect(memberRowActions({ isCurrentMember: false, isOwner: true })).toEqual(nothing);
		expect(memberRowActions({ isCurrentMember: true, isOwner: true })).toEqual(nothing);
	});
});
