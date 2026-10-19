import { describe, expect, it } from 'vitest';
import { memberRowActions } from '@/components/admin/member-row-actions';

const row = { isCurrentMember: false, isOwner: false } as const;

describe('memberRowActions', () => {
	it.each([true, false])(
		"offers a role change and removal on another member's row, whether or not the owner reads it (%s)",
		(readerIsOwner) => {
			expect(memberRowActions({ ...row, role: 'member' }, readerIsOwner)).toEqual({
				changeRole: true,
				removeMember: true,
			});
		}
	);

	it("offers the owner a role change and removal on another admin's row", () => {
		expect(memberRowActions({ ...row, role: 'admin' }, true)).toEqual({
			changeRole: true,
			removeMember: true,
		});
	});

	it("offers another admin nothing on an admin's row", () => {
		expect(memberRowActions({ ...row, role: 'admin' }, false)).toEqual({
			changeRole: false,
			removeMember: false,
		});
	});

	it("offers only a role change on the admin's own row", () => {
		expect(memberRowActions({ ...row, isCurrentMember: true, role: 'admin' }, false)).toEqual({
			changeRole: true,
			removeMember: false,
		});
	});

	it("offers nothing on the owner's row while it's an admin, whoever reads it", () => {
		const nothing = { changeRole: false, removeMember: false };
		const owner = { isOwner: true, role: 'admin' } as const;

		expect(memberRowActions({ ...owner, isCurrentMember: false }, false)).toEqual(nothing);
		expect(memberRowActions({ ...owner, isCurrentMember: true }, true)).toEqual(nothing);
	});

	it("offers only Make admin on the owner's row while it's a member", () => {
		expect(memberRowActions({ ...row, isOwner: true, role: 'member' }, false)).toEqual({
			changeRole: true,
			removeMember: false,
		});
	});
});
