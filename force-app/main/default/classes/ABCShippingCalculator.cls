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

    @TestVisible
    private class CartLine {
        Id productId;
        CartExtension.SalesItemTypeEnum itemType;
        Decimal totalPrice;

        CartLine(Id productId, CartExtension.SalesItemTypeEnum itemType, Decimal totalPrice) {
            this.productId = productId;
            this.itemType = itemType;
            this.totalPrice = totalPrice;
        }
    }

    @TestVisible
    private interface ValidationState {
        void clearShippingValidations();
        void addShippingError(String message);
    }

    @TestVisible
    private interface CalculationContext {
        ValidationState getValidationState();
        Integer getDeliveryGroupCount();
        List<CartLine> getCartLines();
        void replaceDeliveryMethods(CartExtension.CartDeliveryGroupMethod method);
    }

    private class RuntimeValidationState implements ValidationState {
        private CartExtension.CartValidationOutputList cvos;

        RuntimeValidationState(CartExtension.CartValidationOutputList cvos) { this.cvos = cvos; }

        public void clearShippingValidations() {
            for (Integer i = cvos.size() - 1; i >= 0; i--) {
                CartExtension.CartValidationOutput cvo = cvos.get(i);
                if (isShippingValidation(cvo)) {
                    cvos.remove(cvo);
                }
            }
        }

        public void addShippingError(String message) {
            cvos.add(buildShippingValidation(message));
        }
    }

    private class RuntimeCalculationContext implements CalculationContext {
        private CartExtension.Cart cart;

        RuntimeCalculationContext(CartExtension.Cart cart) { this.cart = cart; }

        public ValidationState getValidationState() { return new RuntimeValidationState(cart.getCartValidationOutputs()); }

        public Integer getDeliveryGroupCount() { return cart.getCartDeliveryGroups().size(); }

        public List<CartLine> getCartLines() {
            List<CartLine> lines = new List<CartLine>();
            Iterator<CartExtension.CartItem> iter = cart.getCartItems().iterator();
            while (iter.hasNext()) {
                CartExtension.CartItem item = iter.next();
                lines.add(new CartLine(item.getProduct2Id(), item.getType(), item.getTotalPrice()));
            }
            return lines;
        }

        public void replaceDeliveryMethods(CartExtension.CartDeliveryGroupMethod method) {
            CartExtension.CartDeliveryGroupList groups = cart.getCartDeliveryGroups();
            for (Integer i = 0; i < groups.size(); i++) {
                CartExtension.CartDeliveryGroup cdg = groups.get(i);
                CartExtension.CartDeliveryGroupMethodList methods = cdg.getCartDeliveryGroupMethods();
                for (Integer j = methods.size() - 1; j >= 0; j--) {
                    methods.remove(methods.get(j));
                }
                cdg.setSelectedCartDeliveryGroupMethod(null);
                methods.add(method);
                cdg.setSelectedCartDeliveryGroupMethod(method);
            }
        }
    }

    public virtual override void calculate(CartExtension.CartCalculateCalculatorRequest request) {
        runCalculation(new RuntimeCalculationContext(request.getCart()), getConfig(), resolveShippingProductId()); }

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

    @TestVisible
    private static void runCalculation(
        CalculationContext context,
        Shipping_Config__mdt cfg,
        Id shippingProductId
    ) {
        ValidationState validationState = context.getValidationState();
        validationState.clearShippingValidations();

        String validationMessage = validateConfiguration(cfg, context.getDeliveryGroupCount(), shippingProductId);
        if (validationMessage != null) {
            validationState.addShippingError(validationMessage);
            return;
        }

        Decimal shippingFee = calculateShippingFee(sumShippableTotal(context.getCartLines()), cfg);
        context.replaceDeliveryMethods(buildDeliveryMethod(cfg, shippingFee, shippingProductId));
    }

    @TestVisible
    private static CartLine newCartLine(
        Id productId,
        CartExtension.SalesItemTypeEnum itemType,
        Decimal totalPrice
    ) {
        return new CartLine(productId, itemType, totalPrice);
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

    private static Decimal sumShippableTotal(List<CartLine> items) {
        Map<Id, Decimal> lineTotalsByProductId = new Map<Id, Decimal>();
        for (CartLine item : items) {
            addProductLineTotal(
                lineTotalsByProductId,
                item.productId,
                item.itemType,
                item.totalPrice
            );
        }

        return sumShippableLineTotals(lineTotalsByProductId);
    }

    @TestVisible
    private static void addProductLineTotal(
        Map<Id, Decimal> lineTotalsByProductId,
        Id productId,
        CartExtension.SalesItemTypeEnum itemType,
        Decimal itemTotal
    ) {
        if (lineTotalsByProductId == null || itemType != CartExtension.SalesItemTypeEnum.PRODUCT || productId == null) {
            return;
        }

        if (itemTotal == null || itemTotal <= 0) {
            return;
        }

        Decimal runningTotal = lineTotalsByProductId.containsKey(productId)
            ? lineTotalsByProductId.get(productId)
            : 0;
        lineTotalsByProductId.put(productId, runningTotal + itemTotal);
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

    @TestVisible
    private static CartExtension.CartDeliveryGroupMethod buildDeliveryMethod(
        Shipping_Config__mdt cfg,
        Decimal shippingFee,
        Id shippingProductId
    ) {
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
        return method;
    }

    @TestVisible
    private static Boolean isShippingValidation(CartExtension.CartValidationOutput cvo) {
        return cvo != null && cvo.getType() == CartExtension.CartValidationOutputTypeEnum.SHIPPING;
    }

    @TestVisible
    private static CartExtension.CartValidationOutput buildShippingValidation(String message) {
        CartExtension.CartValidationOutput cvo = new CartExtension.CartValidationOutput(
            CartExtension.CartValidationOutputTypeEnum.SHIPPING,
            CartExtension.CartValidationOutputLevelEnum.ERROR
        );
        cvo.setMessage(message);
        return cvo;
    }
}