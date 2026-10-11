import 'server-only';
import type { Actor, ActorProvider } from '@/application/ports/actor-provider';

// Placeholder until member sign-in exists: every caller is anonymous, so every write is refused.
export class AnonymousActorProvider implements ActorProvider {
	async currentActor(): Promise<Actor> {
		return { kind: 'anonymous' };
	}
}
