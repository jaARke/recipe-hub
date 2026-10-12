import 'server-only';
import { ForbiddenError } from '@/application/authorization';
import type { MemberActor } from '@/application/ports/actor-provider';
import type { Recipe } from '@/domain/recipe/recipe';

// Editing and deleting a recipe are open to its contributor and to admins.
export function canModifyRecipe(actor: MemberActor, recipe: Recipe): boolean {
	return actor.role === 'admin' || actor.memberId === recipe.contributorId;
}

export function assertCanModifyRecipe(actor: MemberActor, recipe: Recipe): void {
	if (!canModifyRecipe(actor, recipe)) {
		throw new ForbiddenError();
	}
}
