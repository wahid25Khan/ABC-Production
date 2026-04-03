/**
 * Visualforce page controller for the Cart Quote PDF.
 * Queries the active cart and its items, then exposes the data
 * for rendering in the CartQuotePdf Visualforce page.
 */
public with sharing class CartQuotePdfPageController {

    public String quoteNumber { get; set; }
    public String quoteDate { get; set; }
    public String accountName { get; set; }
    public String contactName { get; set; }
    public String contactEmail { get; set; }
    public Decimal grandTotal { get; set; }
    public List<QuoteLine> lines { get; set; }

    public class QuoteLine {
        public String productName { get; set; }
        public String sku { get; set; }
        public Decimal quantity { get; set; }
        public Decimal unitPrice { get; set; }
        public Decimal lineTotal { get; set; }
    }

    public CartQuotePdfPageController() {
        String cartId = ApexPages.currentPage().getParameters().get('cartId');
        quoteNumber = ApexPages.currentPage().getParameters().get('quoteNumber');
        quoteDate = Date.today().format();
        lines = new List<QuoteLine>();
        grandTotal = 0;

        if (String.isBlank(cartId)) {
            return;
        }

        try {
            WebCart cart = [
                SELECT Id, AccountId, Account.Name,
                       OwnerId, Owner.Name, Owner.Email
                FROM WebCart
                WHERE Id = :cartId
                LIMIT 1
            ];

            accountName = cart.Account?.Name;
            contactName = cart.Owner?.Name;
            contactEmail = cart.Owner?.Email;

            List<CartItem> items = [
                SELECT Id, Name, Product2Id, Product2.Name,
                       Product2.StockKeepingUnit,
                       Quantity, SalesPrice, TotalPrice, Sku
                FROM CartItem
                WHERE CartId = :cartId
                  AND Type = 'Product'
                ORDER BY Product2.Name ASC
            ];

            for (CartItem ci : items) {
                QuoteLine ql = new QuoteLine();
                ql.productName = ci.Product2?.Name != null ? ci.Product2.Name : ci.Name;
                ql.sku = ci.Sku != null ? ci.Sku : ci.Product2?.StockKeepingUnit;
                ql.quantity = ci.Quantity;
                ql.unitPrice = ci.SalesPrice;
                ql.lineTotal = ci.TotalPrice;
                lines.add(ql);
                grandTotal += ci.TotalPrice != null ? ci.TotalPrice : 0;
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'CartQuotePdfPageController error: ' + e.getTypeName() + ' — ' + e.getMessage());
        }
    }
}
