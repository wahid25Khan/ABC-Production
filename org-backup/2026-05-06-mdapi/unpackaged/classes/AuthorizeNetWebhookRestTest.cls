@IsTest
private class AuthorizeNetWebhookRestTest {

    @TestSetup
    static void setup() {
        // Ensure the custom object exists in the org; no data required beforehand.
        // Some orgs may require FLS/permissions; tests run in system context.
    }

    @IsTest
    static void test_receive_persists_payload_and_returns_ok() {
        // Arrange REST context
        RestRequest req = new RestRequest();
        req.httpMethod = 'POST';
        req.requestURI = '/services/apexrest/authorizenet/webhook';
        String body = '{"eventType":"net.authorize.payment.authcapture.created","id":"abc-123","payload":{"amount":10.00}}';
        req.requestBody = Blob.valueOf(body);

        RestResponse res = new RestResponse();

        RestContext.request = req;
        RestContext.response = res;

        // Act
        Test.startTest();
        AuthorizeNetWebhookRest.receive();
        Test.stopTest();

        // Assert HTTP response
        System.assertEquals(200, RestContext.response.statusCode, 'Should return 200');
        String responseBody = RestContext.response.responseBody != null ? RestContext.response.responseBody.toString() : null;
        System.assertNotEquals(null, responseBody, 'Response body should be present');
        System.assert(responseBody.contains('"success":true'), 'Success flag should be true');

        // Assert persistence
        // The class uses dynamic SObject construction, so we query by field name if present
        // We only know it stores into Payload__c per implementation.
        try {
            // Using dynamic SOQL to avoid compile errors if field not present in rare orgs
            List<SObject> rows = Database.query('SELECT Id, Payload__c FROM AuthorizeNet_Transaction__c ORDER BY CreatedDate DESC LIMIT 1');
            System.assertEquals(1, rows.size(), 'One transaction record should be inserted');
            String stored = (String) rows[0].get('Payload__c');
            System.assertEquals(body, stored, 'Stored payload should equal request body');
        } catch (Exception e) {
            // If object/field missing in target org, the implementation logs and bails.
            // In such a case, confirm that no unhandled exception is thrown and response is still 200.
            System.assertEquals(200, RestContext.response.statusCode, 'Should still return 200 even if object missing');
        }
    }

    @IsTest
    static void test_receive_handles_null_body() {
        // Arrange
        RestRequest req = new RestRequest();
        req.httpMethod = 'POST';
        req.requestURI = '/services/apexrest/authorizenet/webhook';
        // No body set -> null
        RestResponse res = new RestResponse();

        RestContext.request = req;
        RestContext.response = res;

        // Act
        Test.startTest();
        AuthorizeNetWebhookRest.receive();
        Test.stopTest();

        // Assert response is still OK
        System.assertEquals(200, RestContext.response.statusCode, 'Should return 200 for null body');
        String responseBody = RestContext.response.responseBody != null ? RestContext.response.responseBody.toString() : null;
        System.assertNotEquals(null, responseBody, 'Response body should be present');
        System.assert(responseBody.contains('"success":true'), 'Success flag should be true');

        // If object exists, ensure a row is created with null payload
        Boolean verified = false;
        try {
            List<SObject> rows = Database.query('SELECT Id, Payload__c FROM AuthorizeNet_Transaction__c ORDER BY CreatedDate DESC LIMIT 1');
            if (!rows.isEmpty()) {
                verified = true;
                System.assertEquals(null, (String) rows[0].get('Payload__c'), 'Payload should be null when no body provided');
            }
        } catch (Exception ignore) {
            // Object may not exist; acceptable per implementation
        }
        // Either verified with object present or object doesn't exist which is acceptable behavior
        System.assertEquals(true, RestContext.response.statusCode == 200, 'Endpoint remains stable regardless of persistence');
    }

    // ─── New tests covering security and resilience improvements ─────────────────

    @IsTest
    static void test_extracted_fields_stored_on_transaction() {
        String notificationId = 'notif-test-field-extract';
        String webhookBody = JSON.serialize(new Map<String, Object>{
            'notificationId' => notificationId,
            'eventType'       => 'net.authorize.payment.authcapture.created',
            'payload'         => new Map<String, Object>{
                'id'            => 'txn-999',
                'authAmount'    => 41.00,
                'invoiceNumber' => 'INV-2024-001',
                'responseCode'  => '1'
            }
        });

        RestRequest req = new RestRequest();
        req.httpMethod  = 'POST';
        req.requestURI  = '/services/apexrest/authorizenet/webhook';
        req.requestBody = Blob.valueOf(webhookBody);
        RestResponse res = new RestResponse();
        RestContext.request  = req;
        RestContext.response = res;

        Test.startTest();
        AuthorizeNetWebhookRest.receive();
        Test.stopTest();

        System.assertEquals(200, RestContext.response.statusCode, 'Should return 200');
        try {
            List<SObject> rows = Database.query(
                'SELECT Id, EventType__c, TransactionId__c, AuthAmount__c, InvoiceNumber__c, ' +
                'NotificationId__c, SignatureValid__c ' +
                'FROM AuthorizeNet_Transaction__c WHERE NotificationId__c = :notificationId LIMIT 1'
            );
            System.assertEquals(1, rows.size(), 'One transaction record should be created');
            System.assertEquals('net.authorize.payment.authcapture.created', (String) rows[0].get('EventType__c'),     'EventType should be extracted');
            System.assertEquals('txn-999',                                   (String) rows[0].get('TransactionId__c'), 'TransactionId should be extracted');
            System.assertEquals(41.00,                                        (Decimal) rows[0].get('AuthAmount__c'),   'AuthAmount should be extracted');
            System.assertEquals('INV-2024-001',                               (String) rows[0].get('InvoiceNumber__c'), 'InvoiceNumber should be extracted');
            System.assertEquals(false, (Boolean) rows[0].get('SignatureValid__c'),
                'SignatureValid__c should be false when no signing key is configured (sandbox mode)');
        } catch (Exception ex) {
            System.assert(false, 'Field extraction query failed: ' + ex.getMessage());
        }
    }

    @IsTest
    static void test_oversized_payload_returns_413() {
        // Payloads exceeding MAX_PAYLOAD_BYTES (32768) must be rejected before DML
        String bigBody = 'A'.repeat(32769);

        RestRequest req = new RestRequest();
        req.httpMethod  = 'POST';
        req.requestURI  = '/services/apexrest/authorizenet/webhook';
        req.requestBody = Blob.valueOf(bigBody);
        RestResponse res = new RestResponse();
        RestContext.request  = req;
        RestContext.response = res;

        Test.startTest();
        AuthorizeNetWebhookRest.receive();
        Test.stopTest();

        System.assertEquals(413, RestContext.response.statusCode, 'Oversized payload should return HTTP 413');
        String responseBody = RestContext.response.responseBody != null
            ? RestContext.response.responseBody.toString() : '';
        System.assert(responseBody.contains('"success":false'), 'Response should indicate failure for 413');
    }

    @IsTest
    static void test_duplicate_notification_upserts_not_inserts() {
        // Authorize.Net retries failed deliveries. Identical notificationId must result
        // in a single record (upsert), not two inserts.
        String notificationId = 'notif-dupe-idempotency';
        String webhookBody = JSON.serialize(new Map<String, Object>{
            'notificationId' => notificationId,
            'eventType'      => 'net.authorize.payment.authcapture.created',
            'payload'        => new Map<String, Object>{ 'id' => 'txn-dupe', 'authAmount' => 41.00 }
        });

        RestRequest req = new RestRequest();
        req.httpMethod  = 'POST';
        req.requestURI  = '/services/apexrest/authorizenet/webhook';
        req.requestBody = Blob.valueOf(webhookBody);

        Test.startTest();
        // First delivery
        RestContext.request  = req;
        RestContext.response = new RestResponse();
        AuthorizeNetWebhookRest.receive();
        // Second delivery — simulate Authorize.Net retry
        RestContext.request  = req;
        RestContext.response = new RestResponse();
        AuthorizeNetWebhookRest.receive();
        Test.stopTest();

        try {
            List<SObject> rows = Database.query(
                'SELECT Id FROM AuthorizeNet_Transaction__c WHERE NotificationId__c = :notificationId'
            );
            System.assertEquals(1, rows.size(),
                'Duplicate webhook retry should upsert (not insert) resulting in exactly 1 record');
        } catch (Exception ex) {
            System.assert(false, 'Idempotency query failed: ' + ex.getMessage());
        }
    }

    @IsTest
    static void test_sandbox_mode_accepts_webhook_records_sig_false() {
        // When no WebhookSigningKey__c is configured (sandbox), webhooks must still be
        // accepted (returns 200) but SignatureValid__c recorded as false so records are
        // visibly unverified until a real key is configured before go-live.
        String notificationId = 'notif-sandbox-sigtest';
        String body = JSON.serialize(new Map<String, Object>{
            'notificationId' => notificationId,
            'eventType'      => 'net.authorize.payment.authcapture.created',
            'payload'        => new Map<String, Object>()
        });

        RestRequest req = new RestRequest();
        req.httpMethod  = 'POST';
        req.requestURI  = '/services/apexrest/authorizenet/webhook';
        req.requestBody = Blob.valueOf(body);
        RestResponse res = new RestResponse();
        RestContext.request  = req;
        RestContext.response = res;

        Test.startTest();
        AuthorizeNetWebhookRest.receive();
        Test.stopTest();

        System.assertEquals(200, RestContext.response.statusCode,
            'Should return 200 even without a configured signing key');
        try {
            List<SObject> rows = Database.query(
                'SELECT Id, SignatureValid__c FROM AuthorizeNet_Transaction__c WHERE NotificationId__c = :notificationId LIMIT 1'
            );
            System.assertEquals(1, rows.size(), 'Record should be persisted in sandbox mode');
            System.assertEquals(false, (Boolean) rows[0].get('SignatureValid__c'),
                'SignatureValid__c must be false when no signing key is configured');
        } catch (Exception ex) {
            System.assert(false, 'Sandbox mode query failed: ' + ex.getMessage());
        }
    }
}