import type { Actor, ActorProvider } from '@/application/ports/actor-provider';

// Records whether it was asked, so tests can prove that public reads never ask.
export class FixedActorProvider implements ActorProvider {
	private readonly actor: Actor;
	private asked = false;

	constructor(actor: Actor) {
		this.actor = actor;
	}

	get wasAsked(): boolean {
		return this.asked;
	}

	async currentActor(): Promise<Actor> {
		this.asked = true;
		return this.actor;
	}
}
