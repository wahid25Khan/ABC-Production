@IsTest
private class AuthenticatedBuyerCheckoutServiceTest {
    private class FakeCartContextProvider implements AuthenticatedBuyerCheckoutService.CartContextProvider {
        private AuthenticatedBuyerCheckoutService.CartContext context;

        FakeCartContextProvider(AuthenticatedBuyerCheckoutService.CartContext context) {
            this.context = context;
        }

        public AuthenticatedBuyerCheckoutService.CartContext load(Id cartId) {
            return context;
        }
    }

    private class FakeCheckoutContextProvider implements AuthenticatedBuyerCheckoutService.CheckoutContextProvider {
        private AuthenticatedBuyerCheckoutService.CheckoutContext context;

        FakeCheckoutContextProvider(AuthenticatedBuyerCheckoutService.CheckoutContext context) {
            this.context = context;
        }

        public AuthenticatedBuyerCheckoutService.CheckoutContext load(Id checkoutSessionId) {
            return context;
        }
    }

    private class FakeTransport implements AuthenticatedBuyerCheckoutService.HttpTransport {
        List<HttpRequest> requests = new List<HttpRequest>();
        List<HttpResponse> responses = new List<HttpResponse>();

        public HttpResponse send(HttpRequest request) {
            requests.add(request);
            return responses.remove(0);
        }
    }

    @IsTest
    static void testEnsureCheckoutSessionUsesEffectiveAccountContext() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"cartCheckoutSessionId":"2z9Wj000000hT0LIAU"}'
        ));

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.CheckoutStartResult result =
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                'buyer-session'
            );
        Test.stopTest();

        System.assertEquals((Id) '2z9Wj000000hT0LIAU', result.checkoutId);
        System.assertEquals(1, transport.requests.size());
        System.assertEquals('PUT', transport.requests[0].getMethod());
        System.assert(transport.requests[0].getEndpoint().contains('effectiveAccountId=001Wj000017UYj1IAG'));
        System.assert(transport.requests[0].getBody().contains('0a6Wj000000mMJBIA2'));

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionStringOverloadResolvesCurrentCart() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';
        context.existingCheckoutSessionId = (Id) '2z9Wj000000hT0LIAU';

        AuthenticatedBuyerCheckoutService.testCurrentCartId = context.cartId;
        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);

        Test.startTest();
        AuthenticatedBuyerCheckoutService.CheckoutStartResult result =
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                '0ZEam000004dJDNGA2',
                'current'
            );
        Test.stopTest();

        System.assertEquals((Id) '2z9Wj000000hT0LIAU', result.checkoutId);

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionReusesExistingSession() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';
        context.existingCheckoutSessionId = (Id) '2z9Wj000000hT0LIAU';

        FakeTransport transport = new FakeTransport();

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.CheckoutStartResult result =
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                'buyer-session'
            );
        Test.stopTest();

        System.assertEquals((Id) '2z9Wj000000hT0LIAU', result.checkoutId);
        System.assertEquals(0, transport.requests.size(), 'Existing checkout sessions should be reused without a second callout.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionBlocksGuestContext() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.guestEmailAddress = 'guest@example.com';

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                'buyer-session'
            );
            System.assert(false, 'Guest contexts must be blocked.');
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Guest contexts must throw.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionRequiresAuthenticatedSession() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                null
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Missing session auth must throw.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionUsesLocationHeaderWhenBodyOmitsCheckoutId() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        HttpResponse response = makeResponse(201, '');
        response.setHeader('Location', 'https://example.com/services/data/v66.0/commerce/webstores/0ZEam000004dJDNGA2/checkouts/2z9Wj000000hT0LIAU');
        transport.responses.add(response);

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.CheckoutStartResult result =
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                'buyer-session'
            );
        Test.stopTest();

        System.assertEquals((Id) '2z9Wj000000hT0LIAU', result.checkoutId);

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionUsesCheckoutIdField() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"checkoutId":"2z9Wj000000hT0LIAU"}'
        ));

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.CheckoutStartResult result =
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                'buyer-session'
            );
        Test.stopTest();

        System.assertEquals((Id) '2z9Wj000000hT0LIAU', result.checkoutId);

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionFailsWhenCartContextMissing() {
        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(null);
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                (Id) '0ZEam000004dJDNGA2',
                (Id) '0a6Wj000000mMJBIA2',
                'buyer-session'
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Missing cart context must throw.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionStringOverloadRejectsInvalidIds() {
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession('not-a-webstore-id', 'not-a-cart-id');
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Invalid string ids must fail fast.');
    }

    @IsTest
    static void testEnsureCheckoutSessionSurfacesListApiErrors() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            400,
            '[{"message":"Checkout init failed"}]'
        ));

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                'buyer-session'
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'List-form API errors must throw.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureCheckoutSessionBlocksNonAccountContext() {
        AuthenticatedBuyerCheckoutService.CartContext context = new AuthenticatedBuyerCheckoutService.CartContext();
        context.cartId = (Id) '0a6Wj000000mMJBIA2';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '3K0am000000d3dxCAA';

        AuthenticatedBuyerCheckoutService.cartContextProvider = new FakeCartContextProvider(context);
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.ensureCheckoutSession(
                context.webStoreId,
                context.cartId,
                'buyer-session'
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Non-account contexts must be blocked.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testPlaceOrderUsesEffectiveAccountContext() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"orderId":"801Wj0000000abcIAA","orderReferenceNumber":"REF-123","orderSummaryId":"801Wj0000000defIAA"}'
        ));

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.PlaceOrderResult result =
            AuthenticatedBuyerCheckoutService.placeOrder(
                context.checkoutSessionId,
                'buyer-session'
            );
        Test.stopTest();

        System.assertEquals((Id) '801Wj0000000abcIAA', result.orderId);
        System.assertEquals('REF-123', result.orderReferenceNumber);
        System.assertEquals((Id) '801Wj0000000defIAA', result.orderSummaryId);
        System.assertEquals(1, transport.requests.size());
        System.assertEquals('POST', transport.requests[0].getMethod());
        System.assert(transport.requests[0].getEndpoint().contains('/orders?effectiveAccountId=001Wj000017UYj1IAG'));

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testPlaceOrderSurfacesNestedCommerceError() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            400,
            '{"errors":[{"detail":"Looks like the payment method isn&#39;t authorized."}]}'
        ));

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.placeOrder(
                context.checkoutSessionId,
                'buyer-session'
            );
            System.assert(false, 'Nested Commerce errors must be surfaced.');
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Nested Commerce errors must throw.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testPlaceOrderFailsWhenCheckoutContextMissing() {
        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(null);
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.placeOrder(
                (Id) '2z9Wj000000hT0LIAU',
                'buyer-session'
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Missing checkout context must throw.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testPlaceOrderRequiresAuthenticatedSession() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.placeOrder(
                context.checkoutSessionId,
                null
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Missing session auth must throw.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testPlaceOrderStringOverloadRejectsInvalidId() {
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.placeOrder('not-a-checkout-id');
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Invalid checkout session ids must fail fast.');
    }

    // ── registerExternalPayment ──────────────────────────────────────────────────

    @IsTest
    static void testRegisterExternalPaymentSuccessWithTransactionId() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId        = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(200, '{}'));

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.registerExternalPayment(
            String.valueOf(context.webStoreId),
            String.valueOf(context.checkoutSessionId),
            99.95,
            'txn-abc-123'
        );
        Test.stopTest();

        System.assertEquals(1, transport.requests.size(), 'Should make one POST request');
        System.assertEquals('POST', transport.requests[0].getMethod());
        System.assert(transport.requests[0].getEndpoint().contains('/payments?effectiveAccountId=001Wj000017UYj1IAG'),
            'Payments endpoint must include effectiveAccountId');
        String body = transport.requests[0].getBody();
        System.assert(body.contains('paymentAmount'), 'Body must include paymentAmount');
        System.assert(body.contains('txn-abc-123'), 'Body must include the AN transaction id');
        System.assert(body.contains('requestType'), 'Body must include the Checkout payment request type');
        System.assert(body.contains('PostAuth'), 'Client-side payment registration must use PostAuth');
        System.assert(body.contains('paymentToken'), 'Body must include the payment token field');
        System.assert(!body.contains('additionalData'), 'Body must NOT include additionalData — Commerce Payments API rejects unknown fields');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testRegisterExternalPaymentSuccessOmitsAdditionalDataWhenNoTransactionId() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId        = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(200, '{}'));

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.registerExternalPayment(
            String.valueOf(context.webStoreId),
            String.valueOf(context.checkoutSessionId),
            50.00,
            null
        );
        Test.stopTest();

        System.assertEquals(0, transport.requests.size(),
            'No payment registration call should be made when the gateway transaction id is missing.');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testRegisterExternalPaymentThrowsOnApiError() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId        = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(400, '[{"message":"Payment gateway declined"}]'));

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.registerExternalPayment(
                String.valueOf(context.webStoreId),
                String.valueOf(context.checkoutSessionId),
                50.00,
                'txn-fail'
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()), 'Error message should be populated');
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'API errors must throw AuraHandledException');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testRegisterExternalPaymentFailsWhenCheckoutContextMissing() {
        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(null);
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.registerExternalPayment(
                '0ZEam000004dJDNGA2',
                '2z9Wj000000hT0LIAU',
                99.00,
                null
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Missing checkout context must throw');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testRegisterExternalPaymentRejectsInvalidIds() {
        Boolean didThrow = false;

        Test.startTest();
        try {
            AuthenticatedBuyerCheckoutService.registerExternalPayment(
                'not-a-store-id',
                'not-a-checkout-id',
                10.00,
                null
            );
        } catch (AuraHandledException ex) {
            didThrow = true;
            System.assert(String.isNotBlank(ex.getMessage()));
        }
        Test.stopTest();

        System.assertEquals(true, didThrow, 'Invalid IDs must throw');
    }

    // ── ensureDeliveryMethod ─────────────────────────────────────────────────────

    @IsTest
    static void testEnsureDeliveryMethodPatchesDeliveryGroupWithCorrectStructure() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId        = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        // The Commerce REST response provides deliveryMethodId (an OrderDeliveryMethod ID).
        // selectedDeliveryMethodId is intentionally ignored — it can contain an ODM ID which
        // would cause FIELD_INTEGRITY_EXCEPTION if passed to CartDeliveryGroup.SelectedDeliveryMethodId.
        // The method always uses the DML path (ensureDeliveryMethodForGroupLocal); no PATCH is issued.
        String getBody = JSON.serialize(new Map<String, Object>{
            'deliveryGroups' => new Map<String, Object>{
                'items' => new List<Object>{
                    new Map<String, Object>{
                        'id' => 'grp-001',
                        'deliveryMethodId' => '2DmWj000000EjYLKA0',
                        'availableDeliveryMethods' => new List<Object>{
                            new Map<String, Object>{ 'id' => 'dm-001' }
                        }
                    }
                }
            }
        });

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(200, getBody)); // GET checkout — only one request

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.ensureDeliveryMethod(
            context.webStoreId,
            context.checkoutSessionId,
            'buyer-session',
            0
        );
        Test.stopTest();

        // Only the GET should have been made — the DML path sets SelectedDeliveryMethodId
        // directly on the SObject; no PATCH callout is issued (would fail after DML anyway).
        System.assertEquals(1, transport.requests.size(), 'Should only GET — DML handles the SObject update, no PATCH needed');
        System.assertEquals('GET', transport.requests[0].getMethod());

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureDeliveryMethodSkipsGroupsWithExistingMethod() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId        = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        // selectedDeliveryMethodId is no longer used to short-circuit — it can contain an ODM ID.
        // The method always goes through ensureDeliveryMethodForGroupLocal (DML path).
        // A single GET is still the only HTTP request made.
        String getBody = JSON.serialize(new Map<String, Object>{
            'deliveryGroups' => new Map<String, Object>{
                'items' => new List<Object>{
                    new Map<String, Object>{
                        'id' => 'grp-001',
                        'selectedDeliveryMethodId' => '2DmWj000000EjYLKA0',
                        'deliveryMethodId' => '2DmWj000000EjYLKA0',
                        'availableDeliveryMethods' => new List<Object>{
                            new Map<String, Object>{ 'id' => 'dm-001' }
                        }
                    }
                }
            }
        });

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(200, getBody)); // GET only — no PATCH expected

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.ensureDeliveryMethod(
            context.webStoreId,
            context.checkoutSessionId,
            'buyer-session',
            0
        );
        Test.stopTest();

        System.assertEquals(1, transport.requests.size(), 'Should only GET, no PATCH when method already selected');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureDeliveryMethodNoOpsWhenGetFails() {
        AuthenticatedBuyerCheckoutService.CheckoutContext context = new AuthenticatedBuyerCheckoutService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hT0LIAU';
        context.webStoreId        = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017UYj1IAG';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(500, '{"message":"Server error"}')); // GET fails

        AuthenticatedBuyerCheckoutService.checkoutContextProvider = new FakeCheckoutContextProvider(context);
        AuthenticatedBuyerCheckoutService.httpTransport = transport;

        Test.startTest();
        // Should complete without throwing — ensureDeliveryMethod is non-fatal
        AuthenticatedBuyerCheckoutService.ensureDeliveryMethod(
            context.webStoreId,
            context.checkoutSessionId,
            'buyer-session',
            0
        );
        Test.stopTest();

        System.assertEquals(1, transport.requests.size(), 'Only GET attempted; no PATCH on server error');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureDeliveryMethodSoqlFallbackCreatesAndAssignsMethod() {
        // Covers the ABCShippingCalculator path: availableDeliveryMethods is always empty from
        // the Commerce REST API. The SOQL/DML fallback must create a CartDeliveryGroupMethod
        // and set CartDeliveryGroup.SelectedDeliveryMethodId — the field placeOrder validates.

        WebStore store = new WebStore(Name = 'Test Store', DefaultLanguage = 'en_US');
        insert store;

        Account acct = new Account(Name = 'Test Account');
        insert acct;

        Product2 shippingProduct = new Product2(Name = 'Shipping Charge Product', IsActive = true);
        insert shippingProduct;

        WebCart cart = new WebCart(Name = 'Test Cart', WebStoreId = store.Id, AccountId = acct.Id, Status = 'Active');
        insert cart;

        CartDeliveryGroup grp = new CartDeliveryGroup(CartId = cart.Id, Name = 'Default Delivery Group');
        insert grp;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.ensureDeliveryMethodForCart(cart.Id, 12.50);
        Test.stopTest();

        // CartDeliveryGroupMethod must have been created with the passed shipping amount
        List<CartDeliveryGroupMethod> methods = [
            SELECT Id, ShippingFee FROM CartDeliveryGroupMethod
            WHERE CartDeliveryGroupId = :grp.Id LIMIT 1
        ];
        System.assertEquals(1, methods.size(), 'SOQL fallback must create a CartDeliveryGroupMethod');
        System.assertEquals(12.50, methods[0].ShippingFee, 'Created method ShippingFee must match the passed shippingAmount');

        // CartDeliveryGroup.SelectedDeliveryMethodId must point to the CDGM — placeOrder reads this field
        CartDeliveryGroup updatedGrp = [SELECT SelectedDeliveryMethodId FROM CartDeliveryGroup WHERE Id = :grp.Id];
        System.assertEquals(methods[0].Id, updatedGrp.SelectedDeliveryMethodId,
            'CDG.SelectedDeliveryMethodId must be set to the CartDeliveryGroupMethod Id');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    @IsTest
    static void testEnsureDeliveryMethodSoqlFallbackSkipsGroupsWithExistingMethod() {
        // If a CartDeliveryGroupMethod already exists for the group, it must be reused (not duplicated).
        // CDG.SelectedDeliveryMethodId must still be set even when reusing an existing CDGM.

        WebStore store = new WebStore(Name = 'Test Store 2', DefaultLanguage = 'en_US');
        insert store;

        Account acct = new Account(Name = 'Test Account 2');
        insert acct;

        Product2 shippingProduct = new Product2(Name = 'Shipping Charge Product', IsActive = true);
        insert shippingProduct;

        WebCart cart = new WebCart(Name = 'Test Cart 2', WebStoreId = store.Id, AccountId = acct.Id, Status = 'Active');
        insert cart;

        CartDeliveryGroup grp = new CartDeliveryGroup(CartId = cart.Id, Name = 'Default Delivery Group');
        insert grp;

        CartDeliveryGroupMethod existing = new CartDeliveryGroupMethod(
            CartDeliveryGroupId = grp.Id,
            WebCartId = cart.Id,
            Name = 'Pre-existing Method',
            Carrier = 'ABC Shipping',
            ShippingFee = 5.00,
            ProductId = shippingProduct.Id
        );
        insert existing;

        Test.startTest();
        AuthenticatedBuyerCheckoutService.ensureDeliveryMethodForCart(cart.Id, 99.99);
        Test.stopTest();

        // Must not create a duplicate — existing method must be reused
        List<CartDeliveryGroupMethod> methods = [
            SELECT Id FROM CartDeliveryGroupMethod WHERE CartDeliveryGroupId = :grp.Id
        ];
        System.assertEquals(1, methods.size(), 'No duplicate CartDeliveryGroupMethod should be created');
        System.assertEquals(existing.Id, methods[0].Id, 'Existing CartDeliveryGroupMethod must be reused');

        // CDG.SelectedDeliveryMethodId must be set even when reusing
        CartDeliveryGroup updatedGrp = [SELECT SelectedDeliveryMethodId FROM CartDeliveryGroup WHERE Id = :grp.Id];
        System.assertEquals(existing.Id, updatedGrp.SelectedDeliveryMethodId,
            'CDG.SelectedDeliveryMethodId must be set to the existing CartDeliveryGroupMethod Id');

        AuthenticatedBuyerCheckoutService.resetTestState();
    }

    private static HttpResponse makeResponse(Integer statusCode, String body) {
        HttpResponse response = new HttpResponse();
        response.setStatusCode(statusCode);
        response.setBody(body);
        return response;
    }
}