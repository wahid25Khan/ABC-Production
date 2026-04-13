public with sharing class SubmitPurchaseOrderController {

    public class PurchaseOrderRequest {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String organizationName;
        @AuraEnabled public String street;
        @AuraEnabled public String city;
        @AuraEnabled public String state;
        @AuraEnabled public String zipCode;
        @AuraEnabled public String poNumber;
        @AuraEnabled public String notes;
        @AuraEnabled public String referralInfo;
        @AuraEnabled public String comments;
        @AuraEnabled public String uploadedContentDocumentId;
    }

    public class SubmitResponse {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public String contentDocumentId;
    }

    @AuraEnabled
    public static SubmitResponse uploadPurchaseOrderFile(String fileName, String base64Data, String contentType) {
        SubmitResponse response = new SubmitResponse();
        response.success = false;

        try {
            if (String.isBlank(fileName)) {
                AuraHandledException ex = new AuraHandledException('File name is required.');
                ex.setMessage('File name is required.');
                throw ex;
            }

            if (String.isBlank(base64Data)) {
                AuraHandledException ex = new AuraHandledException('File data is required.');
                ex.setMessage('File data is required.');
                throw ex;
            }

            Blob fileBody = EncodingUtil.base64Decode(base64Data);

            ContentVersion cv = new ContentVersion();
            cv.Title = getSafeTitle(fileName);
            cv.PathOnClient = '/' + fileName;
            cv.VersionData = fileBody;
            insert cv;

            ContentVersion insertedCv = [
                SELECT Id, ContentDocumentId
                FROM ContentVersion
                WHERE Id = :cv.Id
                LIMIT 1
            ];

            response.success = true;
            response.message = 'File uploaded successfully.';
            response.contentDocumentId = insertedCv.ContentDocumentId;
            return response;

        } catch (Exception e) {
            response.success = false;
            response.message = e.getMessage();
            return response;
        }
    }

    @AuraEnabled
    public static SubmitResponse submitPurchaseOrder(String reqJson) {
        SubmitResponse response = new SubmitResponse();
        response.success = false;

        try {
            if (String.isBlank(reqJson)) {
                AuraHandledException ex = new AuraHandledException('Request is required.');
                ex.setMessage('Request is required.');
                throw ex;
            }

            PurchaseOrderRequest req =
                (PurchaseOrderRequest) JSON.deserialize(reqJson, PurchaseOrderRequest.class);

            validateRequest(req);

            Map<String, Object> flowInputs = new Map<String, Object>{
                'vFirstName' => req.firstName,
                'vLastName' => req.lastName,
                'vEmail' => req.email,
                'vPhone' => req.phone,
                'vOrganizationName' => req.organizationName,
                'vStreet' => req.street,
                'vCity' => req.city,
                'vState' => req.state,
                'vZipCode' => req.zipCode,
                'vPONumber' => req.poNumber,
                'vNotes' => req.notes,
                'vReferralInfo' => req.referralInfo,
                'vComments' => req.comments,
                'vUploadedContentDocumentId' => req.uploadedContentDocumentId
            };

            Flow.Interview.Submit_Purchase_Order flowInterview =
                new Flow.Interview.Submit_Purchase_Order(flowInputs);

            flowInterview.start();

            response.success = true;
            response.message = 'Your PO has been submitted.';
            response.contentDocumentId = req.uploadedContentDocumentId;
            return response;

        } catch (Exception e) {
            response.success = false;
            response.message = e.getMessage();
            return response;
        }
    }

    private static void validateRequest(PurchaseOrderRequest req) {
        if (req == null) {
            AuraHandledException ex = new AuraHandledException('Request is required.');
            ex.setMessage('Request is required.');
            throw ex;
        }
        if (String.isBlank(req.firstName)) {
            AuraHandledException ex = new AuraHandledException('First Name is required.');
            ex.setMessage('First Name is required.');
            throw ex;
        }
        if (String.isBlank(req.lastName)) {
            AuraHandledException ex = new AuraHandledException('Last Name is required.');
            ex.setMessage('Last Name is required.');
            throw ex;
        }
        if (String.isBlank(req.email)) {
            AuraHandledException ex = new AuraHandledException('Email is required.');
            ex.setMessage('Email is required.');
            throw ex;
        }
        if (String.isBlank(req.phone)) {
            AuraHandledException ex = new AuraHandledException('Phone is required.');
            ex.setMessage('Phone is required.');
            throw ex;
        }
        if (String.isBlank(req.organizationName)) {
            AuraHandledException ex = new AuraHandledException('Organization Name is required.');
            ex.setMessage('Organization Name is required.');
            throw ex;
        }
        if (String.isBlank(req.street)) {
            AuraHandledException ex = new AuraHandledException('Street is required.');
            ex.setMessage('Street is required.');
            throw ex;
        }
        if (String.isBlank(req.city)) {
            AuraHandledException ex = new AuraHandledException('City is required.');
            ex.setMessage('City is required.');
            throw ex;
        }
        if (String.isBlank(req.state)) {
            AuraHandledException ex = new AuraHandledException('State is required.');
            ex.setMessage('State is required.');
            throw ex;
        }
        if (String.isBlank(req.zipCode)) {
            AuraHandledException ex = new AuraHandledException('ZIP Code is required.');
            ex.setMessage('ZIP Code is required.');
            throw ex;
        }
        if (String.isBlank(req.poNumber)) {
            AuraHandledException ex = new AuraHandledException('Purchase Order Number is required.');
            ex.setMessage('Purchase Order Number is required.');
            throw ex;
        }
        if (String.isBlank(req.uploadedContentDocumentId)) {
            AuraHandledException ex = new AuraHandledException('Please upload a PDF file.');
            ex.setMessage('Please upload a PDF file.');
            throw ex;
        }
    }

    private static String getSafeTitle(String fileName) {
        Integer dotIndex = fileName.lastIndexOf('.');
        if (dotIndex > 0) {
            return fileName.substring(0, dotIndex);
        }
        return fileName;
    }
}