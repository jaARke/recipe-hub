'use server';

import { refresh } from 'next/cache';
import { toFormError } from '@/app/_lib/form-errors';
import type { MergedFavoritesDto } from '@/application/favorites/favorite-dtos';
import type { FormState } from '@/components/forms/form-state';
import { getFavoriteService } from '@/composition/services';

// Nothing cached changes, since a reader's favorites render behind their own boundaries, so refresh
// re-renders those with what was saved.
export async function setFavorite(recipeId: string, favorite: boolean): Promise<FormState> {
	try {
		await getFavoriteService().setFavorite(recipeId, favorite);
	} catch (error) {
		return toFormError(error);
	}

	refresh();
	return { status: 'success' };
}

// A merge that found favorites clears the device's cookie, which re-renders the page by itself, and
// one that found none changes nothing to re-render.
export async function mergeDeviceFavorites(): Promise<FormState<MergedFavoritesDto>> {
	let merged: MergedFavoritesDto;
	try {
		merged = await getFavoriteService().mergeDeviceFavorites();
	} catch (error) {
		return toFormError(error);
	}

	return { status: 'success', ...merged };
}
