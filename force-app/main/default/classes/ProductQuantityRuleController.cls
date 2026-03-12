/**
 * @description Controller for retrieving product purchase quantity rules in the
 *              B2B Commerce store. Exposes OOB ProductQuantityRule data to LWC
 *              components so they can enforce minimum, maximum, and increment
 *              constraints on product orders.
 *
 * @author American Book Company
 * @since 2025
 */
public with sharing class ProductQuantityRuleController {

    /** @description Wrapper returned to the client with resolved quantity constraints. */
    public class QuantityRuleResult {
        /** @description The minimum number of units per order. */
        @AuraEnabled public Integer minimumQuantity;
        /** @description The maximum number of units per order. Null means unlimited. */
        @AuraEnabled public Integer maximumQuantity;
        /** @description Step size between valid quantities (e.g. 10 = only 10, 20, 30 …). */
        @AuraEnabled public Integer incrementQuantity;
    }

    /**
     * @description Returns a QuantityRuleResult populated with project-wide fallback values
     *              used when no ProductQuantityRule record is linked to the product.
     * @return QuantityRuleResult with minimumQuantity=10, maximumQuantity=50, incrementQuantity=10.
     */
    private static QuantityRuleResult defaultRule() {
        QuantityRuleResult result = new QuantityRuleResult();
        result.minimumQuantity  = 10;
        result.maximumQuantity  = 50;
        result.incrementQuantity = 10;
        return result;
    }

    /**
     * @description Retrieves the purchase quantity rule for the given product.
     *              Returns sensible defaults when no rule is found or productId is blank.
     * @param productId The Salesforce record ID of the Product2 to look up.
     * @return QuantityRuleResult containing the resolved minimumQuantity, maximumQuantity,
     *         and incrementQuantity for the product.
     */
    @AuraEnabled(cacheable=true)
    public static QuantityRuleResult getQuantityRule(String productId) {
        if (String.isBlank(productId)) {
            return defaultRule();
        }

        List<ProductQuantityRule> links = [
            SELECT PurchaseQuantityRule.Minimum,
                   PurchaseQuantityRule.Maximum,
                   PurchaseQuantityRule.Increment
            FROM   ProductQuantityRule
            WHERE  ProductId = :productId
            WITH   USER_MODE
            LIMIT  1
        ];

        if (links.isEmpty()) {
            return defaultRule();
        }

        PurchaseQuantityRule pqr = links[0].PurchaseQuantityRule;
        QuantityRuleResult result = new QuantityRuleResult();

        if (pqr.Minimum != null) {
            result.minimumQuantity = pqr.Minimum.intValue();
        } else {
            result.minimumQuantity = 10;
        }

        // Salesforce stores "no maximum" as a very large number (e.g. 100 000 000).
        // Cap at 9 999 to treat anything above as unlimited and fall back to the project default.
        if (pqr.Maximum != null && pqr.Maximum <= 9999) {
            result.maximumQuantity = pqr.Maximum.intValue();
        } else {
            result.maximumQuantity = 50;
        }

        if (pqr.Increment != null) {
            result.incrementQuantity = pqr.Increment.intValue();
        } else {
            result.incrementQuantity = 10;
        }

        return result;
    }
}
