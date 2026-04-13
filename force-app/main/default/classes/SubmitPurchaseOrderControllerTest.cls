@IsTest
private class SubmitPurchaseOrderControllerTest {

    private static SubmitPurchaseOrderController.PurchaseOrderRequest getValidRequest() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req =
            new SubmitPurchaseOrderController.PurchaseOrderRequest();

        req.firstName = 'John';
        req.lastName = 'Doe';
        req.email = 'john.doe@test.com';
        req.phone = '1234567890';
        req.organizationName = 'Acme Inc';
        req.street = '123 Main St';
        req.city = 'Lahore';
        req.state = 'Punjab';
        req.zipCode = '54000';
        req.poNumber = 'PO-1001';
        req.notes = 'Test Notes';
        req.referralInfo = 'Website';
        req.comments = 'Test Comments';
        req.uploadedContentDocumentId = '069000000000001AAA';

        return req;
    }

    @IsTest
    static void testUploadPurchaseOrderFile_Success() {
        String fileName = 'PurchaseOrder.pdf';
        String base64Data = EncodingUtil.base64Encode(Blob.valueOf('Dummy PDF Content'));
        String contentType = 'application/pdf';

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.uploadPurchaseOrderFile(fileName, base64Data, contentType);
        Test.stopTest();

        System.assertEquals(true, res.success);
        System.assertEquals('File uploaded successfully.', res.message);
        System.assertNotEquals(null, res.contentDocumentId);

        List<ContentVersion> cvs = [
            SELECT Id, Title, PathOnClient, ContentDocumentId
            FROM ContentVersion
            WHERE ContentDocumentId = :res.contentDocumentId
        ];
        System.assertEquals(1, cvs.size());
        System.assertEquals('PurchaseOrder', cvs[0].Title);
        System.assertEquals('/PurchaseOrder.pdf', cvs[0].PathOnClient);
    }

    @IsTest
    static void testUploadPurchaseOrderFile_NoExtension_Success() {
        String fileName = 'PurchaseOrderFile';
        String base64Data = EncodingUtil.base64Encode(Blob.valueOf('Dummy Content'));
        String contentType = 'application/pdf';

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.uploadPurchaseOrderFile(fileName, base64Data, contentType);
        Test.stopTest();

        System.assertEquals(true, res.success);
        System.assertNotEquals(null, res.contentDocumentId);

        ContentVersion cv = [
            SELECT Id, Title
            FROM ContentVersion
            WHERE ContentDocumentId = :res.contentDocumentId
            LIMIT 1
        ];
        System.assertEquals('PurchaseOrderFile', cv.Title);
    }

    @IsTest
    static void testUploadPurchaseOrderFile_BlankFileName() {
        String base64Data = EncodingUtil.base64Encode(Blob.valueOf('Dummy PDF Content'));

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.uploadPurchaseOrderFile('', base64Data, 'application/pdf');
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('File name is required.'));
    }

    @IsTest
    static void testUploadPurchaseOrderFile_BlankBase64() {
        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.uploadPurchaseOrderFile('PO.pdf', '', 'application/pdf');
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('File data is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_BlankJson() {
        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder('');
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Request is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_NullJson() {
        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder((String)null);
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Request is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingFirstName() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.firstName = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('First Name is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingLastName() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.lastName = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Last Name is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingEmail() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.email = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Email is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingPhone() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.phone = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Phone is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingOrganizationName() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.organizationName = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Organization Name is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingStreet() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.street = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Street is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingCity() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.city = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('City is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingState() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.state = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('State is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingZipCode() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.zipCode = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('ZIP Code is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingPoNumber() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.poNumber = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Purchase Order Number is required.'));
    }

    @IsTest
    static void testSubmitPurchaseOrder_MissingUploadedDocument() {
        SubmitPurchaseOrderController.PurchaseOrderRequest req = getValidRequest();
        req.uploadedContentDocumentId = null;

        Test.startTest();
        SubmitPurchaseOrderController.SubmitResponse res =
            SubmitPurchaseOrderController.submitPurchaseOrder(JSON.serialize(req));
        Test.stopTest();

        System.assertEquals(false, res.success);
        System.assert(res.message.contains('Please upload a PDF file.'));
    }
}