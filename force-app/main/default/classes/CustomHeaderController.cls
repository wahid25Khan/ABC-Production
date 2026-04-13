/**
 * CustomHeaderController
 *
 * Apex controller for the customHeader LWC.
 * Exposes a single method: getCartItemCount — returns the total
 * quantity of items in the current user's active WebCart.
 *
 * Returns 0 for guest users (cart count is session-based and not
 * directly accessible via SOQL for unauthenticated site visitors).
 */
public with sharing class CustomHeaderController {

    /**
     * Returns the sum of quantities across all CartItems in the
     * user's most-recently-modified active WebCart.
     *
     * Decorated cacheable=false so the LWC calls it imperatively
     * on every page load, ensuring a fresh count.
     */
    @AuraEnabled(cacheable=false)
    public static Integer getCartItemCount() {
        // Guest users' carts are managed via browser session context;
        // SOQL-based count is not reliable for them.
        if (UserInfo.getUserType() == 'Guest') {
            return 0;
        }

        try {
            // Step 1 – find the active cart owned by the current user
            List<WebCart> carts = [
                SELECT Id
                FROM WebCart
                WHERE Status   = 'Active'
                  AND OwnerId  = :UserInfo.getUserId()
                ORDER BY LastModifiedDate DESC
                LIMIT 1
            ];

            if (carts.isEmpty()) {
                return 0;
            }

            // Step 2 – sum quantities of all cart line items
            List<AggregateResult> results = [
                SELECT SUM(Quantity) totalQty
                FROM CartItem
                WHERE CartId = :carts[0].Id
            ];

            if (results.isEmpty() || results[0].get('totalQty') == null) {
                return 0;
            }

            return ((Decimal) results[0].get('totalQty')).intValue();

        } catch (Exception ex) {
            // Non-critical; return 0 rather than surfacing an error
            return 0;
        }
    }
}