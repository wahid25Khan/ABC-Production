/**
 * Shared wishlist/favorite utilities for ABC B2B Commerce LWCs.
 * Used by quickShopModal, productDetailComponent, and any component
 * that needs single-product favorite sync + toggle.
 *
 * Components must have these properties: isFavorite, favoritePending, favoriteProductId.
 */
import getFavoriteStateApex from "@salesforce/apex/WishlistController.getFavoriteState";
import toggleFavoriteApex from "@salesforce/apex/WishlistController.toggleFavorite";

/**
 * Fetch the current favorite state for a product and update the host component.
 *
 * @param {object} host — LWC instance with isFavorite, favoriteProductId, selectedProductId.
 * @param {string} productId — The product ID to check.
 * @param {string} webStoreId — The webstore ID.
 */
export async function syncFavoriteState(host, productId, webStoreId) {
    if (!productId) {
        host.isFavorite = false;
        host.favoriteProductId = "";
        return;
    }

    try {
        const result = await getFavoriteStateApex({ productId, webStoreId });

        if (host.selectedProductId !== productId) {
            return;
        }

        host.isFavorite = Boolean(result?.favorite);
        host.favoriteProductId = productId;
    } catch {
        host.isFavorite = false;
        host.favoriteProductId = productId;
    }
}

/**
 * Toggle the favorite state for a product with optimistic-revert-on-failure.
 * Dispatches a "favoritechange" CustomEvent on success.
 *
 * @param {object} host — LWC instance with isFavorite, favoritePending, favoriteProductId, dispatchEvent.
 * @param {string} productId — The product ID to toggle.
 * @param {string} webStoreId — The webstore ID.
 */
export async function doToggleFavorite(host, productId, webStoreId) {
    if (!productId || host.favoritePending) {
        return;
    }

    host.favoritePending = true;
    const previous = host.isFavorite;

    try {
        const result = await toggleFavoriteApex({ productId, webStoreId });

        if (result?.success === false) {
            host.isFavorite = previous;
            return;
        }

        host.isFavorite = Boolean(result?.favorite);
        host.favoriteProductId = productId;
        host.dispatchEvent(
            new CustomEvent("favoritechange", {
                detail: {
                    favorite: host.isFavorite,
                    productId,
                    wishlistId: result?.wishlistId || null,
                    wishlistItemId: result?.wishlistItemId || null
                }
            })
        );
    } catch {
        host.isFavorite = previous;
    } finally {
        host.favoritePending = false;
    }
}
