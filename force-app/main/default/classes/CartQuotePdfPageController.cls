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
    public String contactPhone { get; set; }
    public String organizationName { get; set; }
    public String streetAddress { get; set; }
    public String city { get; set; }
    public String stateCode { get; set; }
    public String stateLabel { get; set; }
    public String postalCode { get; set; }
    public Boolean taxExempt { get; set; }
    public Decimal subtotal { get; set; }
    public Decimal shippingAmount { get; set; }
    public Decimal salesTaxAmount { get; set; }
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
        subtotal = parseDecimalParam('subtotal');
        shippingAmount = parseDecimalParam('shippingAmount');
        salesTaxAmount = parseDecimalParam('salesTaxAmount');
        grandTotal = parseDecimalParam('grandTotal');
        contactName = readParam('contactName');
        contactEmail = readParam('contactEmail');
        contactPhone = readParam('contactPhone');
        organizationName = readParam('organizationName');
        streetAddress = readParam('streetAddress');
        city = readParam('city');
        stateCode = readParam('stateCode');
        stateLabel = readParam('stateLabel');
        postalCode = readParam('postalCode');
        taxExempt = 'true'.equalsIgnoreCase(readParam('taxExempt'));
        if (shippingAmount == null) {
            shippingAmount = 0;
        }
        if (salesTaxAmount == null) {
            salesTaxAmount = 0;
        }

        if (String.isBlank(cartId)) {
            if (subtotal == null) {
                subtotal = 0;
            }
            if (grandTotal == null) {
                grandTotal = subtotal + valueOrZero(shippingAmount) + valueOrZero(salesTaxAmount);
            }
            return;
        }

        try {
            Decimal lineSubtotal = 0;
            WebCart cart = [
                SELECT Id, AccountId, Account.Name,
                       OwnerId, Owner.Name, Owner.Email
                FROM WebCart
                WHERE Id = :cartId
                LIMIT 1
            ];

            accountName = cart.Account?.Name;
            if (String.isBlank(organizationName)) {
                organizationName = accountName;
            }
            if (String.isBlank(contactName)) {
                contactName = cart.Owner?.Name;
            }
            if (String.isBlank(contactEmail)) {
                contactEmail = cart.Owner?.Email;
            }

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
                lineSubtotal += ci.TotalPrice != null ? ci.TotalPrice : 0;
            }

            if (subtotal == null) {
                subtotal = lineSubtotal;
            }
            if (grandTotal == null) {
                grandTotal = subtotal + valueOrZero(shippingAmount) + valueOrZero(salesTaxAmount);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'CartQuotePdfPageController error: ' + e.getTypeName() + ' — ' + e.getMessage());
            if (subtotal == null) {
                subtotal = 0;
            }
            if (grandTotal == null) {
                grandTotal = subtotal + valueOrZero(shippingAmount) + valueOrZero(salesTaxAmount);
            }
        }
    }

    public String getAddressLine() {
        List<String> parts = new List<String>();
        if (!String.isBlank(city)) {
            parts.add(city);
        }
        if (!String.isBlank(stateLabel)) {
            parts.add(stateLabel);
        } else if (!String.isBlank(stateCode)) {
            parts.add(stateCode);
        }

        String addressLine = String.join(parts, ', ');
        if (!String.isBlank(postalCode)) {
            addressLine += (String.isBlank(addressLine) ? '' : ' ') + postalCode;
        }
        return addressLine;
    }

    private static String readParam(String key) {
        return String.isBlank(key) ? null : ApexPages.currentPage().getParameters().get(key);
    }

    private static Decimal parseDecimalParam(String key) {
        String rawValue = readParam(key);
        if (String.isBlank(rawValue)) {
            return null;
        }

        try {
            return Decimal.valueOf(rawValue);
        } catch (Exception e) {
            return null;
        }
    }

    private static Decimal valueOrZero(Decimal value) {
        return value == null ? 0 : value;
    }
}