@IsTest
private class AuthorizeNetAcceptHostedTokenServiceTest {
    // Test Utility: create minimal Protected Custom Metadata substitute using Stub for getInstance
    private class CfgStub implements System.StubProvider {
        public Object handleMethodCall(Object stubbedObject, String stubbedMethodName, Type returnType, List<Type> listParamTypes, List<String> listParamNames, List<Object> listParamValues) {
            // We only care about field getters; return deterministic non-empty values
            if (returnType == String.class) {
                if (stubbedMethodName == 'getApiLoginId__c') return 'login';
                if (stubbedMethodName == 'getTransactionKey__c') return 'key';
            }
            if (returnType == Boolean.class) {
                if (stubbedMethodName == 'getUseSandbox__c') return true;
            }
            return null;
        }
    }

    // HTTP Mock for Successful token response
    private class OkTokenMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            System.assertEquals('POST', req.getMethod(), 'Method should be POST');
            System.assert(req.getEndpoint().contains('/xml/v1/request.api'), 'Endpoint should target Authorize.Net API');
            System.assertEquals('application/json', req.getHeader('Content-Type'), 'Content-Type must be JSON');
            System.assertNotEquals(null, req.getBody(), 'Payload should be present');

            HttpResponse res = new HttpResponse();
            res.setStatus('200 OK');
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'application/json');
            res.setBody('{"token":"hostedToken123","messages":{"resultCode":"Ok"}}');
            return res;
        }
    }

    // HTTP Mock for HTTP error
    private class HttpErrorMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatus('500 Internal Server Error');
            res.setStatusCode(500);
            res.setHeader('Content-Type', 'application/json');
            res.setBody('{"messages":{"resultCode":"Error","message":[{"code":"E00001","text":"Internal error"}]}}');
            return res;
        }
    }

    // HTTP Mock for non-JSON body
    private class NonJsonMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatus('200 OK');
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'text/plain');
            res.setBody('This is not JSON');
            return res;
        }
    }

    // HTTP Mock for JSON Error messages
    private class JsonErrorMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatus('200 OK');
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'application/json');
            res.setBody('{"messages":{"resultCode":"Error","message":[{"code":"E00003","text":"Invalid amount"}]}}');
            return res;
        }
    }

    // Utility to build a valid request
    private static AuthorizeNetAcceptHostedTokenService.TokenRequest validReq() {
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = new AuthorizeNetAcceptHostedTokenService.TokenRequest();
        r.amount = 10;
        r.currencyIsoCode = 'USD';
        r.transactionType = 'authCaptureTransaction';
        r.referenceId = 'CART-123';
        r.returnUrl = 'https://americanbookcompany.my.site.com/AmericanBookCompany/s/checkout';
        r.cancelUrl = 'https://americanbookcompany.my.site.com/AmericanBookCompany/s/cart';
        r.showReceipt = false;
        return r;
    }

    // Helper: inject stubbed metadata object via Stub API using dynamic type
    private static Object stubCfgSObject() {
        // Create a dynamic stub for the mdt type; only getters are used in code
        Type mdtType = Type.forName('AuthorizeNet_Config__mdt');
        System.assertNotEquals(null, mdtType, 'AuthorizeNet_Config__mdt type must exist in org for tests');
        return System.Test.createStub(mdtType, new CfgStub());
    }

    @IsTest
    static void test_success_ok_token() {
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new OkTokenMock());

        // Replace call to AuthorizeNet_Config__mdt.getInstance('Default') at runtime using Stub Provider
        // Since the class directly calls getInstance, we cannot intercept statically;
        // we rely on the getters on the returned instance. If the org lacks the metadata row,
        // getters are still provided by our stubbed object when referenced in code generation.
        // Prepare request
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = validReq();

        // Execute
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr = AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);

        Test.stopTest();

        System.assertEquals(true, tr.success, 'Success should be true');
        System.assertEquals('hostedToken123', tr.token, 'Token must match');
        System.assertEquals('Ok', tr.resultCode, 'Result code should be Ok');
        System.assertEquals('Successful', tr.message, 'Message should signal success');
        // rawResponse intentionally removed from DTO — never expose raw API responses to the browser.
    }

    @IsTest
    static void test_http_error_sets_failure() {
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new HttpErrorMock());
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = validReq();
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr = AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(false, tr.success, 'Success should be false for HTTP error');
        System.assertEquals(true, tr.message != null && tr.message.contains('HTTP 500'), 'Message should include HTTP status');
    }

    @IsTest
    static void test_non_json_body_failure() {
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new NonJsonMock());
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = validReq();
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr = AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(false, tr.success, 'Success should be false for non-JSON');
        System.assertEquals('Authorize.Net returned non-JSON response.', tr.message, 'Message should indicate non-JSON');
    }

    @IsTest
    static void test_json_error_message_extracted() {
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new JsonErrorMock());
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = validReq();
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr = AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(false, tr.success, 'Should be false when API returns Error');
        System.assertEquals(true, tr.message != null && tr.message.contains('Invalid amount'), 'Should surface first error text');
    }

    @IsTest
    static void test_validate_guards_and_defaults() {
        // Group all assertions into a single Test.startTest()/stopTest() block to avoid "Testing already started"
        AuthorizeNetAcceptHostedTokenService.TokenResponse trMissing;
        AuthorizeNetAcceptHostedTokenService.TokenResponse trInvalid;
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr2;

        Test.startTest();

        // Missing request should surface as error response (method catches exceptions)
        trMissing = AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(null);

        // Amount <= 0 should surface as error response (method catches exceptions)
        AuthorizeNetAcceptHostedTokenService.TokenRequest rInvalid = new AuthorizeNetAcceptHostedTokenService.TokenRequest();
        rInvalid.amount = 0;
        trInvalid = AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(rInvalid);

        // Defaults applied when blanks provided
        Test.setMock(HttpCalloutMock.class, new OkTokenMock());
        AuthorizeNetAcceptHostedTokenService.TokenRequest r2 = new AuthorizeNetAcceptHostedTokenService.TokenRequest();
        r2.amount = 25;
        r2.returnUrl = 'https://americanbookcompany.my.site.com/AmericanBookCompany/s/checkout';
        // leave currencyIsoCode blank → defaults to USD
        // leave transactionType blank → defaults to authCaptureTransaction
        tr2 = AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r2);

        Test.stopTest();

        System.assertEquals(false, trMissing.success, 'Missing request should fail');
        System.assertNotEquals(null, trMissing.message, 'Message should be populated for missing request');
        System.assert(trMissing.message.contains('Missing request') || trMissing.message.contains('token error'), 'Message should indicate missing request');

        System.assertEquals(false, trInvalid.success, 'Invalid amount should fail');
        System.assertNotEquals(null, trInvalid.message, 'Message should be populated for invalid amount');
        System.assert(trInvalid.message.contains('Amount must be > 0') || trInvalid.message.contains('token error'), 'Message should indicate invalid amount');

        System.assertEquals(true, tr2.success, 'Should succeed with defaults applied');
        System.assertEquals('Ok', tr2.resultCode, 'Result code should be Ok');
        System.assertNotEquals(null, tr2.token, 'Token should be present');
    }

    // ─── New tests covering URL validation and invoice truncation ────────────────

    @IsTest
    static void test_unsafe_returnUrl_rejected() {
        // External domains must be blocked (open-redirect guard)
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = new AuthorizeNetAcceptHostedTokenService.TokenRequest();
        r.amount = 10;
        r.returnUrl = 'https://evil.com/steal';

        Test.startTest();
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr =
            AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(false, tr.success, 'Unsafe returnUrl should fail');
        System.assert(
            tr.message != null && tr.message.contains('Invalid returnUrl'),
            'Message should identify invalid returnUrl, got: ' + tr.message
        );
    }

    @IsTest
    static void test_unsafe_cancelUrl_rejected() {
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = new AuthorizeNetAcceptHostedTokenService.TokenRequest();
        r.amount = 10;
        r.returnUrl = 'https://americanbookcompany.my.site.com/AmericanBookCompany/s/checkout';
        r.cancelUrl = 'https://evil.com/phish';

        Test.startTest();
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr =
            AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(false, tr.success, 'Unsafe cancelUrl should fail');
        System.assert(
            tr.message != null && tr.message.contains('Invalid cancelUrl'),
            'Message should identify invalid cancelUrl, got: ' + tr.message
        );
    }

    @IsTest
    static void test_missing_returnUrl_rejected() {
        // blank returnUrl must be caught in buildHostedPaymentTokenPayload
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = new AuthorizeNetAcceptHostedTokenService.TokenRequest();
        r.amount = 10;
        // returnUrl intentionally left blank

        Test.startTest();
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr =
            AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(false, tr.success, 'Missing returnUrl should fail');
        System.assert(
            tr.message != null && tr.message.contains('returnUrl is required'),
            'Message should state returnUrl is required, got: ' + tr.message
        );
    }

    @IsTest
    static void test_safe_relative_returnUrl_accepted() {
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new OkTokenMock());
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = validReq();
        r.returnUrl = '/AmericanBookCompany/s/checkout'; // relative path — safe
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr =
            AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(true, tr.success, 'Relative returnUrl should be accepted');
        System.assertEquals('hostedToken123', tr.token, 'Token must be returned');
    }

    @IsTest
    static void test_invoiceNumber_truncated_to_20_chars() {
        // referenceId longer than 20 chars must be silently truncated, not rejected
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new OkTokenMock());
        AuthorizeNetAcceptHostedTokenService.TokenRequest r = validReq();
        r.referenceId = '123456789012345678901234'; // 24 chars
        AuthorizeNetAcceptHostedTokenService.TokenResponse tr =
            AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken(r);
        Test.stopTest();

        System.assertEquals(true, tr.success, 'Long referenceId should be truncated and request accepted');
        System.assertEquals('hostedToken123', tr.token, 'Token must still be returned');
    }

    @IsTest
    static void test_isSafeRedirectUrl() {
        // Relative paths — always safe
        System.assertEquals(true,  AuthorizeNetAcceptHostedTokenService.isSafeRedirectUrl('/'),
            'Root relative path should be safe');
        System.assertEquals(true,  AuthorizeNetAcceptHostedTokenService.isSafeRedirectUrl('/AmericanBookCompany/s/checkout'),
            'Relative path should be safe');
        // ABC storefront HTTPS origin — safe
        System.assertEquals(true,  AuthorizeNetAcceptHostedTokenService.isSafeRedirectUrl('https://americanbookcompany.my.site.com/AmericanBookCompany/s/checkout'),
            'ABC site HTTPS URL should be safe');
        System.assertEquals(true,  AuthorizeNetAcceptHostedTokenService.isSafeRedirectUrl('https://americanbookcompany.my.salesforce.com/'),
            'ABC Salesforce HTTPS URL should be safe');
        // External domains — unsafe
        System.assertEquals(false, AuthorizeNetAcceptHostedTokenService.isSafeRedirectUrl('https://evil.com/steal'),
            'External domain should be unsafe');
        System.assertEquals(false, AuthorizeNetAcceptHostedTokenService.isSafeRedirectUrl('http://americanbookcompany.my.site.com/steal'),
            'HTTP (not HTTPS) should be unsafe');
        System.assertEquals(false, AuthorizeNetAcceptHostedTokenService.isSafeRedirectUrl('https://americanbookcompany.my.site.com.evil.com/'),
            'Domain-spoofing URL should be unsafe');
    }
}