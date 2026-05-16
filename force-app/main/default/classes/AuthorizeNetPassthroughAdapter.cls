/**
 * Minimal Salesforce PaymentGatewayAdapter for Authorize.Net Accept Hosted.
 *
 * Authorize.Net captures payment entirely on their hosted form — by the time
 * the buyer returns to the store the charge is already settled. This adapter
 * acts as a passthrough: it records the AN transaction ID in Salesforce's
 * PaymentAuthorization record (GatewayRefNumber) and returns Success so that
 * the B2B Commerce placeOrder endpoint considers payment authorized.
 *
 * Required org configuration (done once in Setup, not deployable as metadata):
 *  1. Setup → Payments → Payment Gateway Providers → New
 *       Developer Name : AuthorizeNetPassthrough
 *       Apex Adapter Class : AuthorizeNetPassthroughAdapter
 *  2. Setup → Payments → Payment Gateways → New
 *       Gateway Name : AuthorizeNet Gateway
 *       Provider     : AuthorizeNetPassthrough
 *       Merchant Credentials : (create a Named Credential pointing to api.authorize.net
 *                               or leave blank — this adapter makes no callouts)
 *       Status : Active
 *  3. Setup → Commerce → [Your Store] → Payment
 *       Set "Payment Gateway" to "AuthorizeNet Gateway"
 *
 * After configuration the registerExternalPayment REST call (requestType=PostAuth,
 * paymentToken=<AN transId>) will route through this adapter and succeed.
 */
global class AuthorizeNetPassthroughAdapter implements commercepayments.PaymentGatewayAdapter {

    global commercepayments.GatewayResponse processRequest(
        commercepayments.PaymentGatewayContext gatewayContext
    ) {
        commercepayments.RequestType requestType = gatewayContext.getPaymentRequestType();

        if (requestType == commercepayments.RequestType.PostAuth) {
            return handlePostAuth(gatewayContext);
        }

        // Any other request type (Authorize, Capture, Refund, etc.) is not used
        // in this custom checkout flow — return a non-fatal error.
        return new commercepayments.GatewayErrorResponse(
            '400',
            'AuthorizeNetPassthroughAdapter: unsupported request type ' + requestType
        );
    }

    // ── PostAuth ─────────────────────────────────────────────────────────────────
    // Called by registerExternalPayment (POST /checkouts/{id}/payments, requestType=PostAuth).
    // The AN transaction ID is passed as paymentToken in the REST body and arrives
    // here as paymentMethod.gatewayToken on the PostAuthorizationRequest.
    private static commercepayments.GatewayResponse handlePostAuth(
        commercepayments.PaymentGatewayContext ctx
    ) {
        commercepayments.PostAuthorizationRequest req =
            (commercepayments.PostAuthorizationRequest) ctx.getPaymentRequest();

        // Extract the AN transaction ID that was passed as paymentToken in the REST call.
        // The token arrives via paymentMethod.alternativePaymentMethod.gatewayToken —
        // see AlternativePaymentMethodRequest.gatewayToken in the Apex Reference Guide.
        String anTransactionId = '';
        if (req.paymentMethod != null && req.paymentMethod.alternativePaymentMethod != null) {
            commercepayments.AlternativePaymentMethodRequest apm =
                (commercepayments.AlternativePaymentMethodRequest) req.paymentMethod.alternativePaymentMethod;
            anTransactionId = apm.gatewayToken != null ? apm.gatewayToken : '';
        }

        commercepayments.PostAuthorizationResponse response =
            new commercepayments.PostAuthorizationResponse();

        // Echo the AN transaction ID as the gateway reference number so it's
        // stored in PaymentAuthorization.GatewayRefNumber for audit purposes.
        response.setGatewayReferenceNumber(
            String.isNotBlank(anTransactionId) ? anTransactionId : 'AN-PASSTHROUGH'
        );
        response.setGatewayResultCode('1');          // AN response code 1 = Approved
        response.setGatewayMessage('Authorized');
        response.setAmount(req.amount);

        // Tell the Salesforce Payments platform this is a success.
        response.setSalesforceResultCodeInfo(
            new commercepayments.SalesforceResultCodeInfo(
                commercepayments.SalesforceResultCode.Success
            )
        );

        System.debug(LoggingLevel.INFO,
            'AuthorizeNetPassthroughAdapter PostAuth: anTransactionId=' + anTransactionId
            + ' amount=' + req.amount);

        return response;
    }
}