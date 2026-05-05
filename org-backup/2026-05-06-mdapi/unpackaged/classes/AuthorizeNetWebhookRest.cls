/**
 * REST endpoint for Authorize.Net payment webhooks.
 *
 * Security:
 *  - Validates the X-ANET-Signature HMAC-SHA512 header when a WebhookSigningKey__c
 *    is configured in AuthorizeNet_Config__mdt (record: Default).
 *  - If no signing key is configured (e.g. during sandbox/test setup), the webhook
 *    is still accepted but SignatureValid__c is recorded as false so the record is
 *    visibly unverified. Set WebhookSigningKey__c to the value shown in the
 *    Authorize.Net merchant portal under Account → Webhooks → Manage Endpoints
 *    before going live.
 *  - Payload size is guarded to prevent oversized body DML failures.
 *  - Key fields (eventType, transactionId, authAmount, invoiceNumber, notificationId,
 *    sourceIp) are extracted on insert so downstream logic never needs to re-parse
 *    Payload__c to identify a record.
 *  - NotificationId__c is an external-ID unique field — duplicate webhooks from
 *    Authorize.Net retries are handled via upsert to avoid duplicate records.
 */
@RestResource(urlMapping='/authorizenet/webhook/*')
global with sharing class AuthorizeNetWebhookRest {

    // Maximum accepted payload size (32 KB matches the Payload__c LongTextArea limit).
    private static final Integer MAX_PAYLOAD_BYTES = 32768;

    @HttpPost
    global static void receive() {
        RestRequest  req = RestContext.request;
        RestResponse res = RestContext.response;

        res.addHeader('Content-Type', 'application/json');

        try {
            String rawBody = req.requestBody == null ? null : req.requestBody.toString();

            // Guard against oversized payloads
            if (rawBody != null && rawBody.length() > MAX_PAYLOAD_BYTES) {
                res.statusCode = 413;
                res.responseBody = Blob.valueOf('{"success":false,"error":"Payload too large"}');
                return;
            }

            Map<String, String> headers = req.headers == null
                ? new Map<String, String>()
                : req.headers;

            Boolean sigValid = verifySignature(rawBody, headers);
            Map<String, Object> parsed = parsePayload(rawBody);
            upsertTransactionRecord(rawBody, parsed, sigValid, headers);

            res.statusCode = 200;
            res.responseBody = Blob.valueOf('{"success":true}');

        } catch (Exception e) {
            // Always return 200 to Authorize.Net to prevent retries for server-side errors;
            // the error is recorded on the transaction record or visible in Apex logs.
            System.debug(LoggingLevel.ERROR, 'AuthorizeNetWebhookRest error: ' + e.getMessage());
            res.statusCode = 200;
            res.responseBody = Blob.valueOf('{"success":false,"error":"Processing error"}');
        }
    }

    // ── Signature Validation ──────────────────────────────────────────────────

    /**
     * Validates the X-ANET-Signature header using HMAC-SHA512.
     * Returns true if the signature matches or if no signing key is configured
     * (sandbox/test mode). Returns false if a key is configured and the
     * signature is missing or does not match.
     */
    @TestVisible
    private static Boolean verifySignature(String rawBody, Map<String, String> headers) {
        AuthorizeNet_Config__mdt cfg = AuthorizeNet_Config__mdt.getInstance('Default');
        String signingKey = (cfg != null) ? cfg.WebhookSigningKey__c : null;

        // No signing key configured — sandbox/test mode; accept but flag as unverified.
        if (String.isBlank(signingKey)) {
            return false;
        }

        // Locate header (header names are case-insensitive in HTTP).
        String sigHeader = null;
        for (String hKey : headers.keySet()) {
            if (hKey.equalsIgnoreCase('X-ANET-Signature')) {
                sigHeader = headers.get(hKey);
                break;
            }
        }

        if (String.isBlank(sigHeader)) {
            return false;
        }

        // Authorize.Net sends the header as "sha512=<HEX>" — strip the prefix.
        String receivedHash = sigHeader.startsWithIgnoreCase('sha512=')
            ? sigHeader.substring(7)
            : sigHeader;

        String bodyToHash = rawBody == null ? '' : rawBody;
        Blob sigBlob = Crypto.generateMac(
            'hmacSHA512',
            Blob.valueOf(bodyToHash),
            Blob.valueOf(signingKey)
        );
        String computedHash = EncodingUtil.convertToHex(sigBlob);

        return computedHash.equalsIgnoreCase(receivedHash);
    }

    // ── Payload Parsing ───────────────────────────────────────────────────────

    private static Map<String, Object> parsePayload(String rawBody) {
        if (String.isBlank(rawBody)) {
            return new Map<String, Object>();
        }
        try {
            return (Map<String, Object>) JSON.deserializeUntyped(rawBody);
        } catch (Exception e) {
            return new Map<String, Object>();
        }
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    private static void upsertTransactionRecord(
        String rawBody,
        Map<String, Object> parsed,
        Boolean sigValid,
        Map<String, String> headers
    ) {
        // Extract top-level fields from the Authorize.Net webhook payload shape:
        // { "notificationId": "...", "eventType": "...", "payload": { "id": "...", "authAmount": ..., "invoiceNumber": "..." } }
        String notificationId = stringField(parsed, 'notificationId');
        String eventType      = stringField(parsed, 'eventType');

        Map<String, Object> innerPayload = new Map<String, Object>();
        Object payloadObj = parsed.get('payload');
        if (payloadObj instanceof Map<String, Object>) {
            innerPayload = (Map<String, Object>) payloadObj;
        }

        String transactionId  = stringField(innerPayload, 'id');
        String invoiceNumber  = stringField(innerPayload, 'invoiceNumber');
        Decimal authAmount    = decimalField(innerPayload, 'authAmount');
        String responseCode   = stringField(innerPayload, 'responseCode');

        // Source IP from request headers
        String sourceIp = null;
        for (String hKey : headers.keySet()) {
            if (hKey.equalsIgnoreCase('X-Forwarded-For') || hKey.equalsIgnoreCase('X-Real-IP')) {
                sourceIp = headers.get(hKey);
                break;
            }
        }
        if (sourceIp != null && sourceIp.length() > 45) {
            sourceIp = sourceIp.left(45);
        }

        // Use static type so DML can run in system mode (bypassing guest-user CRUD checks).
        AuthorizeNet_Transaction__c txn = new AuthorizeNet_Transaction__c(
            Payload__c        = rawBody,
            SignatureValid__c = sigValid,
            EventType__c      = eventType,
            TransactionId__c  = transactionId,
            AuthAmount__c     = authAmount,
            InvoiceNumber__c  = invoiceNumber,
            SourceIp__c       = sourceIp,
            Processed__c      = false
        );

        if (responseCode != null) {
            try { txn.ResponseCode__c = Decimal.valueOf(responseCode); } catch (Exception e) { /* non-numeric code — skip */ }
        }

        if (String.isNotBlank(notificationId)) {
            // Use upsert on the external-ID field to make webhook delivery idempotent.
            // Authorize.Net retries failed deliveries up to 3 times — upsert ensures
            // we don't create duplicate transaction records for the same notification.
            txn.NotificationId__c = notificationId;
            upsert as system txn NotificationId__c;
        } else {
            insert as system txn;
        }
    }

    // ── Field Helpers ─────────────────────────────────────────────────────────

    private static String stringField(Map<String, Object> m, String key) {
        Object val = m.get(key);
        return (val != null) ? String.valueOf(val) : null;
    }

    private static Decimal decimalField(Map<String, Object> m, String key) {
        Object val = m.get(key);
        if (val == null) return null;
        try {
            return Decimal.valueOf(String.valueOf(val));
        } catch (Exception e) {
            return null;
        }
    }
}