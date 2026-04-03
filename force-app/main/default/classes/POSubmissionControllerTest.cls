@IsTest
private class POSubmissionControllerTest {

    @IsTest
    static void testSubmitPurchaseOrder_success() {
        POSubmissionController.PORequest req = new POSubmissionController.PORequest();
        req.poNumber = 'PO-2026-001';
        req.schoolDistrict = 'Atlanta Public Schools';
        req.contactName = 'Jane Smith';
        req.contactEmail = 'jane.smith@aps.edu';
        req.contactPhone = '(404) 555-1234';
        req.notes = 'Please expedite this order.';

        Test.startTest();
        POSubmissionController.POResult result = POSubmissionController.submitPurchaseOrder(req);
        Test.stopTest();

        System.assertEquals(true, result.success, 'Should succeed');
        System.assertNotEquals(null, result.caseId, 'Case ID should be populated');
        System.assertNotEquals(null, result.caseNumber, 'Case Number should be populated');

        Case created = [SELECT Subject, Origin, Type, Purchase_Order_Number__c,
                                SuppliedCompany, SuppliedName, SuppliedEmail,
                                SuppliedPhone, Description
                         FROM Case WHERE Id = :result.caseId];

        System.assertEquals('PO Submission: PO-2026-001', created.Subject);
        System.assertEquals('Web', created.Origin);
        System.assertEquals('Purchase Order', created.Type);
        System.assertEquals('PO-2026-001', created.Purchase_Order_Number__c);
        System.assertEquals('Atlanta Public Schools', created.SuppliedCompany);
        System.assertEquals('Jane Smith', created.SuppliedName);
        System.assertEquals('jane.smith@aps.edu', created.SuppliedEmail);
        System.assertEquals('(404) 555-1234', created.SuppliedPhone);
        System.assertEquals('Please expedite this order.', created.Description);
    }

    @IsTest
    static void testSubmitPurchaseOrder_noNotes() {
        POSubmissionController.PORequest req = new POSubmissionController.PORequest();
        req.poNumber = 'PO-2026-002';
        req.schoolDistrict = 'Cobb County Schools';
        req.contactName = 'John Doe';
        req.contactEmail = 'john@cobb.k12.ga.us';

        Test.startTest();
        POSubmissionController.POResult result = POSubmissionController.submitPurchaseOrder(req);
        Test.stopTest();

        System.assertEquals(true, result.success, 'Should succeed without notes');

        Case created = [SELECT Description FROM Case WHERE Id = :result.caseId];
        System.assertEquals('Purchase Order submitted via storefront.', created.Description);
    }

    @IsTest
    static void testSubmitPurchaseOrder_missingPONumber() {
        POSubmissionController.PORequest req = new POSubmissionController.PORequest();
        req.schoolDistrict = 'Test District';
        req.contactName = 'Test User';
        req.contactEmail = 'test@test.com';

        Test.startTest();
        POSubmissionController.POResult result = POSubmissionController.submitPurchaseOrder(req);
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail without PO number');
        System.assert(result.message.contains('PO Number'), 'Error should mention PO Number');
    }

    @IsTest
    static void testSubmitPurchaseOrder_missingSchool() {
        POSubmissionController.PORequest req = new POSubmissionController.PORequest();
        req.poNumber = 'PO-123';
        req.contactName = 'Test User';
        req.contactEmail = 'test@test.com';

        Test.startTest();
        POSubmissionController.POResult result = POSubmissionController.submitPurchaseOrder(req);
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail without school');
        System.assert(result.message.contains('School'), 'Error should mention School');
    }

    @IsTest
    static void testSubmitPurchaseOrder_missingContactName() {
        POSubmissionController.PORequest req = new POSubmissionController.PORequest();
        req.poNumber = 'PO-123';
        req.schoolDistrict = 'Test District';
        req.contactEmail = 'test@test.com';

        Test.startTest();
        POSubmissionController.POResult result = POSubmissionController.submitPurchaseOrder(req);
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail without contact name');
        System.assert(result.message.contains('Contact Name'), 'Error should mention Contact Name');
    }

    @IsTest
    static void testSubmitPurchaseOrder_missingEmail() {
        POSubmissionController.PORequest req = new POSubmissionController.PORequest();
        req.poNumber = 'PO-123';
        req.schoolDistrict = 'Test District';
        req.contactName = 'Test User';

        Test.startTest();
        POSubmissionController.POResult result = POSubmissionController.submitPurchaseOrder(req);
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail without email');
        System.assert(result.message.contains('Contact Email'), 'Error should mention Contact Email');
    }

    @IsTest
    static void testSubmitPurchaseOrder_nullRequest() {
        Test.startTest();
        POSubmissionController.POResult result = POSubmissionController.submitPurchaseOrder(null);
        Test.stopTest();

        System.assertEquals(false, result.success, 'Should fail with null request');
    }
}
