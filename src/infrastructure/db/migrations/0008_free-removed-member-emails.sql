-- Revokes the open invites bound to removed accounts' addresses before the addresses are freed, with
-- the condition and stamp revokeOpenByEmail (src/infrastructure/db/drizzle-invite-repository.ts) uses.
UPDATE "invites" SET "revoked_at" = now()
WHERE "email" IN (SELECT "email" FROM "users" WHERE "removed_at" IS NOT NULL)
	AND NOT EXISTS (SELECT "id" FROM "users" WHERE "users"."invite_id" = "invites"."id")
	AND "revoked_at" IS NULL
	AND "expires_at" > now();--> statement-breakpoint
-- Gives every removed account the address removedMemberEmail (src/domain/member/member.ts) names,
-- freeing the member's own address for a new invite.
UPDATE "users" SET "email" = 'removed+' || "id"::text || '@recipes.invalid' WHERE "removed_at" IS NOT NULL;
