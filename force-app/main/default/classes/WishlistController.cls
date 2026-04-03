@SuppressWarnings('PMD.ApexCRUDViolation')
/**
 * Provides buyer wishlist state for storefront product components.
 */
public with sharing class WishlistController {
    private static final String DEFAULT_WISHLIST_NAME = 'My Wishlist';

    @TestVisible
    private static Id buyerAccountIdOverride;

    /** Result returned to LWC callers for wishlist state changes. */
    public class FavoriteStateResult {
        @AuraEnabled
        public Boolean success;
        @AuraEnabled
        public Boolean favorite;
        @AuraEnabled
        public Id wishlistId;
        @AuraEnabled
        public Id wishlistItemId;
        @AuraEnabled
        public String message;
    }

    /**
     * Returns whether the current buyer has already favorited a product.
     *
     * @param productId The storefront product identifier.
     * @param webStoreId The active web store identifier.
     * @return Wrapper describing the product's wishlist state.
     */
    @AuraEnabled(cacheable=true)
    public static FavoriteStateResult getFavoriteState(String productId, String webStoreId) {
        FavoriteStateResult result = createResult(false);

        if (String.isBlank(productId) || String.isBlank(webStoreId)) {
            result.success = false;
            result.message = 'A product and web store are required.';
            return result;
        }

        Id buyerAccountId = resolveBuyerAccountId();
        if (buyerAccountId == null) {
            result.success = false;
            result.message = 'No buyer account is associated with the current user.';
            return result;
        }

        Wishlist wishlist = findWishlist(buyerAccountId, webStoreId);
        if (wishlist == null) {
            return result;
        }

        WishlistItem item = findWishlistItem(wishlist.Id, productId);
        result.favorite = item != null;
        result.wishlistId = wishlist.Id;
        result.wishlistItemId = item != null ? item.Id : null;
        return result;
    }

    /**
     * Adds or removes the supplied product from the buyer's wishlist.
     *
     * @param productId The storefront product identifier.
     * @param webStoreId The active web store identifier.
     * @return Wrapper describing the updated wishlist state.
     */
    @AuraEnabled
    public static FavoriteStateResult toggleFavorite(String productId, String webStoreId) {
        FavoriteStateResult result = createResult(false);

        if (String.isBlank(productId) || String.isBlank(webStoreId)) {
            result.success = false;
            result.message = 'A product and web store are required.';
            return result;
        }

        Id buyerAccountId = resolveBuyerAccountId();
        if (buyerAccountId == null) {
            result.success = false;
            result.message = 'No buyer account is associated with the current user.';
            return result;
        }

        Wishlist wishlist = ensureWishlist(buyerAccountId, webStoreId);
        WishlistItem existingItem = findWishlistItem(wishlist.Id, productId);

        if (existingItem != null) {
            delete existingItem;
            result.favorite = false;
            result.wishlistId = wishlist.Id;
            result.wishlistItemId = null;
            return result;
        }

        WishlistItem createdItem = new WishlistItem(
            Name = DEFAULT_WISHLIST_NAME,
            Product2Id = productId,
            WishlistId = wishlist.Id
        );
        insert createdItem;

        result.favorite = true;
        result.wishlistId = wishlist.Id;
        result.wishlistItemId = createdItem.Id;
        return result;
    }

    private static FavoriteStateResult createResult(Boolean favorite) {
        FavoriteStateResult result = new FavoriteStateResult();
        result.success = true;
        result.favorite = favorite;
        return result;
    }

    private static Id resolveBuyerAccountId() {
        if (Test.isRunningTest() && buyerAccountIdOverride != null) {
            return buyerAccountIdOverride;
        }

        List<User> users = [
            SELECT Contact.AccountId
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

        if (users.isEmpty()) {
            return null;
        }

        return users[0].Contact != null ? users[0].Contact.AccountId : null;
    }

    private static Wishlist findWishlist(Id buyerAccountId, String webStoreId) {
        List<Wishlist> wishlists = [
            SELECT Id, Name
            FROM Wishlist
            WHERE AccountId = :buyerAccountId
              AND WebStoreId = :webStoreId
            ORDER BY CreatedDate ASC
            LIMIT 1
        ];

        return wishlists.isEmpty() ? null : wishlists[0];
    }

    private static Wishlist ensureWishlist(Id buyerAccountId, String webStoreId) {
        Wishlist existing = findWishlist(buyerAccountId, webStoreId);
        if (existing != null) {
            return existing;
        }

        Wishlist created = new Wishlist(
            AccountId = buyerAccountId,
            Name = DEFAULT_WISHLIST_NAME,
            WebStoreId = webStoreId
        );
        insert created;
        return created;
    }

    private static WishlistItem findWishlistItem(Id wishlistId, String productId) {
        List<WishlistItem> items = [
            SELECT Id
            FROM WishlistItem
            WHERE WishlistId = :wishlistId
              AND Product2Id = :productId
            ORDER BY CreatedDate ASC
            LIMIT 1
        ];

        return items.isEmpty() ? null : items[0];
    }

    @TestVisible
    private static void resetTestState() {
        buyerAccountIdOverride = null;
    }
}