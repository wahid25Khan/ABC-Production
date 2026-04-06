/**
 * Custom B2B Commerce shipping calculator that charges a configurable
 * percentage of the shippable cart total.
 *
 * Configuration lives in Custom Metadata: Shipping_Config__mdt
 *   - Shipping_Rate_Percent__c  (e.g. 12 = 12%)
 *   - Shipping_Method_Name__c   (display label at checkout)
 *   - Carrier__c                (carrier name)
 *   - Is_Active__c              (must be true)
 *
 * Digital / non-shippable products are excluded automatically when
 * Product2.Is_Digital_Product__c = true.
 */
public class ABCShippingCalculator extends CartExtension.ShippingCartCalculator {

    // Cache the config so we only query once per transaction
    private static Shipping_Config__mdt config;

    public virtual override void calculate(
        CartExtension.CartCalculateCalculatorRequest request
    ) {
        CartExtension.Cart cart = request.getCart();
        CartExtension.CartValidationOutputList cvos = cart.getCartValidationOutputs();

        // ── 1. Clear previous shipping validation messages ──
        clearShippingValidations(cvos);

        // ── 2. Load config from Custom Metadata ──
        Shipping_Config__mdt cfg = getConfig();
        if (cfg == null) {
            addError(cvos, 'Shipping configuration not found. Please contact support.');
            return;
        }

        // ── 3. Validate delivery groups exist ──
        CartExtension.CartDeliveryGroupList groups = cart.getCartDeliveryGroups();
        if (groups.size() == 0) {
            addError(cvos, 'No delivery address found. Please add a shipping address.');
            return;
        }

        // ── 4. Resolve the Shipping Charge Product (framework requirement) ──
        Id shippingProductId = resolveShippingProduct();
        if (shippingProductId == null) {
            addError(cvos, 'Shipping Charge Product not found. Please contact support.');
            return;
        }

        // ── 5. Sum cart total for shippable items only ──
        Decimal shippableTotal = sumShippableTotal(cart.getCartItems());

        // ── 6. Calculate fee ──
        Decimal rate = cfg.Shipping_Rate_Percent__c / 100;
        Decimal shippingFee = (shippableTotal * rate).setScale(2, RoundingMode.HALF_UP);

        // ── 7. Create the delivery method on each delivery group ──
        String methodName = cfg.Shipping_Method_Name__c;
        String carrier = cfg.Carrier__c;

        for (Integer i = 0; i < groups.size(); i++) {
            CartExtension.CartDeliveryGroup cdg = groups.get(i);
            CartExtension.CartDeliveryGroupMethodList methods = cdg.getCartDeliveryGroupMethods();

            // Remove any previous methods
            for (Integer j = methods.size() - 1; j >= 0; j--) {
                methods.remove(methods.get(j));
            }
            cdg.setSelectedCartDeliveryGroupMethod(null);

            // Add the single shipping option
            CartExtension.CartDeliveryGroupMethod method =
                new CartExtension.CartDeliveryGroupMethod(methodName, shippingFee, shippingProductId);
            if (String.isNotBlank(carrier)) {
                method.setCarrier(carrier);
                method.setClassOfService('Standard');
            }
            methods.add(method);
        }
    }

    // ── Private helpers ──────────────────────────────────────────────

    private Decimal sumShippableTotal(CartExtension.CartItemList items) {
        // Collect Product2 IDs
        Set<Id> productIds = new Set<Id>();
        Iterator<CartExtension.CartItem> iter = items.iterator();
        while (iter.hasNext()) {
            CartExtension.CartItem item = iter.next();
            if (item.getProduct2Id() != null) {
                productIds.add(item.getProduct2Id());
            }
        }

        // Query which products are shipping-exempt
        Map<Id, Product2> products = new Map<Id, Product2>([
            SELECT Id, Is_Digital_Product__c
            FROM Product2
            WHERE Id IN :productIds
        ]);

        // Sum only shippable items
        Decimal total = 0;
        iter = items.iterator();
        while (iter.hasNext()) {
            CartExtension.CartItem item = iter.next();
            if (item.getType() != CartExtension.SalesItemTypeEnum.PRODUCT) {
                continue;
            }
            Product2 prod = products.get(item.getProduct2Id());
            Boolean exempt = (prod != null && prod.Is_Digital_Product__c);
            if (!exempt) {
                Decimal itemTotal = item.getTotalPrice();
                if (itemTotal != null) {
                    total += itemTotal;
                }
            }
        }
        return total;
    }

    private Id resolveShippingProduct() {
        List<Product2> results = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Shipping Charge Product'
              AND IsActive = true
            LIMIT 1
        ];
        return results.isEmpty() ? null : results[0].Id;
    }

    @TestVisible
    private static Shipping_Config__mdt getConfig() {
        if (config != null) {
            return config;
        }
        List<Shipping_Config__mdt> configs = [
            SELECT Shipping_Rate_Percent__c,
                   Shipping_Method_Name__c,
                   Carrier__c,
                   Is_Active__c
            FROM Shipping_Config__mdt
            WHERE Is_Active__c = true
            LIMIT 1
        ];
        config = configs.isEmpty() ? null : configs[0];
        return config;
    }

    @TestVisible
    private static void setConfigForTest(Shipping_Config__mdt testConfig) {
        config = testConfig;
    }

    private void clearShippingValidations(CartExtension.CartValidationOutputList cvos) {
        for (Integer i = cvos.size() - 1; i >= 0; i--) {
            CartExtension.CartValidationOutput cvo = cvos.get(i);
            if (cvo.getType() == CartExtension.CartValidationOutputTypeEnum.SHIPPING) {
                cvos.remove(cvo);
            }
        }
    }

    private void addError(CartExtension.CartValidationOutputList cvos, String message) {
        CartExtension.CartValidationOutput cvo = new CartExtension.CartValidationOutput(
            CartExtension.CartValidationOutputTypeEnum.SHIPPING,
            CartExtension.CartValidationOutputLevelEnum.ERROR
        );
        cvo.setMessage(message);
        cvos.add(cvo);
    }
}
