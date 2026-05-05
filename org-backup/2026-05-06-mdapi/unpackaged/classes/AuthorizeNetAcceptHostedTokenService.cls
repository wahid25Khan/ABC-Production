/**
 * Generates Authorize.Net Accept Hosted payment tokens for B2B Commerce checkout.
 */
public with sharing class AuthorizeNetAcceptHostedTokenService {
    // ---- DTOs ----

    /** Request wrapper for hosted payment token generation. */
    @SuppressWarnings('PMD')
    public class TokenRequest {
        /** Transaction amount. */
        @AuraEnabled public Decimal amount { get; set; }
        /** ISO currency code (e.g. USD). */
        @AuraEnabled public String currencyIsoCode { get; set; }
        /** Optional return URL after payment. */
        @AuraEnabled public String returnUrl { get; set; }
        /** Optional cancel URL. */
        @AuraEnabled public String cancelUrl { get; set; }
        /** Whether to show receipt page (recommended false for iframe flow). */
        @AuraEnabled public Boolean showReceipt { get; set; }
        /** Transaction type (authCaptureTransaction or authOnlyTransaction). */
        @AuraEnabled public String transactionType { get; set; }
        /** Reference ID (e.g. cart ID). */
        @AuraEnabled public String referenceId { get; set; }
        /**
         * Publicly accessible URL of the iFrame communicator HTML page (static resource).
         * Required for Accept Hosted iFrame/modal mode — allows AN to relay postMessage
         * events back to the parent LWC page without a full-page redirect.
         * Omit or leave blank to use full-page redirect mode instead.
         */
        @AuraEnabled public String iFrameCommunicatorUrl { get; set; }
    }

    /** Response wrapper returned to LWC after token generation. */
    @SuppressWarnings('PMD')
    public class TokenResponse {
        /** Whether the token was generated successfully. */
        @AuraEnabled public Boolean success { get; set; }
        /** The Accept Hosted token. */
        @AuraEnabled public String token { get; set; }
        /** Authorize.Net result code. */
        @AuraEnabled public String resultCode { get; set; }
        /** Descriptive message (safe for display — no internal stack details). */
        @AuraEnabled public String message { get; set; }
        /** Whether the token was generated against the sandbox environment. */
        @AuraEnabled public Boolean useSandbox { get; set; }
        // rawResponse intentionally removed — never expose the raw API response to the browser.
    }

    /**
     * Returns Accept Hosted token for the given amount.
     * @param req Token request with amount, currency, and options.
     * @return TokenResponse containing success status and token.
     */
    @AuraEnabled
    public static TokenResponse getHostedPaymentToken(TokenRequest req) {
        TokenResponse out = new TokenResponse();
        try {
            validate(req);

            // Default record holds the UseSandbox toggle; credential record holds API keys.
            AuthorizeNet_Config__mdt toggle = AuthorizeNet_Config__mdt.getInstance('Default');
            Boolean isSandbox = (toggle != null && toggle.UseSandbox__c == true);
            out.useSandbox = isSandbox;

            String credRecordName = isSandbox ? 'Sandbox' : 'Default';
            AuthorizeNet_Config__mdt cfg = AuthorizeNet_Config__mdt.getInstance(credRecordName);
            if (cfg == null || String.isBlank(cfg.ApiLoginId__c) || String.isBlank(cfg.TransactionKey__c)) {
                throwAura('Authorize.Net credentials not configured for ' + (isSandbox ? 'sandbox' : 'production') + ' mode.');
            }

            HttpResponse res = sendTokenRequest(cfg, req);
            String responseBody = sanitizeJsonBody(res.getBody());
            // rawResponse is NOT stored on the DTO — never expose raw API responses to the browser.

            return parseTokenResponse(out, res, responseBody);

        } catch (AuraHandledException e) {
            out.success = false;
            out.message = e.getMessage(); // validation messages are safe to surface
            return out;
        } catch (Exception e) {
            // Strip internal type/line details — never send stack information to the browser.
            System.debug(LoggingLevel.ERROR, 'AuthorizeNetAcceptHostedTokenService error: ' + e.getTypeName() + ' @ line ' + e.getLineNumber() + ' — ' + e.getMessage());
            out.success = false;
            out.message = 'Payment token generation failed. Please try again.';
            return out;
        }
    }

    private static HttpResponse sendTokenRequest(AuthorizeNet_Config__mdt cfg, TokenRequest req) {
        String namedCred = (cfg.UseSandbox__c == true) ? 'AuthorizeNet_Sandbox' : 'AuthorizeNet_Prod';

        HttpRequest httpReq = new HttpRequest();
        httpReq.setEndpoint('callout:' + namedCred + '/xml/v1/request.api');
        httpReq.setMethod('POST');
        httpReq.setHeader('Content-Type', 'application/json');
        httpReq.setTimeout(20000);
        httpReq.setBody(buildHostedPaymentTokenPayload(cfg, req));

        return new Http().send(httpReq);
    }

    private static TokenResponse parseTokenResponse(TokenResponse out, HttpResponse res, String responseBody) {
        String preCheckError = validateRawResponse(res, responseBody);
        if (preCheckError != null) {
            return buildFailure(out, preCheckError);
        }

        Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
        Map<String, Object> messages = (Map<String, Object>) parsed.get('messages');
        out.resultCode = messages != null ? String.valueOf(messages.get('resultCode')) : null;

        if (out.resultCode == 'Ok' && parsed.containsKey('token')) {
            out.success = true;
            out.token = String.valueOf(parsed.get('token'));
            out.message = 'Successful';
            return out;
        }

        String errText = extractErrorText(messages);
        return buildFailure(out, String.isBlank(errText) ? 'Authorize.Net returned Error' : errText);
    }

    private static String validateRawResponse(HttpResponse res, String responseBody) {
        if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
            return 'Authorize.Net token call failed: HTTP ' + res.getStatusCode();
        }
        if (String.isBlank(responseBody) || (!responseBody.startsWith('{') && !responseBody.startsWith('['))) {
            return 'Authorize.Net returned non-JSON response.';
        }
        return null;
    }

    private static TokenResponse buildFailure(TokenResponse out, String msg) {
        out.success = false;
        out.message = msg;
        return out;
    }

    private static String extractErrorText(Map<String, Object> messages) {
        if (messages == null || !messages.containsKey('message')) {
            return null;
        }
        Object msgObj = messages.get('message');
        if (msgObj instanceof List<Object> && !((List<Object>) msgObj).isEmpty()) {
            Map<String, Object> first = (Map<String, Object>) ((List<Object>) msgObj)[0];
            return String.valueOf(first.get('text'));
        }
        return null;
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
        if (req == null) {
            throwAura('Missing request.');
        }
        if (req.amount == null || req.amount <= 0) {
            throwAura('Amount must be > 0.');
        }
        if (String.isBlank(req.currencyIsoCode)) {
            req.currencyIsoCode = 'USD';
        }
        if (String.isBlank(req.transactionType)) {
            req.transactionType = 'authCaptureTransaction';
        }
        if (req.showReceipt == null) {
            req.showReceipt = false;
        }
        // Validate returnUrl/cancelUrl — must be blank or start with the site origin.
        // This prevents an open-redirect attack where a malicious caller could redirect
        // buyers to an arbitrary domain after payment.
        if (String.isNotBlank(req.returnUrl) && !isSafeRedirectUrl(req.returnUrl)) {
            throwAura('Invalid returnUrl: must be a relative path or an americanbookcompany.my.site.com URL.');
        }
        if (String.isNotBlank(req.cancelUrl) && !isSafeRedirectUrl(req.cancelUrl)) {
            throwAura('Invalid cancelUrl: must be a relative path or an americanbookcompany.my.site.com URL.');
        }
        if (String.isNotBlank(req.iFrameCommunicatorUrl) && !isSafeCommunicatorUrl(req.iFrameCommunicatorUrl)) {
            throwAura('Invalid iFrameCommunicatorUrl: must be hosted on americanbookcompany.my.site.com or americanbookcompany.my.salesforce.com.');
        }
    }

    /**
     * Returns true when the URL is safe to use as a redirect target.
     * Accepts blank values (handled by caller), relative paths, and
     * URLs on the known ABC storefront domain.
     */
    @TestVisible
    private static Boolean isSafeRedirectUrl(String url) {
        if (String.isBlank(url)) return true;
        if (url.startsWith('/')) return true; // relative path
        return url.startsWith('https://americanbookcompany.my.site.com/')
            || url.startsWith('https://americanbookcompany.my.salesforce.com/');
    }

    /**
     * Validates the iFrame communicator URL.
     * Must be an absolute HTTPS URL on our known domains (no relative paths — AN requires absolute).
     */
    @TestVisible
    private static Boolean isSafeCommunicatorUrl(String url) {
        if (String.isBlank(url)) return true;
        return url.startsWith('https://americanbookcompany.my.site.com/')
            || url.startsWith('https://americanbookcompany.my.salesforce.com/');
    }

    private static String buildHostedPaymentTokenPayload(AuthorizeNet_Config__mdt cfg, TokenRequest req) {
        if (String.isBlank(req.returnUrl)) {
            // returnUrl is required — the validate() call should have caught a missing value,
            // but as a safety net we throw here rather than silently redirecting to an
            // unrelated site like google.com.
            throwAura('returnUrl is required for hosted payment redirect.');
        }
        String continueUrl = req.returnUrl;
        String cancelUrl = String.isBlank(req.cancelUrl) ? continueUrl : req.cancelUrl;

        // Authorize.Net Accept Hosted invoiceNumber has a 20-character maximum.
        if (!String.isBlank(req.referenceId) && req.referenceId.length() > 20) {
            req.referenceId = req.referenceId.left(20);
        }

        // Use req.showReceipt (set and validated in validate()) rather than a hardcoded true.
        Map<String, Object> returnOptions = new Map<String, Object>{
            'showReceipt' => req.showReceipt,
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
                        gen.writeStartObject();
                            gen.writeStringField('settingName', 'hostedPaymentButtonOptions');
                            gen.writeStringField('settingValue', JSON.serialize(new Map<String, Object>{
                                'text' => 'Pay Now'
                            }));
                        gen.writeEndObject();
                        gen.writeStartObject();
                            gen.writeStringField('settingName', 'hostedPaymentPaymentOptions');
                            gen.writeStringField('settingValue', JSON.serialize(new Map<String, Object>{
                                'cardCodeRequired' => false,
                                'showCreditCard' => true,
                                'showBankAccount' => false
                            }));
                        gen.writeEndObject();
                        gen.writeStartObject();
                            gen.writeStringField('settingName', 'hostedPaymentBillingAddressOptions');
                            gen.writeStringField('settingValue', JSON.serialize(new Map<String, Object>{
                                'show' => true,
                                'required' => false
                            }));
                        gen.writeEndObject();
                        gen.writeStartObject();
                            gen.writeStringField('settingName', 'hostedPaymentSecurityOptions');
                            gen.writeStringField('settingValue', JSON.serialize(new Map<String, Object>{
                                'captcha' => false
                            }));
                        gen.writeEndObject();
                        if (String.isNotBlank(req.iFrameCommunicatorUrl)) {
                            gen.writeStartObject();
                                gen.writeStringField('settingName', 'hostedPaymentIFrameCommunicatorUrl');
                                gen.writeStringField('settingValue', JSON.serialize(new Map<String, Object>{
                                    'url' => req.iFrameCommunicatorUrl
                                }));
                            gen.writeEndObject();
                        }
                    gen.writeEndArray();
                gen.writeEndObject();

            gen.writeEndObject();
        gen.writeEndObject();

        return gen.getAsString();
    }
}