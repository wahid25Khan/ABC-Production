/** REST endpoint for Authorize.Net payment webhooks. */
@RestResource(urlMapping='/authorizenet/webhook/*')
global without sharing class AuthorizeNetWebhookRest {
    @HttpPost
    /** Receives and persists Authorize.Net webhook payloads. */
    global static void receive() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;

        String rawBody = req.requestBody == null ? null : req.requestBody.toString();
        Map<String, String> headers = req.headers == null ? new Map<String, String>() : req.headers;

        persistTransactionPayload(rawBody);

        String marker = 'ANET_WEBHOOK_' + String.valueOf(DateTime.now().getTime());
        res.statusCode = 200;
        res.addHeader('Content-Type','application/json');
        res.responseBody = Blob.valueOf('{"success":true,"marker":"' + marker + '"}');
    }

    private static void persistTransactionPayload(String rawBody) {
        Schema.SObjectType txnType = Schema.getGlobalDescribe().get('AuthorizeNet_Transaction__c');
        if (txnType == null) {
            return;
        }

        SObject txn = txnType.newSObject();
        txn.put('Payload__c', rawBody);
        insert as system txn;
    }
}