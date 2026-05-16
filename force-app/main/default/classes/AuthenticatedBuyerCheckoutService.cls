public without sharing class AuthenticatedBuyerCheckoutService {
    private static final String API_VERSION = 'v66.0';

    public class CheckoutStartResult {
        @AuraEnabled public Id checkoutId;
        @AuraEnabled public Id cartCheckoutSessionId;
    }

    public class PlaceOrderResult {
        @AuraEnabled public Id orderId;
        @AuraEnabled public String orderReferenceNumber;
        @AuraEnabled public Id orderSummaryId;
    }

    public class CartContext {
        public Id cartId;
        public Id webStoreId;
        public Id effectiveAccountId;
        public String guestEmailAddress;
        public Id existingCheckoutSessionId;
    }

    public class CheckoutContext {
        public Id checkoutSessionId;
        public Id webStoreId;
        public Id effectiveAccountId;
        public String guestEmailAddress;
    }

    private class CheckoutException extends Exception {}

    public interface CartContextProvider {
        CartContext load(Id cartId);
    }

    public interface CheckoutContextProvider {
        CheckoutContext load(Id checkoutSessionId);
    }

    public interface HttpTransport {
        HttpResponse send(HttpRequest request);
    }

    private class DefaultCartContextProvider implements CartContextProvider {
        public CartContext load(Id cartId) {
            List<WebCart> carts = [SELECT Id, WebStoreId, AccountId, GuestEmailAddress FROM WebCart WHERE Id = :cartId LIMIT 1];
            if (carts.isEmpty()) return null;
            WebCart cartRecord = carts[0];
            CartContext context = new CartContext();
            context.cartId = cartRecord.Id; context.webStoreId = cartRecord.WebStoreId; context.effectiveAccountId = cartRecord.AccountId;
            context.guestEmailAddress = cartRecord.GuestEmailAddress; context.existingCheckoutSessionId = loadExistingCheckoutSessionId(cartRecord.Id);
            return context;
        }

        private Id loadExistingCheckoutSessionId(Id cartId) {
            List<CartCheckoutSession> sessions = [SELECT Id FROM CartCheckoutSession WHERE WebCartId = :cartId AND OrderId = null ORDER BY CreatedDate DESC LIMIT 1];
            return sessions.isEmpty() ? null : sessions[0].Id;
        }
    }

    private class DefaultCheckoutContextProvider implements CheckoutContextProvider {
        public CheckoutContext load(Id checkoutSessionId) {
            List<CartCheckoutSession> sessions = [SELECT Id, WebCart.WebStoreId, WebCart.AccountId, WebCart.GuestEmailAddress FROM CartCheckoutSession WHERE Id = :checkoutSessionId LIMIT 1];
            if (sessions.isEmpty()) return null;
            CartCheckoutSession sessionRecord = sessions[0];
            CheckoutContext context = new CheckoutContext();
            context.checkoutSessionId = sessionRecord.Id;
            context.webStoreId = sessionRecord.WebCart != null ? sessionRecord.WebCart.WebStoreId : null; context.effectiveAccountId = sessionRecord.WebCart != null ? sessionRecord.WebCart.AccountId : null;
            context.guestEmailAddress = sessionRecord.WebCart != null ? sessionRecord.WebCart.GuestEmailAddress : null;
            return context;
        }
    }

    private class DefaultHttpTransport implements HttpTransport {
        public HttpResponse send(HttpRequest request) { return new Http().send(request); }
    }

    @TestVisible private static CartContextProvider cartContextProvider = new DefaultCartContextProvider();
    @TestVisible private static CheckoutContextProvider checkoutContextProvider = new DefaultCheckoutContextProvider();
    @TestVisible private static HttpTransport httpTransport = new DefaultHttpTransport();
    @TestVisible private static Id testCurrentCartId;

    @AuraEnabled
    public static CheckoutStartResult ensureCheckoutSession(String webStoreId, String cartId) {
        String currentSessionId = null;
        try { currentSessionId = UserInfo.getSessionId(); } catch (Exception ex) { System.debug(LoggingLevel.ERROR, 'ABC ensureCheckoutSession session lookup failed: ' + ex.getMessage()); }
        Id resolvedWebStoreId = safeId(webStoreId);
        Id resolvedCartId = safeId(cartId);
        if (resolvedCartId == null && String.valueOf(cartId).trim().toLowerCase() == 'current') {
            resolvedCartId = resolveCurrentCartId(resolvedWebStoreId);
        }
        System.debug(LoggingLevel.ERROR,
            'ABC ensureCheckoutSession rawWebStoreId=' + webStoreId +
            ', rawCartId=' + cartId +
            ', resolvedWebStoreId=' + resolvedWebStoreId +
            ', resolvedCartId=' + resolvedCartId +
            ', sessionBlank=' + String.isBlank(currentSessionId)
        );
        return ensureCheckoutSession(resolvedWebStoreId, resolvedCartId, currentSessionId);
    }

    /**
     * Polls CartCheckoutSession.OrderId to see if an order has been placed (either by the LWC
     * primary path or by the AuthorizeNetCheckoutFinalizer async trigger path).
     * Returns a PlaceOrderResult if the order exists, null if not yet placed.
     */
    @AuraEnabled
    public static PlaceOrderResult getPlacedOrderDetails(String checkoutSessionId) {
        Id resolvedId = safeId(checkoutSessionId);
        if (resolvedId == null) return null;

        List<CartCheckoutSession> sessions = [
            SELECT OrderId FROM CartCheckoutSession WHERE Id = :resolvedId LIMIT 1
        ];
        if (sessions.isEmpty() || sessions[0].OrderId == null) return null;

        Id orderId = sessions[0].OrderId;

        String orderRefNumber = null;
        List<Order> orders = [SELECT OrderNumber FROM Order WHERE Id = :orderId LIMIT 1];
        if (!orders.isEmpty()) {
            orderRefNumber = orders[0].OrderNumber;
        }

        Id orderSummaryId = null;
        List<OrderSummary> summaries = [SELECT Id FROM OrderSummary WHERE OriginalOrderId = :orderId LIMIT 1];
        if (!summaries.isEmpty()) {
            orderSummaryId = summaries[0].Id;
        }

        PlaceOrderResult result = new PlaceOrderResult();
        result.orderId = orderId;
        result.orderReferenceNumber = orderRefNumber;
        result.orderSummaryId = orderSummaryId;
        return result;
    }

    @AuraEnabled
    public static PlaceOrderResult placeOrder(String checkoutSessionId) {
        String currentSessionId = null;
        try { currentSessionId = UserInfo.getSessionId(); } catch (Exception ex) { System.debug(LoggingLevel.ERROR, 'ABC placeOrder session lookup failed: ' + ex.getMessage()); }
        return placeOrder(safeId(checkoutSessionId), currentSessionId);
    }

    /**
     * Returns the most recent authorized Authorize.Net transaction ID for the given
     * invoice/reference id (cart id), if available. Used as a fallback when Accept Hosted
     * iframe redirect completes without a transactResponse payload.
     */
    @AuraEnabled
    public static String findLatestAuthorizedTransactionId(String referenceId) {
        if (String.isBlank(referenceId)) {
            return null;
        }

        List<AuthorizeNet_Transaction__c> rows = [
            SELECT TransactionId__c, ResponseCode__c, EventType__c, CreatedDate
            FROM AuthorizeNet_Transaction__c
            WHERE InvoiceNumber__c = :referenceId
              AND TransactionId__c != null
            ORDER BY CreatedDate DESC
            LIMIT 20
        ];

        for (AuthorizeNet_Transaction__c row : rows) {
            // Prefer an explicit approved response code when present.
            if (row.ResponseCode__c == 1) {
                return row.TransactionId__c;
            }

            // Some webhook events may omit responseCode but still indicate a successful auth/capture.
            String eventType = row.EventType__c == null ? '' : row.EventType__c.toLowerCase();
            if ((eventType.contains('authcapture') || eventType.contains('capture') || eventType.contains('authorized'))
                && !eventType.contains('declined')
                && !eventType.contains('failed')) {
                return row.TransactionId__c;
            }
        }

        return null;
    }

    /**
     * Best-effort: register an external (Authorize.Net) payment on the Commerce checkout
     * session so the downstream placeOrder call finds the session in a payment-ready state.
     *
     * This is intentionally non-throwing on Commerce API errors — if payment registration
     * is not required by the store's configuration, the caller should proceed to placeOrder
     * regardless.  The caller is responsible for wrapping this in a try/catch and deciding
     * whether a failure is fatal.
     *
     * @param webStoreId         The B2B Commerce web store ID.
     * @param checkoutSessionId  The active CartCheckoutSession ID.
     * @param amount             The authorised/captured transaction amount.
     * @param transactionId      The Authorize.Net transaction ID (transId), used as the
     *                           PostAuth payment token when available.
     */
    @AuraEnabled
    public static void registerExternalPayment(
        String webStoreId,
        String checkoutSessionId,
        Decimal amount,
        String transactionId
    ) {
        String currentSessionId = null;
        try { currentSessionId = UserInfo.getSessionId(); } catch (Exception ex) {
            System.debug(LoggingLevel.ERROR, 'ABC registerExternalPayment session lookup failed: ' + ex.getMessage());
        }

        Id resolvedWebStoreId  = safeId(webStoreId);
        Id resolvedCheckoutId  = safeId(checkoutSessionId);
        if (resolvedWebStoreId == null || resolvedCheckoutId == null) {
            throw new AuraHandledException('webStoreId and checkoutSessionId are required to register external payment.');
        }
        if (String.isBlank(currentSessionId)) {
            throw new AuraHandledException('Authenticated session is unavailable. Please sign in again.');
        }

        CheckoutContext context = checkoutContextProvider.load(resolvedCheckoutId);
        if (context == null || context.effectiveAccountId == null) {
            throw new AuraHandledException('Could not load checkout context for payment registration.');
        }

        // Client-side payment registration requires a gateway token / transaction reference.
        // If the hosted payment response didn't include one, skip the API call entirely.
        if (String.isBlank(transactionId)) {
            System.debug(LoggingLevel.WARN,
                'ABC registerExternalPayment skipped because transactionId was blank.');
            return;
        }

        String paymentsEndpoint = URL.getOrgDomainUrl().toExternalForm()
            + '/services/data/' + API_VERSION
            + '/commerce/webstores/' + String.valueOf(resolvedWebStoreId)
            + '/checkouts/' + String.valueOf(resolvedCheckoutId)
            + '/payments?effectiveAccountId=' + EncodingUtil.urlEncode(String.valueOf(context.effectiveAccountId), 'UTF-8');

        // The Checkout Payments API expects a PostAuth request type for client-side gateway
        // transactions. We use the Authorize.Net transaction id as the payment token.
        // Only the fields documented by Commerce Payments API are included — additionalData
        // is not a valid field and causes a 400 "Unrecognized field" error.
        Map<String, Object> paymentBody = new Map<String, Object>{
            'requestType' => 'PostAuth',
            'paymentToken' => transactionId,
            'paymentAmount' => amount
        };

        HttpRequest request = buildRequest('POST', paymentsEndpoint, currentSessionId);
        request.setHeader('Content-Type', 'application/json');
        request.setBody(JSON.serialize(paymentBody));

        HttpResponse response = httpTransport.send(request);
        Integer statusCode = response != null ? response.getStatusCode() : 0;
        System.debug(LoggingLevel.ERROR,
            'ABC registerExternalPayment transactionId=' + transactionId
            + ' amount=' + amount
            + ' status=' + statusCode
            + ' body='   + (response != null ? response.getBody() : 'null'));

        if (response == null || statusCode < 200 || statusCode >= 300) {
            // Surface as AuraHandledException so the LWC can catch it and treat it as non-fatal
            String errMsg = resolveErrorMessage(response != null ? response.getBody() : null,
                'Payment registration returned HTTP ' + statusCode);
            throw new AuraHandledException(errMsg);
        }
    }

    /**
     * Auto-select the first available delivery method on the checkout session.
     * The B2B Commerce placeOrder endpoint requires a delivery method to be
     * explicitly selected on each delivery group.  Because the custom checkout
     * does not use the standard delivery-selection step, this method inspects
     * the current checkout state and, if no method is selected, PATCHes the
     * first available one.  Must run server-side because buyer profiles do not
     * have the API Enabled permission needed for client-side fetch.
     */
    @AuraEnabled
    public static void ensureDeliveryMethod(String webStoreId, String checkoutSessionId, Decimal shippingAmount) {
        String currentSessionId = null;
        try { currentSessionId = UserInfo.getSessionId(); } catch (Exception ex) { /* noop */ }
        ensureDeliveryMethod(safeId(webStoreId), safeId(checkoutSessionId), currentSessionId, shippingAmount);
    }

    @TestVisible
    private static void ensureDeliveryMethod(Id webStoreId, Id checkoutSessionId, String sessionId, Decimal shippingAmount) {
        if (webStoreId == null || checkoutSessionId == null) {
            return; // non-fatal — placeOrder will surface the actual error
        }

        CheckoutContext context = checkoutContextProvider.load(checkoutSessionId);
        if (context == null || context.effectiveAccountId == null) {
            // No REST context — fall straight through to SOQL path
            ensureDeliveryMethodViaSoql(checkoutSessionId, shippingAmount);
            return;
        }
        if (String.isBlank(sessionId)) {
            // No buyer session token (scheduled context) — use SOQL path directly
            ensureDeliveryMethodViaSoql(checkoutSessionId, shippingAmount);
            return;
        }

        String checkoutEndpoint = buildCheckoutEndpoint(webStoreId, checkoutSessionId, context.effectiveAccountId);

        // GET current checkout state
        HttpRequest getReq = buildRequest('GET', checkoutEndpoint, sessionId);
        HttpResponse getResp = httpTransport.send(getReq);
        if (getResp == null || getResp.getStatusCode() < 200 || getResp.getStatusCode() >= 300) {
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethod GET failed: '
                + (getResp != null ? getResp.getStatusCode() + ' ' + getResp.getBody() : 'null response'));
            // REST path failed — attempt SOQL fallback
            ensureDeliveryMethodViaSoql(checkoutSessionId, shippingAmount);
            return;
        }

        Map<String, Object> state = asMap(JSON.deserializeUntyped(getResp.getBody()));
        // deliveryGroups.items is the standard shape
        Map<String, Object> deliveryGroups = asMap(state.get('deliveryGroups'));
        List<Object> items = deliveryGroups.containsKey('items') && deliveryGroups.get('items') instanceof List<Object>
            ? (List<Object>) deliveryGroups.get('items')
            : new List<Object>();

        for (Object item : items) {
            Map<String, Object> grp = asMap(item);
            String groupId = stringValue(grp.get('id'));

            // deliveryMethodId from the Commerce REST response is the OrderDeliveryMethod ID
            // (e.g. Standard Shipping). We pass it to ensureDeliveryMethodForGroupLocal so it
            // can set CartDeliveryGroupMethod.DeliveryMethodId without an extra SOQL query.
            //
            // We intentionally do NOT use selectedDeliveryMethodId from the REST response to
            // set CartDeliveryGroup.SelectedDeliveryMethodId directly.  The Commerce API can
            // return an OrderDeliveryMethod ID in that field, which would cause
            // FIELD_INTEGRITY_EXCEPTION because the SObject field expects a CartDeliveryGroupMethod ID.
            // ensureDeliveryMethodForGroupLocal always resolves or creates the correct CDGM record
            // and sets the SObject field safely.
            String odmIdFromResponse = stringValue(grp.get('deliveryMethodId'));

            // Always use the DML path: ensureDeliveryMethodForGroupLocal will reuse an existing
            // CartDeliveryGroupMethod if one already exists for this group (no duplicate inserts),
            // or create a new one and set CartDeliveryGroup.SelectedDeliveryMethodId to its ID.
            // After DML we cannot make HTTP callouts ("uncommitted work pending"), and placeOrder
            // reads the SObject field directly — the REST PATCH is not needed.
            ensureDeliveryMethodForGroupLocal(safeId(groupId), shippingAmount, safeId(odmIdFromResponse));
            break; // only one delivery group is typical; DML done — stop here
        }
    }

    // SOQL/DML fallback (session-less path): used when sessionId is blank (e.g., reconciliation queue).
    // Finds the cart's delivery groups and ensures each has a CartDeliveryGroupMethod.
    // Cannot do REST PATCH in this context; relies on Commerce finding the record on next evaluation.
    @TestVisible
    private static void ensureDeliveryMethodViaSoql(Id checkoutSessionId, Decimal shippingAmount) {
        if (checkoutSessionId == null) return;

        List<CartCheckoutSession> sessions = [
            SELECT WebCartId FROM CartCheckoutSession WHERE Id = :checkoutSessionId LIMIT 1
        ];
        if (sessions.isEmpty() || sessions[0].WebCartId == null) {
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodViaSoql: no cart for session ' + checkoutSessionId);
            return;
        }
        ensureDeliveryMethodForCart(sessions[0].WebCartId, shippingAmount);
    }

    // Finds or creates a CartDeliveryGroupMethod for a single delivery group identified by its SObject Id,
    // then updates CartDeliveryGroup.SelectedDeliveryMethodId to that method via DML.
    // This method ONLY performs DML operations (no HTTP callouts) to avoid "uncommitted work" errors.
    // SelectedDeliveryMethodId is what the Commerce placeOrder endpoint reads to validate that
    // a delivery method has been chosen — the REST PATCH to selectedDeliveryMethodId in the checkout
    // resource updates Commerce's internal checkout state only, NOT this SObject field.
    // Returns the CartDeliveryGroupMethod.Id (existing or newly inserted), or null if the group is not found.
    @TestVisible
    private static String ensureDeliveryMethodForGroupLocal(Id groupId, Decimal shippingAmount) {
        return ensureDeliveryMethodForGroupLocal(groupId, shippingAmount, null);
    }

    @TestVisible
    private static String ensureDeliveryMethodForGroupLocal(Id groupId, Decimal shippingAmount, Id explicitOrderDeliveryMethodId) {
        if (groupId == null) return null;

        // Use the ODM ID supplied by the caller (e.g. from the Commerce REST GET response) when
        // available — avoids an extra SOQL query and uses the exact method Commerce expects.
        Id orderDeliveryMethodId = (explicitOrderDeliveryMethodId != null)
            ? explicitOrderDeliveryMethodId
            : resolveOrderDeliveryMethodId();

        // Reuse an existing method for this group if one already exists
        List<CartDeliveryGroupMethod> existing = [
            SELECT Id FROM CartDeliveryGroupMethod WHERE CartDeliveryGroupId = :groupId LIMIT 1
        ];
        String methodId;
        if (!existing.isEmpty()) {
            methodId = existing[0].Id;
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForGroupLocal reusing existing method='
                + methodId + ' for group=' + groupId);
        } else {
            // Get the cartId (required by CartDeliveryGroupMethod.WebCartId)
            List<CartDeliveryGroup> groups = [SELECT CartId FROM CartDeliveryGroup WHERE Id = :groupId LIMIT 1];
            if (groups.isEmpty()) return null;
            Id cartId = groups[0].CartId;

            Decimal amount = (shippingAmount != null && shippingAmount >= 0) ? shippingAmount : 0;
            CartDeliveryGroupMethod newMethod = new CartDeliveryGroupMethod(
                CartDeliveryGroupId = groupId,
                WebCartId = cartId,
                Name = 'ABC Standard Shipping',
                Carrier = 'ABC Shipping',
                ShippingFee = amount,
                ProductId = resolveShippingProductId(),
                DeliveryMethodId = orderDeliveryMethodId  // links CDGM to OrderDeliveryMethod
            );
            insert newMethod;
            methodId = newMethod.Id;
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForGroupLocal created CartDeliveryGroupMethod='
                + methodId + ' amount=' + amount + ' for group=' + groupId);
        }

        // Update CartDeliveryGroup.SelectedDeliveryMethodId — this is the SObject field that
        // the Commerce placeOrder endpoint validates (not the REST checkout state).
        try {
            syncSelectedDeliveryMethod(groupId, (Id) methodId);
        } catch (Exception ex) {
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForGroupLocal CDG update failed: ' + ex.getMessage());
        }

        return methodId;
    }

    // Finds or creates a CartDeliveryGroupMethod for a single delivery group identified by its SObject Id,
    // then updates CartDeliveryGroup.SelectedDeliveryMethodId to that method via DML.
    // SelectedDeliveryMethodId is what the Commerce placeOrder endpoint reads to validate that
    // a delivery method has been chosen — the REST PATCH to selectedDeliveryMethodId in the checkout
    // resource updates Commerce's internal checkout state only, NOT this SObject field.
    // Returns the CartDeliveryGroupMethod.Id (existing or newly inserted), or null if the group is not found.
    @TestVisible
    private static String ensureDeliveryMethodForGroup(Id groupId, Decimal shippingAmount) {
        if (groupId == null) return null;

        Id orderDeliveryMethodId = resolveOrderDeliveryMethodId();

        // Reuse an existing method for this group if one already exists
        List<CartDeliveryGroupMethod> existing = [
            SELECT Id FROM CartDeliveryGroupMethod WHERE CartDeliveryGroupId = :groupId LIMIT 1
        ];
        String methodId;
        if (!existing.isEmpty()) {
            methodId = existing[0].Id;
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForGroup reusing existing method='
                + methodId + ' for group=' + groupId);
        } else {
            // Get the cartId (required by CartDeliveryGroupMethod.WebCartId)
            List<CartDeliveryGroup> groups = [SELECT CartId FROM CartDeliveryGroup WHERE Id = :groupId LIMIT 1];
            if (groups.isEmpty()) return null;
            Id cartId = groups[0].CartId;

            Decimal amount = (shippingAmount != null && shippingAmount >= 0) ? shippingAmount : 0;
            CartDeliveryGroupMethod newMethod = new CartDeliveryGroupMethod(
                CartDeliveryGroupId = groupId,
                WebCartId = cartId,
                Name = 'ABC Standard Shipping',
                Carrier = 'ABC Shipping',
                ShippingFee = amount,
                ProductId = resolveShippingProductId(),
                DeliveryMethodId = orderDeliveryMethodId  // links CDGM to OrderDeliveryMethod
            );
            insert newMethod;
            methodId = newMethod.Id;
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForGroup created CartDeliveryGroupMethod='
                + methodId + ' amount=' + amount + ' for group=' + groupId);
        }

        // Update CartDeliveryGroup.SelectedDeliveryMethodId — this is the SObject field that
        // the Commerce placeOrder endpoint validates (not the REST checkout state).
        try {
            syncSelectedDeliveryMethod(groupId, (Id) methodId);
        } catch (Exception ex) {
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForGroup CDG update failed: ' + ex.getMessage());
        }

        return methodId;
    }

    // Broad fallback for all delivery groups in a cart (used by the session-less path).
    @TestVisible
    private static void ensureDeliveryMethodForCart(Id cartId, Decimal shippingAmount) {
        if (cartId == null) return;

        List<CartDeliveryGroup> groups = [
            SELECT Id FROM CartDeliveryGroup
            WHERE CartId = :cartId
        ];
        if (groups.isEmpty()) {
            System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForCart: no delivery groups for cart ' + cartId);
            return;
        }

        Id shippingProductId = resolveShippingProductId();
        Id orderDeliveryMethodId = resolveOrderDeliveryMethodId();
        Decimal amount = (shippingAmount != null && shippingAmount >= 0) ? shippingAmount : 0;

        for (CartDeliveryGroup grp : groups) {
            List<CartDeliveryGroupMethod> existingForGroup = [
                SELECT Id FROM CartDeliveryGroupMethod WHERE CartDeliveryGroupId = :grp.Id LIMIT 1
            ];
            String methodId;
            if (!existingForGroup.isEmpty()) {
                methodId = existingForGroup[0].Id;
            } else {
                CartDeliveryGroupMethod newMethod = new CartDeliveryGroupMethod(
                    CartDeliveryGroupId = grp.Id,
                    WebCartId = cartId,
                    Name = 'ABC Standard Shipping',
                    Carrier = 'ABC Shipping',
                    ShippingFee = amount,
                    ProductId = shippingProductId,
                    DeliveryMethodId = orderDeliveryMethodId
                );
                insert newMethod;
                methodId = newMethod.Id;
                System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForCart created CartDeliveryGroupMethod='
                    + methodId + ' amount=' + amount + ' for group=' + grp.Id);
            }
            // Set CartDeliveryGroup.SelectedDeliveryMethodId so placeOrder can validate the selection
            try {
                syncSelectedDeliveryMethod(grp.Id, (Id) methodId);
            } catch (Exception ex) {
                System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForCart CDG update failed for group='
                    + grp.Id + ': ' + ex.getMessage());
            }
        }
        System.debug(LoggingLevel.ERROR, 'ABC ensureDeliveryMethodForCart ensured methods for ' + groups.size() + ' delivery group(s)');
    }

    @TestVisible
    private static void syncSelectedDeliveryMethod(Id groupId, Id methodId) {
        if (groupId == null || methodId == null) {
            return;
        }

        update new CartDeliveryGroup(
            Id = groupId,
            SelectedDeliveryMethodId = methodId
        );

        System.debug(LoggingLevel.ERROR, 'ABC syncSelectedDeliveryMethod set CDG.SelectedDeliveryMethodId='
            + methodId + ' for group=' + groupId);
    }

    // Returns the ProductId used for CartDeliveryGroupMethod records in this org.
    // Prefers an ID already in use by an existing CDGM, then falls back to 'Shipping Charge Product'.
    private static Id resolveShippingProductId() {
        List<CartDeliveryGroupMethod> sample = [
            SELECT ProductId FROM CartDeliveryGroupMethod WHERE ProductId != null LIMIT 1
        ];
        if (!sample.isEmpty()) return sample[0].ProductId;

        List<Product2> products = [
            SELECT Id FROM Product2 WHERE Name = 'Shipping Charge Product' LIMIT 1
        ];
        return products.isEmpty() ? null : products[0].Id;
    }

    // Returns the OrderDeliveryMethod.Id used for CartDeliveryGroupMethod.DeliveryMethodId.
    // Resolution order:
    //   1. ID already in use by an existing CartDeliveryGroupMethod (most reliable — matches org config)
    //   2. OrderDeliveryMethod named 'Standard Shipping' (the configured shipping method for this store)
    //   3. ODM whose ProductId matches the shipping product (avoids picking unrelated carrier ODMs)
    //   4. Any active OrderDeliveryMethod (last-resort fallback)
    private static Id resolveOrderDeliveryMethodId() {
        List<CartDeliveryGroupMethod> sample = [
            SELECT DeliveryMethodId FROM CartDeliveryGroupMethod WHERE DeliveryMethodId != null LIMIT 1
        ];
        if (!sample.isEmpty()) return sample[0].DeliveryMethodId;

        // Preferred: look up by name — 'Standard Shipping' is the configured ODM for this store
        List<OrderDeliveryMethod> byName = [
            SELECT Id FROM OrderDeliveryMethod
            WHERE Name = 'Standard Shipping' AND IsActive = true
            LIMIT 1
        ];
        if (!byName.isEmpty()) return byName[0].Id;

        // Find the ODM that uses the same product as the shipping product — avoids
        // accidentally selecting a carrier-specific ODM (e.g. Fedex) that uses a different product.
        Id shippingProductId = resolveShippingProductId();
        if (shippingProductId != null) {
            List<OrderDeliveryMethod> matched = [
                SELECT Id FROM OrderDeliveryMethod
                WHERE IsActive = true AND ProductId = :shippingProductId
                LIMIT 1
            ];
            if (!matched.isEmpty()) return matched[0].Id;
        }

        List<OrderDeliveryMethod> fallback = [
            SELECT Id FROM OrderDeliveryMethod WHERE IsActive = true LIMIT 1
        ];
        return fallback.isEmpty() ? null : fallback[0].Id;
    }

    @TestVisible
    private static CheckoutStartResult ensureCheckoutSession(Id webStoreId, Id cartId, String sessionId) {
        if (cartId == null) {
            throw new AuraHandledException('Cart Id is required to start checkout.');
        }
        if (webStoreId == null) {
            throw new AuraHandledException('Web store Id is required to start checkout.');
        }

        CartContext context = cartContextProvider.load(cartId);
        System.debug(LoggingLevel.ERROR,
            'ABC ensureCheckoutSession context cartId=' + (context == null ? null : context.cartId) +
            ', webStoreId=' + (context == null ? null : context.webStoreId) +
            ', effectiveAccountId=' + (context == null ? null : context.effectiveAccountId) +
            ', existingCheckoutSessionId=' + (context == null ? null : context.existingCheckoutSessionId)
        );
        validateCartContext(context, webStoreId);

        if (context.existingCheckoutSessionId != null) {
            CheckoutStartResult existingResult = new CheckoutStartResult();
            existingResult.checkoutId = context.existingCheckoutSessionId;
            existingResult.cartCheckoutSessionId = context.existingCheckoutSessionId;
            return existingResult;
        }

        if (String.isBlank(sessionId)) {
            throw new AuraHandledException('Authenticated session is unavailable. Please sign in again.');
        }

        HttpRequest request = buildRequest(
            'PUT',
            buildCheckoutStartEndpoint(context.webStoreId, context.effectiveAccountId),
            sessionId
        );
        request.setHeader('Content-Type', 'application/json');
        request.setBody(JSON.serialize(new Map<String, Object>{ 'cartId' => context.cartId }));

        HttpResponse response = httpTransport.send(request);
        Map<String, Object> payload = parseJsonResponse(response, 'Unable to start checkout.');

        Id checkoutId =
            safeId(stringValue(payload.get('cartCheckoutSessionId')));
        if (checkoutId == null) {
            checkoutId = safeId(stringValue(payload.get('checkoutId')));
        }
        if (checkoutId == null) {
            checkoutId = extractCheckoutIdFromLocation(response != null ? response.getHeader('Location') : null);
        }
        if (checkoutId == null) {
            throw new AuraHandledException('Checkout session could not be created.');
        }

        CheckoutStartResult result = new CheckoutStartResult();
        result.checkoutId = checkoutId;
        result.cartCheckoutSessionId = checkoutId;
        return result;
    }

    @TestVisible
    private static PlaceOrderResult placeOrder(Id checkoutSessionId, String sessionId) {
        if (checkoutSessionId == null) {
            throw new AuraHandledException('Checkout session Id is required to place the order.');
        }

        CheckoutContext context = checkoutContextProvider.load(checkoutSessionId);
        validateCheckoutContext(context, sessionId);

        HttpRequest request = buildRequest(
            'POST',
            buildOrdersEndpoint(context.webStoreId, context.checkoutSessionId, context.effectiveAccountId),
            sessionId
        );
        request.setHeader('Content-Type', 'application/json');
        request.setBody('{}');

        Map<String, Object> payload = parseJsonResponse(
            httpTransport.send(request),
            'Unable to place order.'
        );

        PlaceOrderResult result = new PlaceOrderResult();
        result.orderId = safeId(stringValue(payload.get('orderId')));
        result.orderReferenceNumber = stringValue(payload.get('orderReferenceNumber'));
        result.orderSummaryId = safeId(stringValue(payload.get('orderSummaryId')));
        return result;
    }

    /**
     * Clear a shopping cart by marking it as Closed. Call this after successful order placement.
     * @param cartId The WebCart ID to clear.
     */
    @AuraEnabled
    public static void clearCart(String cartId) {
        Id resolvedCartId = safeId(cartId);
        if (resolvedCartId == null) {
            System.debug(LoggingLevel.WARN, 'ABC clearCart: cartId is invalid');
            return;
        }

        try {
            List<WebCart> carts = [SELECT Id, Status FROM WebCart WHERE Id = :resolvedCartId LIMIT 1];
            if (!carts.isEmpty()) {
                WebCart cart = carts[0];
                if (cart.Status != 'Closed') {
                    cart.Status = 'Closed';
                    update cart;
                    System.debug(LoggingLevel.ERROR, 'ABC clearCart: marked cart ' + resolvedCartId + ' as Closed');
                }
            }
        } catch (Exception ex) {
            System.debug(LoggingLevel.ERROR, 'ABC clearCart failed for cart ' + resolvedCartId + ': ' + ex.getMessage());
            throw new AuraHandledException('Could not clear cart: ' + ex.getMessage());
        }
    }

    private static void validateCartContext(CartContext context, Id webStoreId) {
        if (context == null) {
            throw new AuraHandledException('Could not load the buyer cart context.');
        }
        if (context.webStoreId == null || context.webStoreId != webStoreId) {
            throw new AuraHandledException('Cart web store context does not match the checkout store.');
        }
        if (context.effectiveAccountId == null) {
            throw new AuraHandledException('Authenticated buyer account context is required to start checkout.');
        }
        if (context.effectiveAccountId.getSObjectType() != Account.SObjectType) {
            throw new AuraHandledException('Guest or non-account buyer contexts are not supported for this checkout flow.');
        }
        if (String.isNotBlank(context.guestEmailAddress)) {
            throw new AuraHandledException('Guest checkout context is not supported for this checkout flow.');
        }
    }

    private static void validateCheckoutContext(CheckoutContext context, String sessionId) {
        if (context == null) {
            throw new AuraHandledException('Could not load the checkout session context.');
        }
        if (context.webStoreId == null) {
            throw new AuraHandledException('Checkout session is missing web store context.');
        }
        if (context.effectiveAccountId == null) {
            throw new AuraHandledException('Checkout session is missing authenticated buyer account context.');
        }
        if (context.effectiveAccountId.getSObjectType() != Account.SObjectType) {
            throw new AuraHandledException('Guest or non-account buyer contexts are not supported for this checkout flow.');
        }
        if (String.isNotBlank(context.guestEmailAddress)) {
            throw new AuraHandledException('Guest checkout context is not supported for this checkout flow.');
        }
        if (String.isBlank(sessionId)) {
            throw new AuraHandledException('Authenticated session is unavailable. Please sign in again.');
        }
    }

    private static HttpRequest buildRequest(String method, String endpoint, String sessionId) {
        HttpRequest request = new HttpRequest();
        request.setEndpoint(endpoint);
        request.setMethod(method);
        request.setTimeout(20000);
        request.setHeader('Accept', 'application/json');
        request.setHeader('Authorization', 'Bearer ' + sessionId);
        return request;
    }

    private static Id resolveCurrentCartId(Id webStoreId) {
        if (Test.isRunningTest() && testCurrentCartId != null) return testCurrentCartId;
        if (webStoreId == null) return null;
        List<User> users = [SELECT Contact.AccountId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        Id accountId = users.isEmpty() || users[0].Contact == null ? null : users[0].Contact.AccountId;
        if (accountId == null) return null;
        List<WebCart> carts = [SELECT Id FROM WebCart WHERE WebStoreId = :webStoreId AND AccountId = :accountId AND Status IN ('Active', 'Checkout') ORDER BY LastModifiedDate DESC LIMIT 1];
        return carts.isEmpty() ? null : carts[0].Id;
    }

    private static String buildCheckoutStartEndpoint(Id webStoreId, Id effectiveAccountId) {
        return URL.getOrgDomainUrl().toExternalForm()
            + '/services/data/' + API_VERSION
            + '/commerce/webstores/' + String.valueOf(webStoreId)
            + '/checkouts?effectiveAccountId=' + EncodingUtil.urlEncode(String.valueOf(effectiveAccountId), 'UTF-8');
    }

    private static String buildOrdersEndpoint(Id webStoreId, Id checkoutSessionId, Id effectiveAccountId) {
        return URL.getOrgDomainUrl().toExternalForm()
            + '/services/data/' + API_VERSION
            + '/commerce/webstores/' + String.valueOf(webStoreId)
            + '/checkouts/' + String.valueOf(checkoutSessionId)
            + '/orders?effectiveAccountId=' + EncodingUtil.urlEncode(String.valueOf(effectiveAccountId), 'UTF-8');
    }

    private static String buildCheckoutEndpoint(Id webStoreId, Id checkoutSessionId, Id effectiveAccountId) {
        return URL.getOrgDomainUrl().toExternalForm()
            + '/services/data/' + API_VERSION
            + '/commerce/webstores/' + String.valueOf(webStoreId)
            + '/checkouts/' + String.valueOf(checkoutSessionId)
            + '?effectiveAccountId=' + EncodingUtil.urlEncode(String.valueOf(effectiveAccountId), 'UTF-8');
    }

    private static Map<String, Object> parseJsonResponse(HttpResponse response, String defaultMessage) {
        if (response == null) {
            throw new AuraHandledException(defaultMessage);
        }

        String body = response.getBody();
        if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
            throw new AuraHandledException(resolveErrorMessage(body, defaultMessage));
        }

        if (String.isBlank(body)) {
            return new Map<String, Object>();
        }

        Object parsed = JSON.deserializeUntyped(body);
        return asMap(parsed);
    }

    private static String resolveErrorMessage(String body, String defaultMessage) {
        if (String.isBlank(body)) {
            return defaultMessage;
        }

        try {
            Object parsed = JSON.deserializeUntyped(body);
            if (parsed instanceof List<Object>) {
                List<Object> items = (List<Object>) parsed;
                if (!items.isEmpty()) {
                    Map<String, Object> first = asMap(items[0]);
                    String message = stringValue(first.get('message'));
                    if (String.isNotBlank(message)) {
                        return decodeHtmlEntities(message);
                    }
                }
            }

            Map<String, Object> payload = asMap(parsed);
            String nestedError = extractNestedErrorMessage(payload);
            if (String.isNotBlank(nestedError)) {
                return nestedError;
            }

            String message = stringValue(payload.get('message'));
            if (String.isNotBlank(message)) {
                return decodeHtmlEntities(message);
            }
        } catch (Exception ex) {
            // fall through
        }

        return defaultMessage;
    }

    private static String extractNestedErrorMessage(Map<String, Object> payload) {
        List<Object> errors = payload.containsKey('errors') && payload.get('errors') instanceof List<Object>
            ? (List<Object>) payload.get('errors')
            : null;
        if (errors == null || errors.isEmpty()) {
            return null;
        }

        Map<String, Object> firstError = asMap(errors[0]);
        for (String key : new List<String>{ 'detail', 'title', 'message' }) {
            String value = stringValue(firstError.get(key));
            if (String.isNotBlank(value)) {
                return decodeHtmlEntities(value);
            }
        }
        return null;
    }

    private static String decodeHtmlEntities(String message) {
        if (String.isBlank(message)) {
            return message;
        }

        return message
            .replace('&amp;', '&')
            .replace('&#39;', '\'')
            .replace('&quot;', '"')
            .replace('&lt;', '<')
            .replace('&gt;', '>');
    }

    private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<String, Object>
            ? (Map<String, Object>) value
            : new Map<String, Object>();
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Id safeId(String value) {
        if (String.isBlank(value)) {
            return null;
        }

        try {
            return (Id) value;
        } catch (Exception ex) {
            return null;
        }
    }

    private static Id extractCheckoutIdFromLocation(String locationHeader) {
        if (String.isBlank(locationHeader)) {
            return null;
        }

        Matcher match = Pattern.compile('(?i)/checkouts/([^/?#]+)').matcher(locationHeader);
        if (!match.find()) {
            return null;
        }
        return safeId(match.group(1));
    }

    @TestVisible
    private static void resetTestState() {
        cartContextProvider = new DefaultCartContextProvider();
        checkoutContextProvider = new DefaultCheckoutContextProvider();
        httpTransport = new DefaultHttpTransport();
        testCurrentCartId = null;
    }
}