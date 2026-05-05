@IsTest
private class CartQuotePdfPageControllerTest {

    @TestSetup
    static void setup() {
        Account acc = new Account(Name = 'Test School');
        insert acc;

        WebStore store = new WebStore(Name = 'Test Store');
        insert store;

        WebCart cart = new WebCart(
            Name = 'Test Cart',
            WebStoreId = store.Id,
            AccountId = acc.Id,
            Status = 'Active'
        );
        insert cart;

        CartDeliveryGroup cdg = new CartDeliveryGroup(
            CartId = cart.Id,
            Name = 'Default Delivery',
            DeliverToName = 'Test User'
        );
        insert cdg;

        CartItem item = new CartItem(
            CartId = cart.Id,
            CartDeliveryGroupId = cdg.Id,
            Name = 'Test Product ELA',
            Sku = 'SKU-001',
            Quantity = 10,
            SalesPrice = 44.00,
            TotalPrice = 440.00,
            Type = 'Product'
        );
        insert item;
    }

    @IsTest
    static void testControllerWithValidCartId() {
        WebCart cart = [SELECT Id FROM WebCart LIMIT 1];

        Test.setCurrentPage(Page.CartQuotePdf);
        ApexPages.currentPage().getParameters().put('cartId', cart.Id);
        ApexPages.currentPage().getParameters().put('quoteNumber', 'ABC-20260330-12345');
        ApexPages.currentPage().getParameters().put('contactName', 'Jordan Smith');
        ApexPages.currentPage().getParameters().put('organizationName', 'American Book Company');
        ApexPages.currentPage().getParameters().put('streetAddress', '123 Market Street');
        ApexPages.currentPage().getParameters().put('city', 'Atlanta');
        ApexPages.currentPage().getParameters().put('stateLabel', 'Georgia');
        ApexPages.currentPage().getParameters().put('postalCode', '30303');
        ApexPages.currentPage().getParameters().put('contactPhone', '555-222-1111');
        ApexPages.currentPage().getParameters().put('contactEmail', 'jordan@example.com');
        ApexPages.currentPage().getParameters().put('taxExempt', 'true');
        ApexPages.currentPage().getParameters().put('subtotal', '440.00');
        ApexPages.currentPage().getParameters().put('shippingAmount', '44.00');
        ApexPages.currentPage().getParameters().put('salesTaxAmount', '0');
        ApexPages.currentPage().getParameters().put('grandTotal', '484.00');

        Test.startTest();
        CartQuotePdfPageController ctrl = new CartQuotePdfPageController();
        Test.stopTest();

        System.assertEquals('ABC-20260330-12345', ctrl.quoteNumber, 'Quote number should match');
        System.assertNotEquals(null, ctrl.quoteDate, 'Quote date should be set');
        System.assertEquals(1, ctrl.lines.size(), 'Should have 1 line item');
        System.assertEquals('Jordan Smith', ctrl.contactName);
        System.assertEquals('American Book Company', ctrl.organizationName);
        System.assertEquals('123 Market Street', ctrl.streetAddress);
        System.assertEquals('Atlanta, Georgia 30303', ctrl.getAddressLine());
        System.assertEquals(true, ctrl.taxExempt);
        System.assertEquals(440.00, ctrl.subtotal, 'Subtotal should match the request');
        System.assertEquals(44.00, ctrl.shippingAmount, 'Shipping should match the request');
        System.assertEquals(0.00, ctrl.salesTaxAmount, 'Sales tax should match the request');
        System.assertEquals(484.00, ctrl.grandTotal, 'Grand total should match the request');

        CartQuotePdfPageController.QuoteLine line = ctrl.lines[0];
        System.assertEquals('Test Product ELA', line.productName);
        System.assertEquals('SKU-001', line.sku);
        System.assertEquals(10, line.quantity);
        System.assertEquals(44.00, line.unitPrice);
    }

    @IsTest
    static void testControllerWithNoCartId() {
        Test.setCurrentPage(Page.CartQuotePdf);

        Test.startTest();
        CartQuotePdfPageController ctrl = new CartQuotePdfPageController();
        Test.stopTest();

        System.assertEquals(0, ctrl.lines.size(), 'Should have no lines without cartId');
        System.assertEquals(0, ctrl.subtotal, 'Subtotal should be 0');
        System.assertEquals(0, ctrl.grandTotal, 'Grand total should be 0');
    }

    @IsTest
    static void testControllerWithInvalidCartId() {
        Test.setCurrentPage(Page.CartQuotePdf);
        ApexPages.currentPage().getParameters().put('cartId', '0a6000000000000AAA');
        ApexPages.currentPage().getParameters().put('quoteNumber', 'ABC-TEST');

        Test.startTest();
        CartQuotePdfPageController ctrl = new CartQuotePdfPageController();
        Test.stopTest();

        System.assertEquals(0, ctrl.lines.size(), 'Should handle invalid cart ID gracefully');
    }
}