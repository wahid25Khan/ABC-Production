@IsTest
private class AuthBuyerAdminRecoveryServiceTest {
    private class FakeContextProvider implements AuthenticatedBuyerAdminRecoveryService.CheckoutContextProvider {
        private AuthenticatedBuyerAdminRecoveryService.CheckoutContext context;

        FakeContextProvider(AuthenticatedBuyerAdminRecoveryService.CheckoutContext context) {
            this.context = context;
        }

        public AuthenticatedBuyerAdminRecoveryService.CheckoutContext load(Id checkoutSessionId) {
            return context;
        }
    }

    private class FakeOrderLocator implements AuthenticatedBuyerAdminRecoveryService.ExistingOrderLocator {
        private Map<Id, AuthenticatedBuyerAdminRecoveryService.OrderLookupResult> byId =
            new Map<Id, AuthenticatedBuyerAdminRecoveryService.OrderLookupResult>();
        private Map<String, AuthenticatedBuyerAdminRecoveryService.OrderLookupResult> byReference =
            new Map<String, AuthenticatedBuyerAdminRecoveryService.OrderLookupResult>();

        public AuthenticatedBuyerAdminRecoveryService.OrderLookupResult findById(Id orderId) {
            return byId.get(orderId);
        }

        public AuthenticatedBuyerAdminRecoveryService.OrderLookupResult findByReference(String orderReferenceNumber) {
            return byReference.get(orderReferenceNumber);
        }
    }

    private class FakeTransport implements AuthenticatedBuyerAdminRecoveryService.HttpTransport {
        List<HttpRequest> requests = new List<HttpRequest>();
        List<HttpResponse> responses = new List<HttpResponse>();

        public HttpResponse send(HttpRequest request) {
            requests.add(request);
            return responses.remove(0);
        }
    }

    @IsTest
    static void test_blocks_guest_or_non_account_context() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '3K0am000000d3dxCAA';

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(false, result.success, 'Guest buyer profile contexts must be blocked.');
        System.assert(result.message.contains('excluded'), 'Result should clearly explain guest exclusion.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_fails_when_context_is_missing_or_incomplete() {
        Test.startTest();

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(null);
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult missingContextResult =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                (Id) '2z9Wj000000hRD3IAM',
                'test-session'
            );

        AuthenticatedBuyerAdminRecoveryService.CheckoutContext missingWebStoreContext =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        missingWebStoreContext.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        missingWebStoreContext.effectiveAccountId = (Id) '001Wj000017nncaIAA';
        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(missingWebStoreContext);
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult missingWebStoreResult =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                missingWebStoreContext.checkoutSessionId,
                'test-session'
            );

        AuthenticatedBuyerAdminRecoveryService.CheckoutContext missingAccountContext =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        missingAccountContext.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        missingAccountContext.webStoreId = (Id) '0ZEam000004dJDNGA2';
        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(missingAccountContext);
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult missingAccountResult =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                missingAccountContext.checkoutSessionId,
                'test-session'
            );

        Test.stopTest();

        System.assertEquals(false, missingContextResult.success, 'Missing sessions must fail fast.');
        System.assert(missingContextResult.message.contains('No CartCheckoutSession'),
            'Missing context failure should explain the lookup problem.');
        System.assertEquals(false, missingWebStoreResult.success, 'Missing web store context must be blocked.');
        System.assert(missingWebStoreResult.message.contains('Missing WebStoreId'),
            'Missing web store failure should explain the persisted context requirement.');
        System.assertEquals(false, missingAccountResult.success, 'Missing account context must be blocked.');
        System.assert(missingAccountResult.message.contains('Missing persisted account context'),
            'Missing account failure should explain the account requirement.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_fails_when_guest_email_or_admin_session_is_missing() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext guestContext =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        guestContext.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        guestContext.webStoreId = (Id) '0ZEam000004dJDNGA2';
        guestContext.effectiveAccountId = (Id) '001Wj000017nncaIAA';
        guestContext.guestEmailAddress = 'guest@example.com';

        AuthenticatedBuyerAdminRecoveryService.CheckoutContext noSessionContext =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        noSessionContext.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        noSessionContext.webStoreId = (Id) '0ZEam000004dJDNGA2';
        noSessionContext.effectiveAccountId = (Id) '001Wj000017nncaIAA';

        Test.startTest();

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(guestContext);
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult guestResult =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                guestContext.checkoutSessionId,
                'test-session'
            );

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(noSessionContext);
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult noSessionResult =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                noSessionContext.checkoutSessionId,
                null
            );

        Test.stopTest();

        System.assertEquals(false, guestResult.success, 'Guest email presence should block authenticated recovery.');
        System.assert(guestResult.message.contains('Guest checkout context is excluded'),
            'Guest failure should explain why the path is excluded.');
        System.assertEquals(false, noSessionResult.success, 'Admin session auth is required.');
        System.assert(noSessionResult.message.contains('Admin session auth is unavailable'),
            'Missing session failure should explain the authenticated admin requirement.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_returns_existing_order_without_callout_when_order_already_persisted() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017nncaIAA';
        context.existingOrderId = (Id) '801Wj0000000001IAA';

        FakeOrderLocator locator = new FakeOrderLocator();
        AuthenticatedBuyerAdminRecoveryService.OrderLookupResult orderLookup =
            new AuthenticatedBuyerAdminRecoveryService.OrderLookupResult();
        orderLookup.orderId = context.existingOrderId;
        orderLookup.accountId = context.effectiveAccountId;
        orderLookup.orderReferenceNumber = 'REF-EXISTING';
        locator.byId.put(orderLookup.orderId, orderLookup);

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
        AuthenticatedBuyerAdminRecoveryService.existingOrderLocator = locator;

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Existing order should be treated as an idempotent recovery success.');
        System.assertEquals(true, result.duplicateDetected, 'Existing order should short-circuit duplicate creation.');
        System.assertEquals(orderLookup.orderId, result.orderId, 'Existing order id should be surfaced.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_duplicate_guard_uses_checkout_order_reference_before_post() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017nncaIAA';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"checkoutId":"2z9Wj000000hRD3IAM","cartSummary":{"accountId":"001Wj000017nncaIAA"},"orderReferenceNumber":"REF-123"}'
        ));

        FakeOrderLocator locator = new FakeOrderLocator();
        AuthenticatedBuyerAdminRecoveryService.OrderLookupResult existingOrder =
            new AuthenticatedBuyerAdminRecoveryService.OrderLookupResult();
        existingOrder.orderId = (Id) '801Wj0000000002IAA';
        existingOrder.accountId = context.effectiveAccountId;
        existingOrder.orderReferenceNumber = 'REF-123';
        locator.byReference.put(existingOrder.orderReferenceNumber, existingOrder);

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
        AuthenticatedBuyerAdminRecoveryService.existingOrderLocator = locator;
        AuthenticatedBuyerAdminRecoveryService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Existing order by reference should be idempotent success.');
        System.assertEquals(true, result.duplicateDetected, 'Existing order reference must block a second POST.');
        System.assertEquals(1, transport.requests.size(), 'Only the GET preflight should run when duplicate is detected.');
        System.assertEquals('GET', transport.requests[0].getMethod(), 'First request must inspect checkout state.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_success_posts_documented_endpoint_for_authenticated_buyer() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017nncaIAA';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"checkoutId":"2z9Wj000000hRD3IAM","cartSummary":{"accountId":"001Wj000017nncaIAA"},"orderReferenceNumber":"REF-456"}'
        ));
        transport.responses.add(makeResponse(
            200,
            '{"orderId":"801Wj0000000003IAA","orderReferenceNumber":"REF-456"}'
        ));

        FakeOrderLocator locator = new FakeOrderLocator();
        AuthenticatedBuyerAdminRecoveryService.OrderLookupResult recoveredOrder =
            new AuthenticatedBuyerAdminRecoveryService.OrderLookupResult();
        recoveredOrder.orderId = (Id) '801Wj0000000003IAA';
        recoveredOrder.accountId = context.effectiveAccountId;
        recoveredOrder.orderReferenceNumber = 'REF-456';
        locator.byId.put(recoveredOrder.orderId, recoveredOrder);

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
        AuthenticatedBuyerAdminRecoveryService.existingOrderLocator = locator;
        AuthenticatedBuyerAdminRecoveryService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Authenticated recovery should succeed when preflight and POST succeed.');
        System.assertEquals(false, result.duplicateDetected, 'Fresh successful recovery should not be marked duplicate.');
        System.assertEquals(2, transport.requests.size(), 'Recovery must issue GET preflight then POST place-order.');
        System.assertEquals('GET', transport.requests[0].getMethod(), 'First request should inspect checkout.');
        System.assertEquals('POST', transport.requests[1].getMethod(), 'Second request should place order.');
        System.assert(transport.requests[1].getEndpoint().contains('/commerce/webstores/0ZEam000004dJDNGA2/checkouts/2z9Wj000000hRD3IAM/orders'),
            'POST must target the documented checkout orders endpoint.');
        System.assert(transport.requests[1].getEndpoint().contains('effectiveAccountId=001Wj000017nncaIAA'),
            'effectiveAccountId must come from persisted account linkage.');
        System.assertEquals(recoveredOrder.orderId, result.orderId, 'Result should surface the recovered order id.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_fails_when_checkout_fetch_reports_error() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017nncaIAA';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            400,
            '[{"message":"Checkout preflight failed"}]'
        ));

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
        AuthenticatedBuyerAdminRecoveryService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(false, result.success, 'A failed checkout preflight must fail recovery.');
        System.assert(String.isNotBlank(result.message),
            'The surfaced message should not be blank when the Commerce preflight fails.');
        System.assertEquals(1, transport.requests.size(), 'Only the GET preflight should be attempted on fetch failure.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_fails_when_checkout_account_mismatches_persisted_account() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017nncaIAA';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"checkoutId":"2z9Wj000000hRD3IAM","cartSummary":{"accountId":"001Wj000017nncbIAA"},"orderReferenceNumber":"REF-MISMATCH"}'
        ));

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
        AuthenticatedBuyerAdminRecoveryService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(false, result.success, 'Account mismatches must block admin recovery.');
        System.assert(result.message.contains('does not match'),
            'Mismatch failure should explain the persisted vs checkout account conflict.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_success_resolves_order_by_reference_when_post_omits_order_id() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017nncaIAA';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"checkoutId":"2z9Wj000000hRD3IAM","cartSummary":{"accountId":"001Wj000017nncaIAA"},"orderReferenceNumber":"REF-789"}'
        ));
        transport.responses.add(makeResponse(
            200,
            '{"orderReferenceNumber":"REF-789"}'
        ));

        FakeOrderLocator locator = new FakeOrderLocator();
        AuthenticatedBuyerAdminRecoveryService.OrderLookupResult recoveredOrder =
            new AuthenticatedBuyerAdminRecoveryService.OrderLookupResult();
        recoveredOrder.orderId = (Id) '801Wj0000000004IAA';
        recoveredOrder.accountId = context.effectiveAccountId;
        recoveredOrder.orderReferenceNumber = 'REF-789';
        locator.byReference.put(recoveredOrder.orderReferenceNumber, recoveredOrder);

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
        AuthenticatedBuyerAdminRecoveryService.existingOrderLocator = locator;
        AuthenticatedBuyerAdminRecoveryService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(true, result.success, 'Reference-only POST responses should still resolve the order.');
        System.assertEquals(recoveredOrder.orderId, result.orderId,
            'Order lookup by reference should enrich the returned result.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_fails_when_place_order_reports_error() {
        AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
            new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
        context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
        context.webStoreId = (Id) '0ZEam000004dJDNGA2';
        context.effectiveAccountId = (Id) '001Wj000017nncaIAA';

        FakeTransport transport = new FakeTransport();
        transport.responses.add(makeResponse(
            200,
            '{"checkoutId":"2z9Wj000000hRD3IAM","cartSummary":{"accountId":"001Wj000017nncaIAA"},"orderReferenceNumber":"REF-POST-FAIL"}'
        ));
        transport.responses.add(makeResponse(
            400,
            '{"message":"Place order failed"}'
        ));

        AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
        AuthenticatedBuyerAdminRecoveryService.httpTransport = transport;

        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                context.checkoutSessionId,
                'test-session'
            );
        Test.stopTest();

        System.assertEquals(false, result.success, 'A failed place-order POST must fail recovery.');
        System.assertEquals(2, transport.requests.size(), 'Recovery should attempt GET then POST before surfacing the failure.');

                    AuthenticatedBuyerAdminRecoveryService.resetTestState();
                }

                @IsTest
                static void test_fails_when_place_order_returns_nested_commerce_errors() {
                    AuthenticatedBuyerAdminRecoveryService.CheckoutContext context =
                        new AuthenticatedBuyerAdminRecoveryService.CheckoutContext();
                    context.checkoutSessionId = (Id) '2z9Wj000000hRD3IAM';
                    context.webStoreId = (Id) '0ZEam000004dJDNGA2';
                    context.effectiveAccountId = (Id) '001Wj000017nncaIAA';

                    FakeTransport transport = new FakeTransport();
                    transport.responses.add(makeResponse(
                        200,
                        '{"checkoutId":"2z9Wj000000hRD3IAM","cartSummary":{"accountId":"001Wj000017nncaIAA"},"orderReferenceNumber":"REF-POST-FAIL"}'
                    ));
                    transport.responses.add(makeResponse(
                        400,
                        '{"errors":[{"detail":"The Cart Delivery Group &#39;0a7Wj000000j5OXIAY&#39; does not have any associated Delivery Method.","title":"We are unable to place the order. Please correct the error and try again.","type":"/commerce/checkout/placeorder/shipping"}]}'
                    ));

                    AuthenticatedBuyerAdminRecoveryService.contextProvider = new FakeContextProvider(context);
                    AuthenticatedBuyerAdminRecoveryService.httpTransport = transport;

                    Test.startTest();
                    AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
                        AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                            context.checkoutSessionId,
                            'test-session'
                        );
                    Test.stopTest();

                    System.assertEquals(false, result.success, 'Nested Commerce API errors must fail recovery.');
                    System.assert(result.message.contains('Delivery Method'),
                        'Nested Commerce errors should surface the specific delivery-method failure detail.');

        AuthenticatedBuyerAdminRecoveryService.resetTestState();
    }

    @IsTest
    static void test_string_overload_returns_failure_for_invalid_id_input() {
        Test.startTest();
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
            AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout('not-a-salesforce-id');
        Test.stopTest();

        System.assertEquals(false, result.success, 'Invalid id input should fail gracefully.');
        System.assert(String.isNotBlank(result.message), 'The failure should surface a message to callers.');
    }

    private static HttpResponse makeResponse(Integer statusCode, String body) {
        HttpResponse response = new HttpResponse();
        response.setStatusCode(statusCode);
        response.setBody(body);
        return response;
    }
}