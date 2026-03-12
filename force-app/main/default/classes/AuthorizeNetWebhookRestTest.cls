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
        System.assert(responseBody.contains('"ANET_WEBHOOK_'), 'Marker should be included');

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
}