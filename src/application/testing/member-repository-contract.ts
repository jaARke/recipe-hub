import { describe, expect, it } from 'vitest';
import { MemberRoleConflictError } from '@/application/members/errors';
import type { FavoriteRepository } from '@/application/ports/favorite-repository';
import type { InviteRepository } from '@/application/ports/invite-repository';
import type { MemberRepository, NewMember } from '@/application/ports/member-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SavedDraft, SavedDraftRepository } from '@/application/ports/saved-draft-repository';
import { inviteExpiry, type Invite } from '@/domain/member/invite';
import { memberIdSchema, removedMemberEmail, type MemberId } from '@/domain/member/member';
import { recipeContentSchema, type Recipe, type RecipeContentInput } from '@/domain/recipe/recipe';
import { sampleChickenSoup, sampleTomatoSalad } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';

export type MemberRepositoryFixture = {
	members: MemberRepository;
	// Where the invites a removal revokes are stored.
	invites: InviteRepository;
	// Where the favorites a removal deletes are stored, and the recipes they name.
	favorites: FavoriteRepository;
	recipes: RecipeRepository;
	// Where the saved drafts a removal deletes are stored.
	drafts: SavedDraftRepository;
};

const missingId = memberIdSchema.parse('0199c7a4-2c3e-7b1a-9f00-2a7c1e4b5d6e');

const ada: NewMember = { email: 'ada@example.com', displayName: 'Ada', role: 'member' };
const grace: NewMember = { email: 'grace@example.com', displayName: 'Grace', role: 'admin' };
const lin: NewMember = { email: 'lin@example.com', displayName: 'Lin', role: 'admin' };

// What every MemberRepository guarantees. The caller provides a fresh, empty fixture for each test.
export function describeMemberRepositoryContract(fixture: () => MemberRepositoryFixture): void {
	// An open invite from the admin, bound to the address as the invitee would bind it.
	async function inviteTo(email: string, createdBy: MemberId): Promise<Invite> {
		const { invites } = fixture();
		const invite = await invites.create({
			tokenHash: crypto.randomUUID(),
			displayName: 'Invitee',
			role: 'member',
			createdBy,
			expiresAt: inviteExpiry(new Date()),
		});
		const bound = await invites.bindEmail(invite.id, email, new Date());
		if (bound === null) {
			throw new Error('The invite was not open');
		}
		return bound;
	}

	async function createRecipe(input: RecipeContentInput, contributorId: MemberId): Promise<Recipe> {
		const content = recipeContentSchema.parse(input);
		return fixture().recipes.create({
			content,
			provenance: { entryMode: 'manual' },
			contributorId,
			slugBase: slugify(content.title),
		});
	}

	async function saveDraft(memberId: MemberId): Promise<SavedDraft> {
		const draft = await fixture().drafts.create({
			memberId,
			title: 'Lemon bars',
			values: { title: 'Lemon bars' },
			imagePathnames: [],
		});
		if (draft === null) {
			throw new Error('The draft was refused');
		}
		return draft;
	}

	describe('create', () => {
		it('stores the member and reads it back', async () => {
			const { members } = fixture();

			const created = await members.create(ada);

			expect(created).toEqual({ ...ada, id: expect.any(String), createdAt: expect.any(Date) });
			expect(await members.findById(created.id)).toEqual(created);
		});
	});

	describe('findById and findByEmail', () => {
		it('find a stored member', async () => {
			const { members } = fixture();
			const created = await members.create(ada);

			expect(await members.findById(created.id)).toEqual(created);
			expect(await members.findByEmail('ada@example.com')).toEqual(created);
		});

		it('return null when nothing matches', async () => {
			const { members } = fixture();
			await members.create(ada);

			expect(await members.findById(missingId)).toBeNull();
			expect(await members.findByEmail('grace@example.com')).toBeNull();
		});

		it('compare addresses exactly, since callers lowercase them', async () => {
			const { members } = fixture();
			await members.create(ada);

			expect(await members.findByEmail('Ada@Example.com')).toBeNull();
		});
	});

	describe('list and listAdmins', () => {
		it('list every member oldest first, and the admins alone', async () => {
			const { members } = fixture();
			const created = [];
			for (const member of [grace, ada, lin]) {
				created.push(await members.create(member));
			}

			expect(await members.list()).toEqual(created);
			expect(await members.listAdmins()).toEqual([created[0], created[2]]);
		});
	});

	describe('ensureAdmin', () => {
		const owner = { email: 'owner@example.com', displayName: 'Admin' };

		it('creates an admin when no member has the address', async () => {
			const { members } = fixture();
			await members.create(ada);

			const ensured = await members.ensureAdmin(owner);

			expect(ensured).toEqual({
				member: { ...owner, role: 'admin', id: expect.any(String), createdAt: expect.any(Date) },
				outcome: 'created',
			});
			expect(await members.findByEmail(owner.email)).toEqual(ensured.member);
		});

		it('makes the member at the address an admin, keeping their name', async () => {
			const { members } = fixture();
			const member = await members.create({ ...ada, email: owner.email });

			const ensured = await members.ensureAdmin(owner);

			expect(ensured).toEqual({ member: { ...member, role: 'admin' }, outcome: 'promoted' });
			expect(await members.findById(member.id)).toEqual(ensured.member);
		});

		it('leaves an admin at the address unchanged', async () => {
			const { members } = fixture();
			const admin = await members.create({ ...grace, email: owner.email });

			expect(await members.ensureAdmin(owner)).toEqual({ member: admin, outcome: 'unchanged' });
		});

		it('agrees on one account when two calls run at once', async () => {
			const { members } = fixture();

			const ensured = await Promise.all([members.ensureAdmin(owner), members.ensureAdmin(owner)]);

			expect(ensured.map(({ outcome }) => outcome).toSorted()).toEqual(['created', 'unchanged']);
			expect(ensured[1]?.member).toEqual(ensured[0]?.member);
			expect(await members.list()).toEqual([ensured[0]?.member]);
		});

		it('creates a new account when the member at the address was removed, leaving that one removed', async () => {
			const { members } = fixture();
			const removed = await members.create({ ...grace, email: owner.email });
			await members.remove(removed.id);

			const ensured = await members.ensureAdmin(owner);

			expect(ensured).toMatchObject({ member: { ...owner, role: 'admin' }, outcome: 'created' });
			expect(ensured.member.id).not.toBe(removed.id);
			expect(await members.findById(removed.id)).toMatchObject({ removedAt: expect.any(Date) });
		});
	});

	describe('setRole', () => {
		it('changes the role either way', async () => {
			const { members } = fixture();
			const member = await members.create(ada);
			const admin = await members.create(grace);

			expect(await members.setRole(member.id, 'admin')).toEqual({ ...member, role: 'admin' });
			expect(await members.setRole(admin.id, 'member')).toEqual({ ...admin, role: 'member' });
			expect(await members.listAdmins()).toEqual([{ ...member, role: 'admin' }]);
		});

		it('returns null when no member has the id, or the member was removed', async () => {
			const { members } = fixture();
			const member = await members.create(ada);
			await members.remove(member.id);

			expect(await members.setRole(missingId, 'admin')).toBeNull();
			expect(await members.setRole(member.id, 'admin')).toBeNull();
		});

		it('refuses a role the member already has', async () => {
			const { members } = fixture();
			const member = await members.create(ada);
			const admin = await members.create(grace);

			await expect(members.setRole(member.id, 'member')).rejects.toThrow(MemberRoleConflictError);
			await expect(members.setRole(admin.id, 'admin')).rejects.toThrow(MemberRoleConflictError);
		});

		it('refuses the second of two identical changes made at once', async () => {
			const { members } = fixture();
			const member = await members.create(ada);

			const results = await Promise.allSettled([
				members.setRole(member.id, 'admin'),
				members.setRole(member.id, 'admin'),
			]);

			expect(results).toEqual([
				{ status: 'fulfilled', value: { ...member, role: 'admin' } },
				{ status: 'rejected', reason: expect.any(MemberRoleConflictError) },
			]);
		});
	});

	describe('remove', () => {
		it('marks the member removed, still findable by id and by the address it moves to', async () => {
			const { members } = fixture();
			const member = await members.create(ada);

			const removed = await members.remove(member.id);

			expect(removed).toEqual({
				...member,
				email: removedMemberEmail(member.id),
				removedAt: expect.any(Date),
			});
			expect(await members.findById(member.id)).toEqual(removed);
			expect(await members.findByEmail(removedMemberEmail(member.id))).toEqual(removed);
		});

		it('frees the address, so a new account can take it', async () => {
			const { members } = fixture();
			const member = await members.create(ada);

			await members.remove(member.id);

			expect(await members.findByEmail(ada.email)).toBeNull();
			const created = await members.create(ada);
			expect(created.id).not.toBe(member.id);
			expect(await members.findByEmail(ada.email)).toEqual(created);
		});

		it('revokes the open invites bound to the address, and no others', async () => {
			const { members, invites } = fixture();
			const admin = await members.create(grace);
			const member = await members.create(ada);
			await inviteTo(ada.email, admin.id);
			await inviteTo(ada.email, admin.id);
			const kept = await inviteTo(lin.email, admin.id);

			await members.remove(member.id);

			expect(await invites.findOpenByEmail(ada.email, new Date())).toBeNull();
			expect(await invites.listOpen(new Date())).toEqual([kept]);
		});

		it("deletes the member's favorites, and no others", async () => {
			const { members, favorites } = fixture();
			const member = await members.create(ada);
			const other = await members.create(grace);
			const soup = await createRecipe(sampleChickenSoup, other.id);
			const salad = await createRecipe(sampleTomatoSalad, other.id);
			await favorites.add(member.id, [soup.id, salad.id]);
			await favorites.add(other.id, [soup.id]);

			await members.remove(member.id);

			expect(await favorites.count(member.id)).toBe(0);
			expect(await favorites.list(other.id, { limit: 10, offset: 0 })).toEqual([soup]);
		});

		it("deletes the member's saved drafts, and no others", async () => {
			const { members, drafts } = fixture();
			const member = await members.create(ada);
			const other = await members.create(grace);
			const removed = await saveDraft(member.id);
			const kept = await saveDraft(other.id);

			await members.remove(member.id);

			expect(await drafts.findById(removed.id)).toBeNull();
			expect(await drafts.findById(kept.id)).toEqual(kept);
		});

		it('leaves the member out of the lists', async () => {
			const { members } = fixture();
			const member = await members.create(ada);
			const admin = await members.create(grace);
			const removedAdmin = await members.create(lin);

			await members.remove(member.id);
			await members.remove(removedAdmin.id);

			expect(await members.list()).toEqual([admin]);
			expect(await members.listAdmins()).toEqual([admin]);
		});

		it('returns null when no member has the id, or the member was removed already', async () => {
			const { members } = fixture();
			const member = await members.create(ada);
			await members.remove(member.id);

			expect(await members.remove(missingId)).toBeNull();
			expect(await members.remove(member.id)).toBeNull();
		});

		it('removes once when two removals run at once', async () => {
			const { members } = fixture();
			const member = await members.create(ada);

			const removed = await Promise.all([members.remove(member.id), members.remove(member.id)]);

			expect(removed).toEqual([
				{ ...member, email: removedMemberEmail(member.id), removedAt: expect.any(Date) },
				null,
			]);
		});
	});

	describe('rename', () => {
		it('changes the display name', async () => {
			const { members } = fixture();
			const member = await members.create(ada);

			const renamed = await members.rename(member.id, 'Ada L.');

			expect(renamed).toEqual({ ...member, displayName: 'Ada L.' });
			expect(await members.findById(member.id)).toEqual(renamed);
		});

		it('returns null when no member has the id, or the member was removed', async () => {
			const { members } = fixture();
			const member = await members.create(ada);
			await members.remove(member.id);

			expect(await members.rename(missingId, 'Ada L.')).toBeNull();
			expect(await members.rename(member.id, 'Ada L.')).toBeNull();
		});
	});
}
