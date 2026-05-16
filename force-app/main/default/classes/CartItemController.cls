/**
 * @description Apex fallback for adding items to cart in B2B Commerce.
 *              Used when the client-side Commerce Cart API (addItemToCart) fails,
 *              because browser fetch cannot satisfy Salesforce CSRF requirements
 *              on POST requests to Experience Cloud REST endpoints.
 *              Uses direct DML on WebCart/CartItem objects, which handles auth
 *              server-side and avoids the 401 Unauthorized seen in browser-based calls.
 *
 * @author American Book Company
 * @since 2026
 */
public without sharing class CartItemController {

    /**
     * @description Result wrapper returned to the LWC caller.
     */
    public class CartItemResult {
        @AuraEnabled public Boolean ok;
        @AuraEnabled public String message;
        @AuraEnabled public String cartItemId;
    }

    /**
     * @description Adds a product to the buyer's active cart via DML.
     *              Finds the user's active WebCart or creates one, then inserts
     *              a CartItem. The B2B Commerce platform handles price calculation.
     *
     * @param productId  The Product2 ID to add.
     * @param quantity   The number of units to add.
     * @param webStoreId The WebStore ID for this storefront.
     * @return           CartItemResult with ok=true and cartItemId on success,
     *                   or ok=false and message on failure.
     */
    @AuraEnabled
    public static CartItemResult addCartItem(
        String productId,
        Integer quantity,
        String webStoreId
    ) {
        CartItemResult result = new CartItemResult();

        if (String.isBlank(productId) || String.isBlank(webStoreId) || quantity == null || quantity <= 0) {
            result.ok = false;
            result.message = 'Missing or invalid required parameters.';
            return result;
        }

        try {
            User currentUser = [
                SELECT AccountId
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];

            if (currentUser.AccountId == null) {
                result.ok = false;
                result.message = 'Your account is not configured for shopping. Please contact support.';
                return result;
            }

            List<Product2> products = [
                SELECT Id, Name
                FROM Product2
                WHERE Id = :productId
                AND IsActive = true
                LIMIT 1
            ];

            if (products.isEmpty()) {
                result.ok = false;
                result.message = 'Product not found or is no longer available. (received: ' + productId + ')';
                return result;
            }

            // Find existing active cart or create a new one
            List<WebCart> activeCarts = [
                SELECT Id
                FROM WebCart
                WHERE WebStoreId = :webStoreId
                AND AccountId = :currentUser.AccountId
                AND Status = 'Active'
                LIMIT 1
            ];

            Id cartId;
            if (!activeCarts.isEmpty()) {
                cartId = activeCarts[0].Id;
            } else {
                WebCart newCart = new WebCart(
                    WebStoreId = webStoreId,
                    AccountId = currentUser.AccountId,
                    Status = 'Active',
                    Name = 'Cart'
                );
                insert newCart;
                cartId = newCart.Id;
            }

            // B2B Commerce requires every CartItem to belong to a CartDeliveryGroup.
            List<CartDeliveryGroup> groups = [
                SELECT Id
                FROM CartDeliveryGroup
                WHERE CartId = :cartId
                LIMIT 1
            ];

            Id deliveryGroupId;
            if (!groups.isEmpty()) {
                deliveryGroupId = groups[0].Id;
            } else {
                CartDeliveryGroup newGroup = new CartDeliveryGroup(
                    CartId = cartId,
                    Name = 'Default Delivery'
                );
                insert newGroup;
                deliveryGroupId = newGroup.Id;
            }

            CartItem item = new CartItem(
                CartId = cartId,
                CartDeliveryGroupId = deliveryGroupId,
                Product2Id = productId,
                Quantity = quantity,
                Type = 'Product',
                Name = products[0].Name
            );
            insert item;

            result.ok = true;
            result.cartItemId = item.Id;
        } catch (Exception e) {
            result.ok = false;
            result.message = e.getMessage();
        }

        return result;
    }
}