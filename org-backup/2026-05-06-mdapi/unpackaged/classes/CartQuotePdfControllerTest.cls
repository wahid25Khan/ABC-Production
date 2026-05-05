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

        // Create CartDeliveryGroup (required parent for CartItem)
        CartDeliveryGroup cdg = new CartDeliveryGroup(
            CartId = cart.Id,
            Name = 'Default Delivery',
            DeliverToName = 'Test User'
        );
        insert cdg;

        // Create Product2 and PricebookEntry so QuoteLineItems can be created
        Product2 prod = new Product2(
            Name = 'Georgia K-12 Standards Success Grade 5 Math',
            StockKeepingUnit = '641177888',
            IsActive = true
        );
        insert prod;

        Id stdPbId = Test.getStandardPricebookId();
        PricebookEntry pbe = new PricebookEntry(
            Pricebook2Id = stdPbId,
            Product2Id   = prod.Id,
            UnitPrice    = 41.00,
            IsActive     = true
        );
        insert pbe;

        // Create CartItem with Product2Id so line items resolve
        CartItem item = new CartItem(
            CartId             = cart.Id,
            CartDeliveryGroupId = cdg.Id,
            Name               = prod.Name,
            Sku                = prod.StockKeepingUnit,
            Product2Id         = prod.Id,
            Quantity           = 25,
            SalesPrice         = 28.50,
            TotalPrice         = 712.50,
            Type               = 'Product'
        );
        insert item;
    }

    private static CartQuotePdfController.QuoteRequest buildRequest() {
        CartQuotePdfController.QuoteRequest req = new CartQuotePdfController.QuoteRequest();
        req.contactName      = 'Alex Carter';
        req.organizationName = 'ABC Test School';
        req.streetAddress    = '123 Main St';
        req.city             = 'Woodstock';
        req.stateCode        = 'GA';
        req.stateLabel       = 'Georgia';
        req.postalCode       = '30188';
        req.contactPhone     = '555-123-4567';
        req.contactEmail     = 'alex@example.com';
        req.taxExempt        = true;
        req.subtotal         = 712.50;
        req.shippingAmount   = 71.25;
        req.salesTaxAmount   = 0;
        req.grandTotal       = 783.75;
        return req;
    }

    @IsTest
    static void testGenerateQuotePdf_success() {
        Test.startTest();
        CartQuotePdfController.QuoteResult result = CartQuotePdfController.generateQuotePdf(
            JSON.serialize(buildRequest())
        );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Should succeed with items in cart');
        System.assertNotEquals(null, result.pdfBase64, 'PDF base64 should be populated');
        System.assert(result.quoteNumber.startsWith('ABC-'), 'Quote number should start with ABC-');
        System.assertEquals(18, result.quoteNumber.length(), 'Quote number should be 18 chars: ABC-YYYYMMDD-XXXXX');
        System.assertEquals('Quote generated successfully.', result.message);
    }

    @IsTest
    static void testGenerateQuotePdf_createsQuoteRecord() {
        Test.startTest();
        CartQuotePdfController.QuoteResult result = CartQuotePdfController.generateQuotePdf(
            JSON.serialize(buildRequest())
        );
        Test.stopTest();

        System.assertEquals(true, result.success, 'PDF generation should succeed');
        System.assertNotEquals(null, result.quoteId, 'A Salesforce Quote record should be created');

        Quote q = [
            SELECT Id, Name, Phone, BillingCity, BillingState, BillingPostalCode,
                   ShippingCity, ShippingState, ShippingPostalCode,
                   ExpirationDate, Description
            FROM Quote
            WHERE Id = :result.quoteId
        ];

        System.assertEquals(result.quoteNumber, q.Name, 'Quote Name should match quote number');
        System.assertEquals('GA', q.ShippingState);
        System.assertEquals('Woodstock', q.ShippingCity);
        System.assertEquals('30188', q.ShippingPostalCode);
        System.assertEquals('GA', q.BillingState);
        System.assertEquals(Date.today().addDays(30), q.ExpirationDate);
        System.assert(q.Description.contains('alex@example.com'), 'Description should include email');
        System.assert(q.Description.contains('71.25'), 'Description should include shipping amount');
        System.assert(q.Description.contains('28.50'), 'Description should include unit price');
        System.assert(q.Description.contains('25'), 'Description should include quantity');

        // Verify parent Opportunity was created
        Quote qWithOpp = [SELECT OpportunityId FROM Quote WHERE Id = :result.quoteId];
        Opportunity opp = [
            SELECT Name, StageName, CloseDate
            FROM Opportunity
            WHERE Id = :qWithOpp.OpportunityId
        ];
        System.assertEquals('Proposal/Price Quote', opp.StageName);
        System.assertEquals(Date.today().addDays(30), opp.CloseDate);
        System.assert(opp.Name.contains(result.quoteNumber), 'Opportunity name should include quote number');
    }

    @IsTest
    static void testGenerateQuotePdf_emptyCart() {
        // Remove all cart items
        delete [SELECT Id FROM CartItem];

        Test.startTest();
        CartQuotePdfController.QuoteResult result = CartQuotePdfController.generateQuotePdf(null);
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
        CartQuotePdfController.QuoteResult result = CartQuotePdfController.generateQuotePdf(null);
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail with no cart');
        System.assert(result.message.contains('No active cart'), 'Message should mention no cart');
    }
}