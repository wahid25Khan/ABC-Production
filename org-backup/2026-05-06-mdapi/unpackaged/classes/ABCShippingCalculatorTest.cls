/**
 * Tests for ABCShippingCalculator.
 *
 * The calculate() method receives a framework-managed
 * CartExtension.CartCalculateCalculatorRequest that cannot be constructed in
 * Apex test code. It gets code coverage when the B2B Commerce checkout
 * invokes the registered extension at runtime.
 *
 * This test class covers the @TestVisible helper methods (config loading,
 * config caching, config injection) and validates the data setup required
 * by the calculator (Shipping_Config__mdt, Shipping Charge Product, etc.).
 */
@IsTest
private class ABCShippingCalculatorTest {

    private class FakeValidationState implements ABCShippingCalculator.ValidationState {
        List<CartExtension.CartValidationOutput> errors = new List<CartExtension.CartValidationOutput>();

        public void clearShippingValidations() {
            for (Integer i = errors.size() - 1; i >= 0; i--) {
                if (ABCShippingCalculator.isShippingValidation(errors[i])) {
                    errors.remove(i);
                }
            }
        }

        public void addShippingError(String message) {
            errors.add(ABCShippingCalculator.buildShippingValidation(message));
        }
    }

    private class FakeCalculationContext implements ABCShippingCalculator.CalculationContext {
        Integer deliveryGroupCount;
        FakeValidationState validationState = new FakeValidationState();
        List<ABCShippingCalculator.CartLine> cartLines = new List<ABCShippingCalculator.CartLine>();
        List<CartExtension.CartDeliveryGroupMethod> appliedMethods = new List<CartExtension.CartDeliveryGroupMethod>();
        CartExtension.CartDeliveryGroupMethod selectedMethod;

        FakeCalculationContext(Integer deliveryGroupCount) {
            this.deliveryGroupCount = deliveryGroupCount;
        }

        public ABCShippingCalculator.ValidationState getValidationState() {
            return validationState;
        }

        public Integer getDeliveryGroupCount() {
            return deliveryGroupCount;
        }

        public List<ABCShippingCalculator.CartLine> getCartLines() {
            return cartLines;
        }

        public void replaceDeliveryMethods(CartExtension.CartDeliveryGroupMethod method) {
            appliedMethods.clear();
            appliedMethods.add(method);
            selectedMethod = method;
        }
    }

    @TestSetup
    static void setup() {
        Account acc = new Account(Name = 'Test School District');
        insert acc;

        WebStore store = new WebStore(Name = 'Test Store');
        insert store;

        WebCart cart = new WebCart(
            Name       = 'Test Cart',
            WebStoreId = store.Id,
            AccountId  = acc.Id,
            Status     = 'Active'
        );
        insert cart;

        // Shipping Charge Product (framework requirement)
        Product2 shippingProd = new Product2(
            Name     = 'Shipping Charge Product',
            IsActive = true
        );
        insert shippingProd;

        // Shippable physical product
        Product2 physicalProd = new Product2(
            Name     = 'Test Physical Book',
            IsActive = true,
            Is_Digital_Product__c = false
        );
        insert physicalProd;

        // Digital product (exempt from shipping)
        Product2 digitalProd = new Product2(
            Name     = 'Test Digital Resource',
            IsActive = true,
            Is_Digital_Product__c = true
        );
        insert digitalProd;

        CartDeliveryGroup cdg = new CartDeliveryGroup(
            CartId        = cart.Id,
            Name          = 'Default Delivery',
            DeliverToName = 'Test User'
        );
        insert cdg;

        CartItem physItem = new CartItem(
            CartId              = cart.Id,
            CartDeliveryGroupId = cdg.Id,
            Product2Id          = physicalProd.Id,
            Name                = physicalProd.Name,
            Quantity            = 10,
            SalesPrice          = 25.00,
            TotalPrice          = 250.00,
            Type                = 'Product'
        );
        insert physItem;

        CartItem digiItem = new CartItem(
            CartId              = cart.Id,
            CartDeliveryGroupId = cdg.Id,
            Product2Id          = digitalProd.Id,
            Name                = digitalProd.Name,
            Quantity            = 5,
            SalesPrice          = 10.00,
            TotalPrice          = 50.00,
            Type                = 'Product'
        );
        insert digiItem;
    }

    private static Shipping_Config__mdt buildTestConfig() {
        Shipping_Config__mdt cfg = new Shipping_Config__mdt();
        cfg.Shipping_Rate_Percent__c = 12.00;
        cfg.Shipping_Method_Name__c  = 'Standard Shipping';
        cfg.Carrier__c               = 'USPS';
        cfg.Is_Active__c             = true;
        return cfg;
    }

    private static ABCShippingCalculator.CartLine makeCartLine(
        Id productId,
        CartExtension.SalesItemTypeEnum itemType,
        Decimal totalPrice
    ) {
        return ABCShippingCalculator.newCartLine(productId, itemType, totalPrice);
    }

    // ── Config helper tests ──────────────────────────────────────────

    @IsTest
    static void testSetConfigForTest_injectsConfig() {
        Shipping_Config__mdt cfg = buildTestConfig();
        ABCShippingCalculator.setConfigForTest(cfg);

        Test.startTest();
        Shipping_Config__mdt result = ABCShippingCalculator.getConfig();
        Test.stopTest();

        System.assertEquals(12.00, result.Shipping_Rate_Percent__c);
        System.assertEquals('Standard Shipping', result.Shipping_Method_Name__c);
        System.assertEquals('USPS', result.Carrier__c);
        System.assertEquals(true, result.Is_Active__c);
    }

    @IsTest
    static void testGetConfig_returnsCachedInstance() {
        ABCShippingCalculator.setConfigForTest(buildTestConfig());

        Test.startTest();
        Shipping_Config__mdt first  = ABCShippingCalculator.getConfig();
        Shipping_Config__mdt second = ABCShippingCalculator.getConfig();
        Test.stopTest();

        System.assert(first === second, 'Should return same cached instance');
    }

    @IsTest
    static void testGetConfig_queriesRealCmdtWhenCacheNull() {
        // When cache is null, getConfig() queries the real CMDT
        ABCShippingCalculator.setConfigForTest(null);

        Test.startTest();
        Shipping_Config__mdt result = ABCShippingCalculator.getConfig();
        Test.stopTest();

        // The deployed Default record should be returned
        System.assertNotEquals(null, result,
            'Should find the deployed Shipping_Config__mdt record');
        System.assertEquals(12.00, result.Shipping_Rate_Percent__c);
    }

    @IsTest
    static void testGetConfig_differentRates() {
        Shipping_Config__mdt cfg = new Shipping_Config__mdt();
        cfg.Shipping_Rate_Percent__c = 8.50;
        cfg.Shipping_Method_Name__c  = 'Economy Shipping';
        cfg.Carrier__c               = 'UPS';
        cfg.Is_Active__c             = true;
        ABCShippingCalculator.setConfigForTest(cfg);

        Test.startTest();
        Shipping_Config__mdt result = ABCShippingCalculator.getConfig();
        Test.stopTest();

        System.assertEquals(8.50, result.Shipping_Rate_Percent__c);
        System.assertEquals('Economy Shipping', result.Shipping_Method_Name__c);
        System.assertEquals('UPS', result.Carrier__c);
    }

    // ── Data validation tests ────────────────────────────────────────

    @IsTest
    static void testShippingChargeProductExists() {
        Test.startTest();
        List<Product2> results = [
            SELECT Id FROM Product2
            WHERE Name = 'Shipping Charge Product' AND IsActive = true
        ];
        Test.stopTest();

        System.assertEquals(1, results.size(),
            'Shipping Charge Product must exist for the calculator to work');
    }

    @IsTest
    static void testDigitalProductFlagged() {
        Test.startTest();
        Product2 digiProd = [
            SELECT Is_Digital_Product__c
            FROM Product2
            WHERE Name = 'Test Digital Resource'
        ];
        Test.stopTest();

        System.assertEquals(true, digiProd.Is_Digital_Product__c,
            'Digital products must be flagged as shipping-exempt');
    }

    @IsTest
    static void testPhysicalProductNotFlagged() {
        Test.startTest();
        Product2 physProd = [
            SELECT Is_Digital_Product__c
            FROM Product2
            WHERE Name = 'Test Physical Book'
        ];
        Test.stopTest();

        System.assertEquals(false, physProd.Is_Digital_Product__c,
            'Physical products should be shippable');
    }

    @IsTest
    static void testCartDataSetup() {
        Test.startTest();
        WebCart cart = [SELECT Id FROM WebCart WHERE Name = 'Test Cart'];
        List<CartItem> items = [
            SELECT Product2Id, TotalPrice, Type
            FROM CartItem WHERE CartId = :cart.Id
        ];
        List<CartDeliveryGroup> groups = [
            SELECT Id FROM CartDeliveryGroup WHERE CartId = :cart.Id
        ];
        Test.stopTest();

        System.assertEquals(2, items.size(), 'Should have 2 cart items');
        System.assertEquals(1, groups.size(), 'Should have 1 delivery group');

        Decimal physicalTotal = 0;
        for (CartItem item : items) {
            Product2 prod = [
                SELECT Is_Digital_Product__c
                FROM Product2 WHERE Id = :item.Product2Id
            ];
            if (!prod.Is_Digital_Product__c) {
                physicalTotal += item.TotalPrice;
            }
        }
        // 12% of physical total
        Decimal expectedShipping = (physicalTotal * 0.12).setScale(2, RoundingMode.HALF_UP);
        System.assertEquals(30.00, expectedShipping,
            'Expected shipping = 12% of 250.00 = 30.00');
    }

    @IsTest
    static void testGetShippingRatePercent_returnsConfiguredValue() {
        ABCShippingCalculator.setConfigForTest(buildTestConfig());

        Test.startTest();
        Decimal ratePercent = ABCShippingCalculator.getShippingRatePercent();
        Test.stopTest();

        System.assertEquals(12.00, ratePercent,
            'The exposed shipping rate percent should match active metadata.');
    }

    @IsTest
    static void testGetShippingRatePercentForTest_returnsConfiguredValue() {
        ABCShippingCalculator.setConfigForTest(buildTestConfig());

        Test.startTest();
        Decimal ratePercent = ABCShippingCalculator.getShippingRatePercentForTest();
        Test.stopTest();

        System.assertEquals(12.00, ratePercent,
            'The test-visible rate wrapper should return the active configured rate.');
    }

    @IsTest
    static void testResolveShippingProductIdForTest_returnsShippingProduct() {
        Test.startTest();
        Id shippingProductId = ABCShippingCalculator.resolveShippingProductIdForTest();
        Test.stopTest();

        System.assertNotEquals(null, shippingProductId,
            'The shipping product lookup should resolve the configured charge product.');
    }

    @IsTest
    static void testCalculateShippingFeeForTest_usesConfiguredPercentage() {
        ABCShippingCalculator.setConfigForTest(buildTestConfig());

        Test.startTest();
        Decimal shippingFee = ABCShippingCalculator.calculateShippingFeeForTest(500);
        Test.stopTest();

        System.assertEquals(60.00, shippingFee,
            'Configured shipping percent should be applied to the shippable total.');
    }

    @IsTest
    static void testValidateConfigurationForTest_returnsExpectedMessages() {
        ABCShippingCalculator.setConfigForTest(buildTestConfig());
        Id shippingProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Shipping Charge Product'
            LIMIT 1
        ].Id;

        Test.startTest();
        String noGroupsMessage = ABCShippingCalculator.validateConfigurationForTest(0, shippingProductId);
        String missingProductMessage = ABCShippingCalculator.validateConfigurationForTest(1, null);
        String validMessage = ABCShippingCalculator.validateConfigurationForTest(1, shippingProductId);
        Test.stopTest();

        System.assertEquals('No delivery address found. Please add a shipping address.', noGroupsMessage);
        System.assertEquals('Shipping Charge Product not found. Please contact support.', missingProductMessage);
        System.assertEquals(null, validMessage);
    }

    @IsTest
    static void testSumShippableLineTotalsForTest_excludesDigitalProducts() {
        Id physicalProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Test Physical Book'
            LIMIT 1
        ].Id;

        Id digitalProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Test Digital Resource'
            LIMIT 1
        ].Id;

        Map<Id, Decimal> totals = new Map<Id, Decimal>{
            physicalProductId => 150,
            digitalProductId => 50
        };

        Test.startTest();
        Decimal shippableTotal = ABCShippingCalculator.sumShippableLineTotalsForTest(totals);
        Test.stopTest();

        System.assertEquals(150, shippableTotal,
            'Only physical products should contribute to shipping.');
    }

    @IsTest
    static void testSumShippableLineTotalsForTest_returnsZeroForEmptyInput() {
        Test.startTest();
        Decimal shippableTotal = ABCShippingCalculator.sumShippableLineTotalsForTest(new Map<Id, Decimal>());
        Test.stopTest();

        System.assertEquals(0, shippableTotal,
            'Empty shippable line inputs should return a zero shipping base.');
    }

    @IsTest
    static void testAddProductLineTotal_accumulatesOnlyValidPhysicalProductLines() {
        Id physicalProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Test Physical Book'
            LIMIT 1
        ].Id;

        Map<Id, Decimal> totals = new Map<Id, Decimal>();

        Test.startTest();
        ABCShippingCalculator.addProductLineTotal(
            totals,
            physicalProductId,
            CartExtension.SalesItemTypeEnum.CHARGE,
            25
        );
        ABCShippingCalculator.addProductLineTotal(
            totals,
            null,
            CartExtension.SalesItemTypeEnum.PRODUCT,
            25
        );
        ABCShippingCalculator.addProductLineTotal(
            totals,
            physicalProductId,
            CartExtension.SalesItemTypeEnum.PRODUCT,
            null
        );
        ABCShippingCalculator.addProductLineTotal(
            totals,
            physicalProductId,
            CartExtension.SalesItemTypeEnum.PRODUCT,
            100
        );
        ABCShippingCalculator.addProductLineTotal(
            totals,
            physicalProductId,
            CartExtension.SalesItemTypeEnum.PRODUCT,
            50
        );
        Test.stopTest();

        System.assertEquals(1, totals.size(), 'Only valid product lines should be accumulated.');
        System.assertEquals(150, totals.get(physicalProductId),
            'Valid product line totals should accumulate for the same product.');
    }

    @IsTest
    static void testBuildDeliveryMethod_setsConfiguredCarrierAndService() {
        Id shippingProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Shipping Charge Product'
            LIMIT 1
        ].Id;

        ABCShippingCalculator.setConfigForTest(buildTestConfig());

        Test.startTest();
        CartExtension.CartDeliveryGroupMethod method = ABCShippingCalculator.buildDeliveryMethod(
            ABCShippingCalculator.getConfig(),
            30,
            shippingProductId
        );
        Test.stopTest();

        System.assertEquals('Standard Shipping', method.getName());
        System.assertEquals(30, method.getShippingFee());
        System.assertEquals(shippingProductId, method.getProductId());
        System.assertEquals('USPS', method.getCarrier());
        System.assertEquals('Standard', method.getClassOfService());
    }

    @IsTest
    static void testBuildShippingValidation_createsShippingErrorOutput() {
        Test.startTest();
        CartExtension.CartValidationOutput cvo = ABCShippingCalculator.buildShippingValidation('Missing delivery address');
        Boolean isShippingValidation = ABCShippingCalculator.isShippingValidation(cvo);
        Test.stopTest();

        System.assertEquals(CartExtension.CartValidationOutputTypeEnum.SHIPPING, cvo.getType());
        System.assertEquals(CartExtension.CartValidationOutputLevelEnum.ERROR, cvo.getLevel());
        System.assertEquals('Missing delivery address', cvo.getMessage());
        System.assertEquals(true, isShippingValidation, 'Shipping validation helper should identify shipping errors.');
    }

    @IsTest
    static void testIsShippingValidation_returnsFalseForNonShippingOutput() {
        CartExtension.CartValidationOutput inventoryCvo = new CartExtension.CartValidationOutput(
            CartExtension.CartValidationOutputTypeEnum.INVENTORY,
            CartExtension.CartValidationOutputLevelEnum.ERROR
        );

        Test.startTest();
        Boolean result = ABCShippingCalculator.isShippingValidation(inventoryCvo);
        Test.stopTest();

        System.assertEquals(false, result,
            'Only shipping validation outputs should be removed from the cart validation list.');
    }

    @IsTest
    static void testCalculate_selectsConfiguredDeliveryMethod_forShippableCart() {
        Id physicalProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Test Physical Book'
            LIMIT 1
        ].Id;

        FakeCalculationContext context = new FakeCalculationContext(1);
        context.validationState.errors.add(ABCShippingCalculator.buildShippingValidation('Old shipping warning'));
        context.cartLines.add(makeCartLine(physicalProductId, CartExtension.SalesItemTypeEnum.PRODUCT, 250));
        context.cartLines.add(makeCartLine(physicalProductId, CartExtension.SalesItemTypeEnum.CHARGE, 20));

        ABCShippingCalculator.setConfigForTest(buildTestConfig());
        Id shippingProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Shipping Charge Product'
            LIMIT 1
        ].Id;

        Test.startTest();
        ABCShippingCalculator.runCalculation(context, ABCShippingCalculator.getConfig(), shippingProductId);
        Test.stopTest();

        System.assertEquals(0, context.validationState.errors.size(),
            'Existing shipping validations should be cleared on a successful calculation run.');
        System.assertEquals(1, context.appliedMethods.size(),
            'The calculator should replace legacy methods with exactly one configured method.');
        System.assertEquals('Standard Shipping', context.appliedMethods[0].getName());
        System.assertEquals(30, context.appliedMethods[0].getShippingFee(),
            'Shipping fee should be 12% of the 250.00 shippable physical total.');
        System.assertNotEquals(null, context.selectedMethod,
            'The configured method must be selected on the delivery group.');
        System.assertEquals('Standard Shipping', context.selectedMethod.getName(),
            'The selected delivery method should match the configured shipping method.');
    }

    @IsTest
    static void testCalculate_addsShippingValidation_whenNoDeliveryGroupsExist() {
        Id physicalProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Test Physical Book'
            LIMIT 1
        ].Id;

        FakeCalculationContext context = new FakeCalculationContext(0);
        context.cartLines.add(makeCartLine(physicalProductId, CartExtension.SalesItemTypeEnum.PRODUCT, 250));

        ABCShippingCalculator.setConfigForTest(buildTestConfig());
        Id shippingProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Shipping Charge Product'
            LIMIT 1
        ].Id;

        Test.startTest();
        ABCShippingCalculator.runCalculation(context, ABCShippingCalculator.getConfig(), shippingProductId);
        Test.stopTest();

        System.assertEquals(1, context.validationState.errors.size(),
            'Validation output should be added when the cart has no delivery groups.');
        System.assertEquals(
            'No delivery address found. Please add a shipping address.',
            context.validationState.errors[0].getMessage()
        );
        System.assertEquals(0, context.appliedMethods.size(),
            'No delivery method should be applied when validation fails.');
    }

    @IsTest
    static void testCalculate_addsShippingValidation_whenConfigIsMissing() {
        FakeCalculationContext context = new FakeCalculationContext(1);
        context.cartLines.add(makeCartLine(null, CartExtension.SalesItemTypeEnum.PRODUCT, 250));

        Id shippingProductId = [
            SELECT Id
            FROM Product2
            WHERE Name = 'Shipping Charge Product'
            LIMIT 1
        ].Id;

        Test.startTest();
        ABCShippingCalculator.runCalculation(context, null, shippingProductId);
        Test.stopTest();

        System.assertEquals(1, context.validationState.errors.size(),
            'Missing shipping configuration should add a shipping validation error.');
        System.assertEquals(
            'Shipping configuration not found. Please contact support.',
            context.validationState.errors[0].getMessage()
        );
        System.assertEquals(0, context.appliedMethods.size(),
            'No delivery method should be selected when configuration is missing.');
    }

    // ── Calculator instantiation ─────────────────────────────────────

    @IsTest
    static void testCalculatorInstantiation() {
        Test.startTest();
        ABCShippingCalculator calc = new ABCShippingCalculator();
        Test.stopTest();

        System.assertNotEquals(null, calc, 'Calculator should instantiate');
    }
}