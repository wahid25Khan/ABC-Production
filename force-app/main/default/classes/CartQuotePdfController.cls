/**
 * AuraEnabled controller called by the cartActionButtons LWC to generate
 * a branded PDF quote from the current user's active cart.
 */
public with sharing class CartQuotePdfController {

    /** Response wrapper returned to the LWC. */
    @SuppressWarnings('PMD')
    public class QuoteResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String pdfBase64;
        @AuraEnabled public String quoteNumber;
        @AuraEnabled public String message;
    }

    /**
     * Queries the current user's active cart, generates a quote number,
     * renders the CartQuotePdf Visualforce page as PDF, and returns the
     * base64-encoded PDF content for client-side download.
     */
    @AuraEnabled
    public static QuoteResult generateQuotePdf() {
        QuoteResult result = new QuoteResult();
        try {
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

            // 2. Verify cart has items
            Integer itemCount = [
                SELECT COUNT()
                FROM CartItem
                WHERE CartId = :cartId
                  AND Type = 'Product'
            ];

            if (itemCount == 0) {
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

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'CartQuotePdfController error: '
                + e.getTypeName() + ' @ line ' + e.getLineNumber()
                + ' — ' + e.getMessage());
            result.success = false;
            result.message = 'Unable to generate quote. Please try again.';
        }
        return result;
    }
}
