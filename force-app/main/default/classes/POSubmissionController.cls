/**
 * Apex controller for the PO Submission form LWC.
 * Creates a Case record with Type = 'Purchase Order' and returns
 * the Case ID so the LWC can attach uploaded PO documents.
 */
public with sharing class POSubmissionController {

    /** Request wrapper from the LWC form. */
    @SuppressWarnings('PMD')
    public class PORequest {
        @AuraEnabled public String poNumber;
        @AuraEnabled public String schoolDistrict;
        @AuraEnabled public String contactName;
        @AuraEnabled public String contactEmail;
        @AuraEnabled public String contactPhone;
        @AuraEnabled public String notes;
    }

    /** Response wrapper returned to the LWC. */
    @SuppressWarnings('PMD')
    public class POResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String caseId;
        @AuraEnabled public String caseNumber;
        @AuraEnabled public String message;
    }

    /**
     * Validates the request, creates a Case, and returns the Case ID + Number.
     * @param req PO form data from the LWC.
     * @return POResult with success/failure and Case reference.
     */
    @AuraEnabled
    public static POResult submitPurchaseOrder(PORequest req) {
        POResult result = new POResult();
        try {
            validateRequest(req);

            Case c = new Case();
            c.Subject = 'PO Submission: ' + req.poNumber.trim();
            c.Origin = 'Web';
            c.Type = 'Purchase Order';
            c.Purchase_Order_Number__c = req.poNumber.trim();
            c.SuppliedCompany = req.schoolDistrict.trim();
            c.SuppliedName = req.contactName.trim();
            c.SuppliedEmail = req.contactEmail.trim();
            c.SuppliedPhone = String.isNotBlank(req.contactPhone) ? req.contactPhone.trim() : null;
            c.Description = String.isBlank(req.notes)
                ? 'Purchase Order submitted via storefront.'
                : req.notes.trim();

            insert c;

            c = [SELECT Id, CaseNumber FROM Case WHERE Id = :c.Id LIMIT 1];

            result.success = true;
            result.caseId = c.Id;
            result.caseNumber = c.CaseNumber;
            result.message = 'Purchase order submitted successfully.';

        } catch (AuraHandledException e) {
            result.success = false;
            result.message = e.getMessage();
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'POSubmissionController error: '
                + e.getTypeName() + ' @ line ' + e.getLineNumber()
                + ' — ' + e.getMessage());
            result.success = false;
            result.message = 'Unable to submit purchase order. Please try again or contact us at (888) 264-5877.';
        }
        return result;
    }

    private static void validateRequest(PORequest req) {
        if (req == null) {
            throwAura('Missing request data.');
        }
        if (String.isBlank(req.poNumber)) {
            throwAura('PO Number is required.');
        }
        if (String.isBlank(req.schoolDistrict)) {
            throwAura('School / District Name is required.');
        }
        if (String.isBlank(req.contactName)) {
            throwAura('Contact Name is required.');
        }
        if (String.isBlank(req.contactEmail)) {
            throwAura('Contact Email is required.');
        }
    }

    private static void throwAura(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        throw ex;
    }
}
