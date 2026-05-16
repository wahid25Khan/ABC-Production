/**
 * Fires after an AuthorizeNet_Transaction__c record is inserted by the webhook endpoint.
 * Enqueues AuthorizeNetCheckoutFinalizer to complete the Salesforce order asynchronously
 * when an approved payment arrives, so the order is created even if the buyer's browser
 * session is no longer active.
 */
trigger AuthorizeNetTransactionTrigger on AuthorizeNet_Transaction__c (after insert) {
    AuthorizeNetTransactionTriggerHandler.handleAfterInsert(Trigger.new);
}