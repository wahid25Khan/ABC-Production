@SuppressWarnings('PMD.ApexCRUDViolation')
/**
 * Provides a resilient order history feed for storefront account pages.
 */
public with sharing class OrderHistoryController {
    @TestVisible
    private static Id buyerAccountIdOverride;

    @TestVisible
    private static List<OrderSummaryRow> orderRowsOverride;

    /** Order summary data returned to the LWC. */
    public class OrderSummaryRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String orderNumber;
        @AuraEnabled public Datetime orderedDate;
        @AuraEnabled public String status;
        @AuraEnabled public Decimal grandTotalAmount;
        @AuraEnabled public List<OrderItemRow> lineItems;
    }

    /** Individual line item within an order. */
    public class OrderItemRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public Decimal unitPrice;
        @AuraEnabled public Id productId;
    }

    /**
     * Returns the current buyer's order summaries for the requested lookback window.
     *
     * @param monthsBack Number of months to include; null returns all available orders.
     * @return Order summary rows ordered from newest to oldest.
     */
    @AuraEnabled(cacheable=true)
    public static List<OrderSummaryRow> getOrders(Integer monthsBack) {
        if (Test.isRunningTest() && orderRowsOverride != null) {
            return orderRowsOverride;
        }

        Id buyerAccountId = resolveBuyerAccountId();
        if (buyerAccountId == null) {
            return new List<OrderSummaryRow>();
        }

        Integer normalizedMonthsBack = (monthsBack != null && monthsBack > 0) ? monthsBack : null;

        List<OrderSummary> summaries;
        if (normalizedMonthsBack == null) {
            summaries = [
                SELECT Id, OrderNumber, OrderedDate, Status, GrandTotalAmount,
                    (SELECT Id, Product2.Name, Quantity, UnitPrice, Product2Id
                     FROM OrderItemSummaries
                     WHERE Type = 'Order Product')
                FROM OrderSummary
                WHERE AccountId = :buyerAccountId
                ORDER BY OrderedDate DESC, CreatedDate DESC
                LIMIT 200
            ];
        } else {
            Datetime earliestDate = System.now().addMonths(-normalizedMonthsBack);
            summaries = [
                SELECT Id, OrderNumber, OrderedDate, Status, GrandTotalAmount,
                    (SELECT Id, Product2.Name, Quantity, UnitPrice, Product2Id
                     FROM OrderItemSummaries
                     WHERE Type = 'Order Product')
                FROM OrderSummary
                WHERE AccountId = :buyerAccountId
                  AND OrderedDate >= :earliestDate
                ORDER BY OrderedDate DESC, CreatedDate DESC
                LIMIT 200
            ];
        }

        List<OrderSummaryRow> rows = new List<OrderSummaryRow>();
        for (OrderSummary summary : summaries) {
            OrderSummaryRow row = new OrderSummaryRow();
            row.id = summary.Id;
            row.orderNumber = summary.OrderNumber;
            row.orderedDate = summary.OrderedDate;
            row.status = summary.Status;
            row.grandTotalAmount = summary.GrandTotalAmount;

            row.lineItems = new List<OrderItemRow>();
            if (summary.OrderItemSummaries != null) {
                for (OrderItemSummary ois : summary.OrderItemSummaries) {
                    OrderItemRow item = new OrderItemRow();
                    item.id = ois.Id;
                    item.name = ois.Product2 != null ? ois.Product2.Name : '';
                    item.quantity = ois.Quantity;
                    item.unitPrice = ois.UnitPrice;
                    item.productId = ois.Product2Id;
                    row.lineItems.add(item);
                }
            }

            rows.add(row);
        }

        return rows;
    }

    private static Id resolveBuyerAccountId() {
        if (Test.isRunningTest() && buyerAccountIdOverride != null) {
            return buyerAccountIdOverride;
        }

        List<User> users = [
            SELECT Contact.AccountId
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

        if (users.isEmpty()) {
            return null;
        }

        return users[0].Contact != null ? users[0].Contact.AccountId : null;
    }

    @TestVisible
    private static void resetTestState() {
        buyerAccountIdOverride = null;
        orderRowsOverride = null;
    }
}