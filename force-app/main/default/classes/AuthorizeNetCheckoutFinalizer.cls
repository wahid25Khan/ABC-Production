/**
 * Async order finalizer for Authorize.Net Accept Hosted checkouts.
 *
 * Enqueued by AuthorizeNetTransactionTriggerHandler when an approved payment
 * webhook is received. Looks up the CartCheckoutSession identified by the
 * transaction's InvoiceNumber__c, then calls ensureDeliveryMethod,
 * registerExternalPayment, and placeOrder using the current execution context's
 * session token.
 *
 * Session note: In a Queueable that originates from the AuthorizeNet webhook
 * REST endpoint, UserInfo.getSessionId() returns the session of the API user
 * that called the endpoint (typically the Connected App integration user).
 * That user must have "API Enabled" and the Commerce "Checkout" permission set
 * assigned for the HTTP callouts to succeed.  If the session is unavailable the
 * finalizer logs a warning and exits gracefully — the LWC primary path
 * (buyer's browser session) will complete the order instead.
 */
public without sharing class AuthorizeNetCheckoutFinalizer implements Queueable, Database.AllowsCallouts {
  private Id transactionRecordId;

  public AuthorizeNetCheckoutFinalizer(Id transactionRecordId) {
    this.transactionRecordId = transactionRecordId;
  }

  public void execute(QueueableContext context) {
    // TODO: order creation is temporarily disabled while registerExternalPayment / placeOrder
    // payloads are being debugged. This queueable will be re-enabled once the Commerce API
    // integration is confirmed working. For now, just mark the transaction as processed.
    List<AuthorizeNet_Transaction__c> txnList = [
      SELECT Id, Processed__c
      FROM AuthorizeNet_Transaction__c
      WHERE Id = :transactionRecordId
      LIMIT 1
    ];
    if (!txnList.isEmpty() && txnList[0].Processed__c != true) {
      markProcessed(txnList[0].Id);
    }
  }

  private static void markProcessed(Id txnId) {
    try {
      update new AuthorizeNet_Transaction__c(Id = txnId, Processed__c = true);
    } catch (Exception ex) {
      System.debug(
        LoggingLevel.ERROR,
        'AuthorizeNetCheckoutFinalizer: could not mark Processed__c: ' +
        ex.getMessage()
      );
    }
  }

  private static Id safeId(String value) {
    if (String.isBlank(value))
      return null;
    try {
      return (Id) value;
    } catch (Exception ex) {
      return null;
    }
  }
}
