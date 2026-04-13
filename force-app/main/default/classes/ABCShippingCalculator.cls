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
        clearShippingValidations(cvos);

        Shipping_Config__mdt cfg = getConfig();
        CartExtension.CartDeliveryGroupList groups = cart.getCartDeliveryGroups();
        Id shippingProductId = resolveShippingProductId();
        String validationMessage = validateConfiguration(cfg, groups.size(), shippingProductId);
        if (validationMessage != null) {
            addError(cvos, validationMessage);
            return;
        }

        applyShippingMethods(
            groups,
            cfg,
            shippingProductId,
            calculateShippingFee(sumShippableTotal(cart.getCartItems()), cfg)
        );
    }

    @AuraEnabled(cacheable=true)
    public static Decimal getShippingRatePercent() {
        Shipping_Config__mdt cfg = getConfig();
        return cfg?.Shipping_Rate_Percent__c == null ? 0 : cfg.Shipping_Rate_Percent__c;
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

    @TestVisible
    private static Id resolveShippingProductIdForTest() {
        return resolveShippingProductId();
    }

    @TestVisible
    private static Decimal calculateShippingFeeForTest(Decimal shippableTotal) {
        return calculateShippingFee(shippableTotal, getConfig());
    }

    @TestVisible
    private static String validateConfigurationForTest(Integer deliveryGroupCount, Id shippingProductId) {
        return validateConfiguration(getConfig(), deliveryGroupCount, shippingProductId);
    }

    @TestVisible
    private static Decimal sumShippableLineTotalsForTest(Map<Id, Decimal> lineTotalsByProductId) {
        return sumShippableLineTotals(lineTotalsByProductId);
    }

    @TestVisible
    private static Decimal getShippingRatePercentForTest() {
        return getShippingRatePercent();
    }

    private static String validateConfiguration(
        Shipping_Config__mdt cfg,
        Integer deliveryGroupCount,
        Id shippingProductId
    ) {
        if (cfg == null) {
            return 'Shipping configuration not found. Please contact support.';
        }
        if (deliveryGroupCount == null || deliveryGroupCount == 0) {
            return 'No delivery address found. Please add a shipping address.';
        }
        if (shippingProductId == null) {
            return 'Shipping Charge Product not found. Please contact support.';
        }
        return null;
    }

    private static Decimal calculateShippingFee(Decimal shippableTotal, Shipping_Config__mdt cfg) {
        Decimal safeTotal = shippableTotal == null ? 0 : shippableTotal;
        Decimal ratePercent = cfg?.Shipping_Rate_Percent__c == null ? 0 : cfg.Shipping_Rate_Percent__c;
        return (safeTotal * (ratePercent / 100)).setScale(2, RoundingMode.HALF_UP);
    }

    private static Decimal sumShippableTotal(CartExtension.CartItemList items) {
        Map<Id, Decimal> lineTotalsByProductId = new Map<Id, Decimal>();
        Iterator<CartExtension.CartItem> iter = items.iterator();
        while (iter.hasNext()) {
            CartExtension.CartItem item = iter.next();
            if (item.getType() != CartExtension.SalesItemTypeEnum.PRODUCT || item.getProduct2Id() == null) {
                continue;
            }

            Decimal itemTotal = item.getTotalPrice();
            if (itemTotal == null || itemTotal <= 0) {
                continue;
            }

            Decimal runningTotal = lineTotalsByProductId.containsKey(item.getProduct2Id())
                ? lineTotalsByProductId.get(item.getProduct2Id())
                : 0;
            lineTotalsByProductId.put(item.getProduct2Id(), runningTotal + itemTotal);
        }

        return sumShippableLineTotals(lineTotalsByProductId);
    }

    private static Decimal sumShippableLineTotals(Map<Id, Decimal> lineTotalsByProductId) {
        if (lineTotalsByProductId == null || lineTotalsByProductId.isEmpty()) {
            return 0;
        }

        Decimal shippableTotal = 0;
        Map<Id, Product2> products = new Map<Id, Product2>([
            SELECT Id, Is_Digital_Product__c
            FROM Product2
            WHERE Id IN :lineTotalsByProductId.keySet()
        ]);

        for (Id productId : lineTotalsByProductId.keySet()) {
            Product2 product = products.get(productId);
            if (product != null && product.Is_Digital_Product__c == true) {
                continue;
            }

            shippableTotal += lineTotalsByProductId.get(productId);
        }

        return shippableTotal;
    }

    private static Id resolveShippingProductId() {
        List<Product2> results = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Shipping Charge Product'
              AND IsActive = true
            LIMIT 1
        ];
        return results.isEmpty() ? null : results[0].Id;
    }

    private static void applyShippingMethods(
        CartExtension.CartDeliveryGroupList groups,
        Shipping_Config__mdt cfg,
        Id shippingProductId,
        Decimal shippingFee
    ) {
        for (Integer i = 0; i < groups.size(); i++) {
            CartExtension.CartDeliveryGroup cdg = groups.get(i);
            CartExtension.CartDeliveryGroupMethodList methods = cdg.getCartDeliveryGroupMethods();
            for (Integer j = methods.size() - 1; j >= 0; j--) {
                methods.remove(methods.get(j));
            }
            cdg.setSelectedCartDeliveryGroupMethod(null);

            CartExtension.CartDeliveryGroupMethod method =
                new CartExtension.CartDeliveryGroupMethod(
                    cfg.Shipping_Method_Name__c,
                    shippingFee,
                    shippingProductId
                );
            if (String.isNotBlank(cfg.Carrier__c)) {
                method.setCarrier(cfg.Carrier__c);
                method.setClassOfService('Standard');
            }
            methods.add(method);
        }
    }

    private static void clearShippingValidations(CartExtension.CartValidationOutputList cvos) {
        for (Integer i = cvos.size() - 1; i >= 0; i--) {
            CartExtension.CartValidationOutput cvo = cvos.get(i);
            if (cvo.getType() == CartExtension.CartValidationOutputTypeEnum.SHIPPING) {
                cvos.remove(cvo);
            }
        }
    }

    private static void addError(CartExtension.CartValidationOutputList cvos, String message) {
        CartExtension.CartValidationOutput cvo = new CartExtension.CartValidationOutput(
            CartExtension.CartValidationOutputTypeEnum.SHIPPING,
            CartExtension.CartValidationOutputLevelEnum.ERROR
        );
        cvo.setMessage(message);
        cvos.add(cvo);
    }
}