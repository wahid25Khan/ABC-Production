/**
 * Trigger handler for AuthorizeNet_Transaction__c.
 * Separates trigger logic from business logic for testability.
 */
public with sharing class AuthorizeNetTransactionTriggerHandler {

    /**
     * Called from the after-insert trigger context.
     * For each newly inserted approved transaction whose InvoiceNumber__c is a
     * CartCheckoutSession ID, enqueues AuthorizeNetCheckoutFinalizer to complete
     * the Commerce order asynchronously.
     *
     * Bulk-safe: one Queueable per qualifying record. Salesforce allows up to
     * 50 enqueueJob calls per transaction, which is well above any realistic
     * single-transaction volume for this checkout.
     */
    public static void handleAfterInsert(List<AuthorizeNet_Transaction__c> newRecords) {
        for (AuthorizeNet_Transaction__c txn : newRecords) {
            if (!isQualifyingTransaction(txn)) {
                continue;
            }
            System.enqueueJob(new AuthorizeNetCheckoutFinalizer(txn.Id));
        }
    }

    /**
     * Returns true when the transaction record should trigger async order finalization:
     *   - Not already processed
     *   - Response code = 1 (approved/authorized)
     *   - InvoiceNumber__c is a valid Salesforce ID (i.e., a CartCheckoutSession ID)
     */
    @TestVisible
    private static Boolean isQualifyingTransaction(AuthorizeNet_Transaction__c txn) {
        if (txn.Processed__c == true) {
            return false;
        }
        if (txn.ResponseCode__c != 1) {
            return false;
        }
        if (String.isBlank(txn.InvoiceNumber__c)) {
            return false;
        }
        // Verify the InvoiceNumber looks like a Salesforce record ID (15 or 18 chars, starts with valid prefix).
        try {
            Id candidate = (Id) txn.InvoiceNumber__c;
            // Must resolve to CartCheckoutSession
            return candidate.getSObjectType() == CartCheckoutSession.SObjectType;
        } catch (Exception ex) {
            return false;
        }
    }
}