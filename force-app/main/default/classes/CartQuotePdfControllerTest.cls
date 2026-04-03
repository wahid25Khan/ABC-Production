@IsTest
private class CartQuotePdfControllerTest {

    @TestSetup
    static void setup() {
        // Create Account
        Account acc = new Account(Name = 'Test School District');
        insert acc;

        // Create WebStore
        WebStore store = new WebStore(Name = 'Test Store');
        insert store;

        // Create WebCart
        WebCart cart = new WebCart(
            Name = 'Test Cart',
            WebStoreId = store.Id,
            AccountId = acc.Id,
            Status = 'Active'
        );
        insert cart;

        // Create Product
        Product2 prod = new Product2(
            Name = 'Georgia K-12 Standards Success Grade 5 Math',
            StockKeepingUnit = '641177888',
            IsActive = true
        );
        insert prod;

        // Create CartDeliveryGroup (required parent for CartItem)
        CartDeliveryGroup cdg = new CartDeliveryGroup(
            CartId = cart.Id,
            Name = 'Default Delivery',
            DeliverToName = 'Test User'
        );
        insert cdg;

        // Create CartItem
        CartItem item = new CartItem(
            CartId = cart.Id,
            CartDeliveryGroupId = cdg.Id,
            Product2Id = prod.Id,
            Name = prod.Name,
            Sku = '641177888',
            Quantity = 25,
            SalesPrice = 28.50,
            TotalPrice = 712.50,
            Type = 'Product'
        );
        insert item;
    }

    @IsTest
    static void testGenerateQuotePdf_success() {
        Test.startTest();
        CartQuotePdfController.QuoteResult result = CartQuotePdfController.generateQuotePdf();
        Test.stopTest();

        System.assertEquals(true, result.success, 'Should succeed with items in cart');
        System.assertNotEquals(null, result.pdfBase64, 'PDF base64 should be populated');
        System.assert(result.quoteNumber.startsWith('ABC-'), 'Quote number should start with ABC-');
        System.assertEquals(18, result.quoteNumber.length(), 'Quote number should be 18 chars: ABC-YYYYMMDD-XXXXX');
        System.assertEquals('Quote generated successfully.', result.message);
    }

    @IsTest
    static void testGenerateQuotePdf_emptyCart() {
        // Remove all cart items
        delete [SELECT Id FROM CartItem];

        Test.startTest();
        CartQuotePdfController.QuoteResult result = CartQuotePdfController.generateQuotePdf();
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail with empty cart');
        System.assert(result.message.contains('empty'), 'Message should mention empty cart');
    }

    @IsTest
    static void testGenerateQuotePdf_noCart() {
        // Remove the cart entirely
        delete [SELECT Id FROM CartItem];
        delete [SELECT Id FROM CartDeliveryGroup];
        delete [SELECT Id FROM WebCart];

        Test.startTest();
        CartQuotePdfController.QuoteResult result = CartQuotePdfController.generateQuotePdf();
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail with no cart');
        System.assert(result.message.contains('No active cart'), 'Message should mention no cart');
    }
}
