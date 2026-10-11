import 'server-only';
import { ForbiddenError } from '@/application/authorization';
import type { MemberActor } from '@/application/ports/actor-provider';
import type { Recipe } from '@/domain/recipe/recipe';

// Editing and deleting a recipe are open to its contributor and to admins.
export function assertCanModifyRecipe(actor: MemberActor, recipe: Recipe): void {
	if (actor.role !== 'admin' && actor.memberId !== recipe.contributorId) {
		throw new ForbiddenError();
	}
}
