public without sharing class AuthorizeNetAcceptHostedTokenService {
    // ---- DTOs ----
    public class TokenRequest {
        @AuraEnabled public Decimal amount { get; set; }
        @AuraEnabled public String currencyIsoCode { get; set; } // e.g., "USD"
        @AuraEnabled public String returnUrl { get; set; }       // optional: redirect flow
        @AuraEnabled public String cancelUrl { get; set; }       // optional
        @AuraEnabled public Boolean showReceipt { get; set; }    // recommended false for iframe flow
        @AuraEnabled public String transactionType { get; set; } // "authCaptureTransaction" or "authOnlyTransaction"
        @AuraEnabled public String referenceId { get; set; }     // e.g., CART-<cartId>
    }

    public class TokenResponse {
        @AuraEnabled public Boolean success { get; set; }
        @AuraEnabled public String token { get; set; }
        @AuraEnabled public String resultCode { get; set; }
        @AuraEnabled public String message { get; set; }
        @AuraEnabled public String rawResponse { get; set; }
    }

    /**
     * Returns Accept Hosted token for the given amount.
     * LWC should supply final amount + currency (e.g., from /carts/current/cart-summary).
     */
    @AuraEnabled
    public static TokenResponse getHostedPaymentToken(TokenRequest req) {
        TokenResponse out = new TokenResponse();
        try {
            validate(req);

            // Load secrets from Protected Custom Metadata (recommended).
            // Replace this with your own protected storage.
            AuthorizeNet_Config__mdt cfg = AuthorizeNet_Config__mdt.getInstance('Default');
            if (cfg == null || String.isBlank(cfg.ApiLoginId__c) || String.isBlank(cfg.TransactionKey__c)) {
                throwAura('Authorize.Net credentials not configured.');
            }

            // Decide which Named Credential to use
            String namedCred = (cfg.UseSandbox__c == true) ? 'AuthorizeNet_Sandbox' : 'AuthorizeNet_Prod';

            HttpRequest httpReq = new HttpRequest();
            httpReq.setEndpoint('callout:' + namedCred + '/xml/v1/request.api');
            httpReq.setMethod('POST');
            httpReq.setHeader('Content-Type', 'application/json');
            httpReq.setTimeout(20000);

            String payload = buildHostedPaymentTokenPayload(cfg, req);
            httpReq.setBody(payload);

            Http http = new Http();
            HttpResponse res = http.send(httpReq);

            String responseBody = sanitizeJsonBody(res.getBody());
            out.rawResponse = responseBody;

            if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
                out.success = false;
                out.message = 'Authorize.Net token call failed: HTTP ' + res.getStatusCode();
                return out;
            }

            if (String.isBlank(responseBody) || (!responseBody.startsWith('{') && !responseBody.startsWith('['))) {
                out.success = false;
                out.message = 'Authorize.Net returned non-JSON response.';
                return out;
            }

            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
            Map<String, Object> messages = (Map<String, Object>) parsed.get('messages');
            String resultCode = messages != null ? String.valueOf(messages.get('resultCode')) : null;

            out.resultCode = resultCode;

            if (resultCode == 'Ok' && parsed.containsKey('token')) {
                out.success = true;
                out.token = String.valueOf(parsed.get('token'));
                out.message = 'Successful';
                return out;
            }

            // Try to pull first error text if available
            String errText;
            if (messages != null && messages.containsKey('message')) {
                Object msgObj = messages.get('message');
                System.debug('msgObj: ' + msgObj);
                if (msgObj instanceof List<Object> && !((List<Object>)msgObj).isEmpty()) {
                    Map<String, Object> first = (Map<String, Object>) ((List<Object>)msgObj)[0];
                    errText = String.valueOf(first.get('text'));
                }
            }

            out.success = false;
            out.message = String.isBlank(errText) ? 'Authorize.Net returned Error' : errText;
            return out;

        } catch (Exception e) {
            out.success = false;
            out.message = 'Authorize.Net token error [' + e.getTypeName() + ' @ line ' + e.getLineNumber() + ']: ' + e.getMessage();
            System.debug(LoggingLevel.ERROR,
                'AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken exception: ' +
                e.getTypeName() + ' line=' + e.getLineNumber() + ' message=' + e.getMessage() +
                ' stack=' + e.getStackTraceString()
            );
            return out;
        }
    }

    // ---- Helpers ----

    private static void throwAura(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        throw ex;
    }

    private static String sanitizeJsonBody(String body) {
        if (body == null) {
            return null;
        }

        String cleaned = body.trim();
        cleaned = cleaned.replaceFirst('^\\uFEFF', '');
        return cleaned;
    }

    private static void validate(TokenRequest req) {
        if (req == null) throwAura('Missing request.');
        if (req.amount == null || req.amount <= 0) throwAura('Amount must be > 0.');
        if (String.isBlank(req.currencyIsoCode)) req.currencyIsoCode = 'USD';
        if (String.isBlank(req.transactionType)) req.transactionType = 'authCaptureTransaction';

        if (req.showReceipt == null) req.showReceipt = false;
    }

    private static String buildHostedPaymentTokenPayload(AuthorizeNet_Config__mdt cfg, TokenRequest req) {
        String continueUrl = String.isBlank(req.returnUrl) ? 'https://www.google.com' : req.returnUrl;
        String cancelUrl = String.isBlank(req.cancelUrl) ? continueUrl : req.cancelUrl;

        Map<String, Object> returnOptions = new Map<String, Object>{
            'showReceipt' => true,
            'url' => continueUrl,
            'urlText' => 'Continue',
            'cancelUrl' => cancelUrl,
            'cancelUrlText' => 'Cancel'
        };

        JSONGenerator gen = JSON.createGenerator(false);
        gen.writeStartObject();
            gen.writeFieldName('getHostedPaymentPageRequest');
            gen.writeStartObject();

                gen.writeFieldName('merchantAuthentication');
                gen.writeStartObject();
                    gen.writeStringField('name', cfg.ApiLoginId__c);
                    gen.writeStringField('transactionKey', cfg.TransactionKey__c);
                gen.writeEndObject();

                gen.writeFieldName('transactionRequest');
                gen.writeStartObject();
                    gen.writeStringField('transactionType', req.transactionType);
                    gen.writeStringField('amount', String.valueOf(req.amount.setScale(2)));
                    gen.writeStringField('currencyCode', req.currencyIsoCode);
                    if (!String.isBlank(req.referenceId)) {
                        gen.writeFieldName('order');
                        gen.writeStartObject();
                            gen.writeStringField('invoiceNumber', req.referenceId);
                        gen.writeEndObject();
                    }
                gen.writeEndObject();

                gen.writeFieldName('hostedPaymentSettings');
                gen.writeStartObject();
                    gen.writeFieldName('setting');
                    gen.writeStartArray();
                        gen.writeStartObject();
                            gen.writeStringField('settingName', 'hostedPaymentReturnOptions');
                            gen.writeStringField('settingValue', JSON.serialize(returnOptions));
                        gen.writeEndObject();
                    gen.writeEndArray();
                gen.writeEndObject();

            gen.writeEndObject();
        gen.writeEndObject();

        return gen.getAsString();
    }
}