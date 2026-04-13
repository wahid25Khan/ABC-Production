/**
 * AuraEnabled controller called by the cartActionButtons LWC to generate
 * a branded PDF quote from the current user's active cart.
 */
public with sharing class CartQuotePdfController {

    public class QuoteRequest {
        public String contactName;
        public String organizationName;
        public String streetAddress;
        public String city;
        public String stateCode;
        public String stateLabel;
        public String postalCode;
        public String contactPhone;
        public String contactEmail;
        public Boolean taxExempt;
        public Decimal subtotal;
        public Decimal shippingAmount;
        public Decimal salesTaxAmount;
        public Decimal grandTotal;
    }

    /** Response wrapper returned to the LWC. */
    @SuppressWarnings('PMD')
    public class QuoteResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String pdfBase64;
        @AuraEnabled public String quoteNumber;
        @AuraEnabled public String message;
        @AuraEnabled public String quoteId;
    }

    /** Pre-populated defaults for the quote download form derived from the authenticated user's Account. */
    public class QuoteFormDefaults {
        @AuraEnabled public String contactName;
        @AuraEnabled public String organizationName;
        @AuraEnabled public String street;
        @AuraEnabled public String city;
        @AuraEnabled public String stateCode;
        @AuraEnabled public String postalCode;
        @AuraEnabled public String phone;
        @AuraEnabled public String email;
    }

    /**
     * Queries the current user's active cart, generates a quote number,
     * renders the CartQuotePdf Visualforce page as PDF, and returns the
     * base64-encoded PDF content for client-side download.
     * Also persists a Salesforce Quote record with the cart items as line items.
     */
    @AuraEnabled
    public static QuoteResult generateQuotePdf(String requestJson) {
        QuoteResult result = new QuoteResult();
        try {
            QuoteRequest request = parseRequest(requestJson);

            // 1. Find the active cart for the current user
            List<WebCart> carts = [
                SELECT Id
                FROM WebCart
                WHERE OwnerId = :UserInfo.getUserId()
                  AND Status = 'Active'
                LIMIT 1
            ];

            if (carts.isEmpty()) {
                result.success = false;
                result.message = 'No active cart found. Please add items to your cart first.';
                return result;
            }

            String cartId = carts[0].Id;

            // 2. Query cart items (reused for both the empty-check and Quote line items)
            List<CartItem> cartItems = [
                SELECT Id, Name, Sku, Product2Id, Quantity, SalesPrice
                FROM CartItem
                WHERE CartId = :cartId
                  AND Type = 'Product'
            ];

            if (cartItems.isEmpty()) {
                result.success = false;
                result.message = 'Your cart is empty. Please add items before downloading a quote.';
                return result;
            }

            // 3. Generate a unique quote number: ABC-YYYYMMDD-XXXXX
            String datePart = Datetime.now().format('yyyyMMdd');
            String randPart = String.valueOf(
                Math.mod(Math.abs(Crypto.getRandomInteger()), 100000)
            ).leftPad(5, '0');
            String quoteNumber = 'ABC-' + datePart + '-' + randPart;

            // 4. Render the Visualforce page as PDF
            PageReference pdfPage = Page.CartQuotePdf;
            pdfPage.getParameters().put('cartId', cartId);
            pdfPage.getParameters().put('quoteNumber', quoteNumber);
            putParam(pdfPage, 'contactName', request.contactName);
            putParam(pdfPage, 'organizationName', request.organizationName);
            putParam(pdfPage, 'streetAddress', request.streetAddress);
            putParam(pdfPage, 'city', request.city);
            putParam(pdfPage, 'stateCode', request.stateCode);
            putParam(pdfPage, 'stateLabel', request.stateLabel);
            putParam(pdfPage, 'postalCode', request.postalCode);
            putParam(pdfPage, 'contactPhone', request.contactPhone);
            putParam(pdfPage, 'contactEmail', request.contactEmail);
            putParam(pdfPage, 'taxExempt', request.taxExempt == true ? 'true' : 'false');
            putParam(pdfPage, 'subtotal', request.subtotal);
            putParam(pdfPage, 'shippingAmount', request.shippingAmount);
            putParam(pdfPage, 'salesTaxAmount', request.salesTaxAmount);
            putParam(pdfPage, 'grandTotal', request.grandTotal);

            Blob pdfBlob;
            if (Test.isRunningTest()) {
                pdfBlob = Blob.valueOf('test pdf content');
            } else {
                pdfBlob = pdfPage.getContentAsPDF();
            }

            result.success = true;
            result.pdfBase64 = EncodingUtil.base64Encode(pdfBlob);
            result.quoteNumber = quoteNumber;
            result.message = 'Quote generated successfully.';

            // 5. Persist a Salesforce Quote record (best-effort — PDF download is never blocked)
            try {
                result.quoteId = new QuoteCreator().createSalesforceQuote(
                    request, quoteNumber, cartItems
                );
            } catch (Exception qe) {
                System.debug(LoggingLevel.WARN, 'CartQuotePdfController: Quote record creation skipped — '
                    + qe.getMessage());
            }

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'CartQuotePdfController error: '
                + e.getTypeName() + ' @ line ' + e.getLineNumber()
                + ' — ' + e.getMessage());
            result.success = false;
            result.message = 'Unable to generate quote. Please try again.';
        }
        return result;
    }

    /**
     * Returns field defaults for the quote form from the authenticated user's
     * User record and linked Account (BillingAddress + Phone + Name).
     * Cached so repeated opens of the modal cost no extra network round-trip.
     */
    @AuraEnabled(cacheable=true)
    public static QuoteFormDefaults getQuoteFormDefaults() {
        QuoteFormDefaults defaults = new QuoteFormDefaults();
        try {
            User u = [
                SELECT FirstName, LastName, Email, Phone,
                       Contact.Phone, Contact.MobilePhone,
                       Contact.Account.Name,
                       Contact.Account.BillingStreet,
                       Contact.Account.BillingCity,
                       Contact.Account.BillingState,
                       Contact.Account.BillingPostalCode,
                       Contact.Account.Phone
                FROM User
                WHERE Id = :UserInfo.getUserId()
                WITH USER_MODE
                LIMIT 1
            ];

            List<String> nameParts = new List<String>();
            if (String.isNotBlank(u.FirstName))  { nameParts.add(u.FirstName.trim()); }
            if (String.isNotBlank(u.LastName))   { nameParts.add(u.LastName.trim()); }
            defaults.contactName = String.join(nameParts, ' ');
            defaults.email       = u.Email != null ? u.Email.trim() : '';

            // Phone waterfall: user > contact > contact mobile > account
            String uPhone  = u.Phone                            != null ? u.Phone.trim()                            : '';
            String cPhone  = u.Contact?.Phone                   != null ? u.Contact.Phone.trim()                   : '';
            String cMobile = u.Contact?.MobilePhone             != null ? u.Contact.MobilePhone.trim()             : '';
            String aPhone  = u.Contact?.Account?.Phone          != null ? u.Contact.Account.Phone.trim()           : '';
            defaults.phone = String.isNotBlank(uPhone)  ? uPhone
                           : String.isNotBlank(cPhone)  ? cPhone
                           : String.isNotBlank(cMobile) ? cMobile
                           : aPhone;

            if (u.Contact?.Account != null) {
                defaults.organizationName = u.Contact.Account.Name          != null ? u.Contact.Account.Name.trim()               : '';
                defaults.street           = u.Contact.Account.BillingStreet != null ? u.Contact.Account.BillingStreet.trim()       : '';
                defaults.city             = u.Contact.Account.BillingCity   != null ? u.Contact.Account.BillingCity.trim()         : '';
                defaults.stateCode        = u.Contact.Account.BillingState  != null ? u.Contact.Account.BillingState.trim()        : '';
                defaults.postalCode       = u.Contact.Account.BillingPostalCode != null ? u.Contact.Account.BillingPostalCode.trim() : '';
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN,
                'CartQuotePdfController.getQuoteFormDefaults failed: ' + e.getMessage());
        }
        return defaults;
    }

    private static QuoteRequest parseRequest(String requestJson) {
        if (String.isBlank(requestJson)) {
            return new QuoteRequest();
        }

        try {
            QuoteRequest request = (QuoteRequest) JSON.deserialize(requestJson, QuoteRequest.class);
            return request == null ? new QuoteRequest() : request;
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'CartQuotePdfController request parse failed: ' + e.getMessage());
            return new QuoteRequest();
        }
    }

    private static void putParam(PageReference pageRef, String key, Object value) {
        if (pageRef == null || String.isBlank(key) || value == null) {
            return;
        }

        pageRef.getParameters().put(key, String.valueOf(value));
    }

    /**
     * Inner class that runs without sharing to create the Salesforce Opportunity,
     * Quote, and QuoteLineItem records. Using without sharing bypasses record-visibility
     * rules so the buyer account is always reachable. Object-level permissions on the
     * running user's profile must still grant Create on Opportunity, Quote,
     * and QuoteLineItem for this to succeed.
     */
    private without sharing class QuoteCreator {

        Id createSalesforceQuote(
            QuoteRequest req,
            String quoteNumber,
            List<CartItem> items
        ) {
            Id accountId = getBuyerAccountId();

            // Create the parent Opportunity required by Quote
            Opportunity opp = new Opportunity(
                Name = (String.isNotBlank(req.organizationName) ? req.organizationName : 'Quote')
                    + ' \u2014 ' + quoteNumber,
                StageName = 'Proposal/Price Quote',
                CloseDate = Date.today().addDays(30)
            );
            if (accountId != null) {
                opp.AccountId = accountId;
            }
            insert opp;

            // Get Standard Pricebook Id (test context requires Test.getStandardPricebookId()
            // because @SeeAllData=false hides the standard pricebook from SOQL)
            Id stdPbId;
            if (Test.isRunningTest()) {
                stdPbId = Test.getStandardPricebookId();
            } else {
                List<Pricebook2> stdPbs = [
                    SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1
                ];
                stdPbId = stdPbs.isEmpty() ? null : stdPbs[0].Id;
            }

            Decimal shippingHandling = req.shippingAmount != null ? req.shippingAmount : 0;
            Decimal tax = (req.taxExempt == true)
                ? 0
                : (req.salesTaxAmount != null ? req.salesTaxAmount : 0);

            // Build a formatted product table for the Description so sales
            // staff can see line items without needing QuoteLineItem records.
            // (The org validation rule "Exceed_6_percent_of_Shipping" blocks
            //  QuoteLineItem insert when ShippingHandling < Subtotal * 0.94,
            //  which is always the case for standard order values.)
            String lineSep = '\n----------------------------------------';
            String lineTable = '\n\nPRODUCTS:' + lineSep;
            Decimal computedSubtotal = 0;
            for (CartItem ci : items) {
                Decimal unitPrice = ci.SalesPrice != null ? ci.SalesPrice : 0;
                Decimal lineTotal = unitPrice * ci.Quantity;
                computedSubtotal += lineTotal;
                String itemName = String.isNotBlank(ci.Name) ? ci.Name : ci.Sku;
                lineTable += '\n' + itemName
                    + '\n  SKU: ' + (ci.Sku != null ? ci.Sku : 'N/A')
                    + '  |  Qty: ' + ci.Quantity
                    + '  |  Unit: $' + unitPrice.setScale(2)
                    + '  |  Total: $' + lineTotal.setScale(2);
            }
            lineTable += lineSep
                + '\nSubtotal:    $' + computedSubtotal.setScale(2)
                + '\nShipping:    $' + shippingHandling.setScale(2)
                + '\nTax:         $' + tax.setScale(2)
                + '\nGrand Total: $' + (req.grandTotal != null
                    ? String.valueOf(req.grandTotal.setScale(2)) : '0.00')
                + '\n(See attached PDF for full formatted quote)';

            String description = 'Organization: ' + req.organizationName
                + '\nContact: '  + req.contactName
                + '\nPhone: '    + req.contactPhone
                + '\nEmail: '    + req.contactEmail
                + '\nTax Exempt: ' + (req.taxExempt == true ? 'Yes' : 'No')
                + lineTable;

            Quote q = new Quote(
                Name             = quoteNumber,
                OpportunityId    = opp.Id,
                Pricebook2Id     = stdPbId,
                Phone            = req.contactPhone,
                BillingName      = req.contactName,
                BillingStreet    = req.streetAddress,
                BillingCity      = req.city,
                BillingState     = req.stateCode,
                BillingPostalCode = req.postalCode,
                BillingCountry   = 'US',
                ShippingName     = req.contactName,
                ShippingStreet   = req.streetAddress,
                ShippingCity     = req.city,
                ShippingState    = req.stateCode,
                ShippingPostalCode = req.postalCode,
                ShippingCountry  = 'US',
                ExpirationDate   = Date.today().addDays(30),
                Description      = description
            );
            insert q;

            return q.Id;
        }

        private Id getBuyerAccountId() {
            List<User> users = [
                SELECT ContactId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1
            ];
            if (users.isEmpty() || users[0].ContactId == null) {
                return null;
            }
            List<Contact> contacts = [
                SELECT AccountId FROM Contact WHERE Id = :users[0].ContactId LIMIT 1
            ];
            return contacts.isEmpty() ? null : contacts[0].AccountId;
        }
    }
}