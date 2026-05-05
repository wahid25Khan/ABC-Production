public with sharing class AuthenticatedBuyerAdminRecoveryService {
    private static final String API_VERSION = 'v66.0';

    public class RecoveryResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public Boolean duplicateDetected;
        @AuraEnabled public String message;
        @AuraEnabled public Id checkoutSessionId;
        @AuraEnabled public Id effectiveAccountId;
        @AuraEnabled public Id orderId;
        @AuraEnabled public String orderReferenceNumber;
    }

    public class OrderLookupResult {
        public Id orderId;
        public Id accountId;
        public String orderReferenceNumber;
    }

    public class CheckoutContext {
        public Id checkoutSessionId;
        public Id webStoreId;
        public Id effectiveAccountId;
        public Id existingOrderId;
        public String persistedOrderReferenceNumber;
        public String guestEmailAddress;
        public String state;
    }

    private class CheckoutSnapshot {
        Id checkoutId;
        Id accountId;
        String orderReferenceNumber;
    }

    private class RecoveryException extends Exception {}

    public interface CheckoutContextProvider {
        CheckoutContext load(Id checkoutSessionId);
    }

    public interface ExistingOrderLocator {
        OrderLookupResult findById(Id orderId);
        OrderLookupResult findByReference(String orderReferenceNumber);
    }

    public interface HttpTransport {
        HttpResponse send(HttpRequest request);
    }

    private class DefaultCheckoutContextProvider implements CheckoutContextProvider {
        public CheckoutContext load(Id checkoutSessionId) {
            List<CartCheckoutSession> sessions = [
                SELECT Id, State, OrderId, OrderReferenceNumber,
                    WebCart.WebStoreId, WebCart.AccountId, WebCart.GuestEmailAddress
                FROM CartCheckoutSession
                WHERE Id = :checkoutSessionId
                LIMIT 1
            ];

            if (sessions.isEmpty()) {
                return null;
            }

            CartCheckoutSession sessionRecord = sessions[0];
            CheckoutContext context = new CheckoutContext();
            context.checkoutSessionId = sessionRecord.Id;
            context.state = sessionRecord.State;
            context.existingOrderId = sessionRecord.OrderId;
            context.persistedOrderReferenceNumber = sessionRecord.OrderReferenceNumber;
            context.webStoreId = sessionRecord.WebCart != null ? sessionRecord.WebCart.WebStoreId : null;
            context.effectiveAccountId = sessionRecord.WebCart != null ? sessionRecord.WebCart.AccountId : null;
            context.guestEmailAddress = sessionRecord.WebCart != null ? sessionRecord.WebCart.GuestEmailAddress : null;
            return context;
        }
    }

    private class DefaultExistingOrderLocator implements ExistingOrderLocator {
        public OrderLookupResult findById(Id orderId) {
            if (orderId == null) {
                return null;
            }

            List<Order> orders = [
                SELECT Id, AccountId, OrderReferenceNumber
                FROM Order
                WHERE Id = :orderId
                LIMIT 1
            ];
            return orders.isEmpty() ? null : toLookup(orders[0]);
        }

        public OrderLookupResult findByReference(String orderReferenceNumber) {
            if (String.isBlank(orderReferenceNumber)) {
                return null;
            }

            List<Order> orders = [
                SELECT Id, AccountId, OrderReferenceNumber
                FROM Order
                WHERE OrderReferenceNumber = :orderReferenceNumber
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];
            return orders.isEmpty() ? null : toLookup(orders[0]);
        }

        private OrderLookupResult toLookup(Order orderRecord) {
            OrderLookupResult lookup = new OrderLookupResult();
            lookup.orderId = orderRecord.Id;
            lookup.accountId = orderRecord.AccountId;
            lookup.orderReferenceNumber = orderRecord.OrderReferenceNumber;
            return lookup;
        }
    }

    private class DefaultHttpTransport implements HttpTransport {
        public HttpResponse send(HttpRequest request) {
            return new Http().send(request);
        }
    }

    @TestVisible private static CheckoutContextProvider contextProvider = new DefaultCheckoutContextProvider();
    @TestVisible private static ExistingOrderLocator existingOrderLocator = new DefaultExistingOrderLocator();
    @TestVisible private static HttpTransport httpTransport = new DefaultHttpTransport();

    @AuraEnabled
    public static RecoveryResult recoverAuthenticatedBuyerCheckout(String checkoutSessionId) {
        try {
            return recoverAuthenticatedBuyerCheckout((Id) checkoutSessionId, UserInfo.getSessionId());
        } catch (Exception ex) {
            return fail(null, null, ex.getMessage());
        }
    }

    @TestVisible
    private static RecoveryResult recoverAuthenticatedBuyerCheckout(Id checkoutSessionId, String adminSessionId) {
        CheckoutContext context = contextProvider.load(checkoutSessionId);
        if (context == null) {
            return fail(checkoutSessionId, null, 'No CartCheckoutSession was found for the requested recovery target.');
        }

        if (context.existingOrderId != null) {
            OrderLookupResult existingOrder = existingOrderLocator.findById(context.existingOrderId);
            return duplicate(context, existingOrder, 'Order already exists for this checkout session.');
        }

        if (context.webStoreId == null) {
            return fail(context.checkoutSessionId, context.effectiveAccountId, 'Missing WebStoreId on the persisted checkout/cart context.');
        }

        if (context.effectiveAccountId == null) {
            return fail(context.checkoutSessionId, null, 'Missing persisted account context on the checkout cart.');
        }

        if (context.effectiveAccountId.getSObjectType() != Account.SObjectType) {
            return fail(
                context.checkoutSessionId,
                context.effectiveAccountId,
                'Guest or non-account buyer contexts are excluded from authenticated admin recovery.'
            );
        }

        if (String.isNotBlank(context.guestEmailAddress)) {
            return fail(
                context.checkoutSessionId,
                context.effectiveAccountId,
                'Guest checkout context is excluded from this authenticated buyer recovery path.'
            );
        }

        if (String.isBlank(adminSessionId)) {
            return fail(
                context.checkoutSessionId,
                context.effectiveAccountId,
                'Admin session auth is unavailable. Run recovery under an authenticated admin context.'
            );
        }

        CheckoutSnapshot snapshot;
        try {
            snapshot = fetchCheckoutSnapshot(context, adminSessionId);
        } catch (Exception ex) {
            return fail(context.checkoutSessionId, context.effectiveAccountId, ex.getMessage());
        }

        if (snapshot.accountId != null && snapshot.accountId != context.effectiveAccountId) {
            return fail(
                context.checkoutSessionId,
                context.effectiveAccountId,
                'Persisted cart account context does not match the checkout account context.'
            );
        }

        String effectiveOrderReference = firstNonBlank(
            context.persistedOrderReferenceNumber,
            snapshot.orderReferenceNumber
        );
        if (String.isNotBlank(effectiveOrderReference)) {
            OrderLookupResult existingOrderByReference = existingOrderLocator.findByReference(effectiveOrderReference);
            if (existingOrderByReference != null) {
                return duplicate(context, existingOrderByReference,
                    'Order already exists for the checkout order reference.');
            }
        }

        try {
            OrderLookupResult placedOrder = placeOrder(context, adminSessionId);
            RecoveryResult success = new RecoveryResult();
            success.success = true;
            success.duplicateDetected = false;
            success.message = 'Authenticated buyer recovery invoked the documented checkout orders endpoint successfully.';
            success.checkoutSessionId = context.checkoutSessionId;
            success.effectiveAccountId = context.effectiveAccountId;
            success.orderId = placedOrder != null ? placedOrder.orderId : null;
            success.orderReferenceNumber = placedOrder != null
                ? placedOrder.orderReferenceNumber
                : effectiveOrderReference;
            return success;
        } catch (Exception ex) {
            return fail(context.checkoutSessionId, context.effectiveAccountId, ex.getMessage());
        }
    }

    private static CheckoutSnapshot fetchCheckoutSnapshot(CheckoutContext context, String adminSessionId) {
        HttpRequest request = buildRequest(
            'GET',
            buildCheckoutEndpoint(context.webStoreId, context.checkoutSessionId, context.effectiveAccountId),
            adminSessionId
        );
        Map<String, Object> payload = sendJson(request, 'Unable to fetch checkout state for admin recovery.');

        CheckoutSnapshot snapshot = new CheckoutSnapshot();
        snapshot.checkoutId = safeId(stringValue(payload.get('checkoutId')));
        snapshot.orderReferenceNumber = stringValue(payload.get('orderReferenceNumber'));

        Map<String, Object> cartSummary = asMap(payload.get('cartSummary'));
        snapshot.accountId = safeId(stringValue(cartSummary.get('accountId')));
        return snapshot;
    }

    private static OrderLookupResult placeOrder(CheckoutContext context, String adminSessionId) {
        HttpRequest request = buildRequest(
            'POST',
            buildOrdersEndpoint(context.webStoreId, context.checkoutSessionId, context.effectiveAccountId),
            adminSessionId
        );
        Map<String, Object> payload = sendJson(request, 'Authenticated buyer recovery failed while placing the order.');

        OrderLookupResult lookup = new OrderLookupResult();
        lookup.orderId = safeId(stringValue(payload.get('orderId')));
        lookup.orderReferenceNumber = stringValue(payload.get('orderReferenceNumber'));

        if (lookup.orderId != null) {
            OrderLookupResult existing = existingOrderLocator.findById(lookup.orderId);
            return existing != null ? existing : lookup;
        }

        if (String.isNotBlank(lookup.orderReferenceNumber)) {
            OrderLookupResult existingByReference = existingOrderLocator.findByReference(lookup.orderReferenceNumber);
            return existingByReference != null ? existingByReference : lookup;
        }

        return lookup;
    }

    private static HttpRequest buildRequest(String method, String endpoint, String adminSessionId) {
        HttpRequest request = new HttpRequest();
        request.setEndpoint(endpoint);
        request.setMethod(method);
        request.setTimeout(20000);
        request.setHeader('Accept', 'application/json');
        request.setHeader('Authorization', 'Bearer ' + adminSessionId);
        return request;
    }

    private static String buildCheckoutEndpoint(Id webStoreId, Id checkoutSessionId, Id effectiveAccountId) {
        return URL.getOrgDomainUrl().toExternalForm()
            + '/services/data/' + API_VERSION
            + '/commerce/webstores/' + String.valueOf(webStoreId)
            + '/checkouts/' + String.valueOf(checkoutSessionId)
            + '?effectiveAccountId=' + EncodingUtil.urlEncode(String.valueOf(effectiveAccountId), 'UTF-8');
    }

    private static String buildOrdersEndpoint(Id webStoreId, Id checkoutSessionId, Id effectiveAccountId) {
        return URL.getOrgDomainUrl().toExternalForm()
            + '/services/data/' + API_VERSION
            + '/commerce/webstores/' + String.valueOf(webStoreId)
            + '/checkouts/' + String.valueOf(checkoutSessionId)
            + '/orders?effectiveAccountId=' + EncodingUtil.urlEncode(String.valueOf(effectiveAccountId), 'UTF-8');
    }

    private static Map<String, Object> sendJson(HttpRequest request, String defaultMessage) {
        HttpResponse response = httpTransport.send(request);
        String body = response != null ? response.getBody() : null;
        if (response == null) {
            throw new RecoveryException(defaultMessage);
        }

        if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
            throw new RecoveryException(resolveErrorMessage(body, defaultMessage));
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
                        return message;
                    }
                }
            }

            Map<String, Object> payload = asMap(parsed);
            String nestedErrorMessage = extractNestedErrorMessage(payload);
            if (String.isNotBlank(nestedErrorMessage)) {
                return nestedErrorMessage;
            }

            String payloadMessage = stringValue(payload.get('message'));
            if (String.isNotBlank(payloadMessage)) {
                return decodeHtmlEntities(payloadMessage);
            }
        } catch (Exception ex) {
            // fall through to default
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
        String detail = stringValue(firstError.get('detail'));
        if (String.isNotBlank(detail)) {
            return decodeHtmlEntities(detail);
        }

        String title = stringValue(firstError.get('title'));
        if (String.isNotBlank(title)) {
            return decodeHtmlEntities(title);
        }

        String message = stringValue(firstError.get('message'));
        if (String.isNotBlank(message)) {
            return decodeHtmlEntities(message);
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

    private static String firstNonBlank(String primaryValue, String fallbackValue) {
        return String.isNotBlank(primaryValue) ? primaryValue : fallbackValue;
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

    private static RecoveryResult fail(Id checkoutSessionId, Id effectiveAccountId, String message) {
        RecoveryResult result = new RecoveryResult();
        result.success = false;
        result.duplicateDetected = false;
        result.checkoutSessionId = checkoutSessionId;
        result.effectiveAccountId = effectiveAccountId;
        result.message = message;
        return result;
    }

    private static RecoveryResult duplicate(CheckoutContext context, OrderLookupResult existingOrder, String message) {
        RecoveryResult result = new RecoveryResult();
        result.success = true;
        result.duplicateDetected = true;
        result.checkoutSessionId = context != null ? context.checkoutSessionId : null;
        result.effectiveAccountId = context != null ? context.effectiveAccountId : null;
        result.orderId = existingOrder != null ? existingOrder.orderId : null;
        result.orderReferenceNumber = existingOrder != null ? existingOrder.orderReferenceNumber : null;
        result.message = message;
        return result;
    }

    @TestVisible
    private static void resetTestState() {
        contextProvider = new DefaultCheckoutContextProvider();
        existingOrderLocator = new DefaultExistingOrderLocator();
        httpTransport = new DefaultHttpTransport();
    }
}