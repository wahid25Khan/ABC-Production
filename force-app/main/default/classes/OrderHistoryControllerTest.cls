@IsTest
private class OrderHistoryControllerTest {
    @IsTest
    static void getOrdersReturnsEmptyWhenNoBuyerAccountExists() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            OrderHistoryController.resetTestState();

            Test.startTest();
            List<OrderHistoryController.OrderSummaryRow> rows = OrderHistoryController.getOrders(6);
            Test.stopTest();

            System.assertEquals(0, rows.size());
        }
    }

    @IsTest
    static void getOrdersReturnsInjectedRowsForTests() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            OrderHistoryController.resetTestState();

            OrderHistoryController.OrderItemRow lineItem = new OrderHistoryController.OrderItemRow();
            lineItem.id = '10W000000000001AAA';
            lineItem.name = 'Georgia K-12 Standards Success Grade 2 ELA (Color)';
            lineItem.quantity = 24;
            lineItem.unitPrice = 44.00;
            lineItem.productId = '01t000000000001AAA';

            OrderHistoryController.OrderSummaryRow row = new OrderHistoryController.OrderSummaryRow();
            row.id = '801000000000001AAA';
            row.orderNumber = '000123';
            row.orderedDate = System.now();
            row.status = 'Activated';
            row.grandTotalAmount = 41;
            row.lineItems = new List<OrderHistoryController.OrderItemRow>{ lineItem };

            OrderHistoryController.orderRowsOverride = new List<OrderHistoryController.OrderSummaryRow>{ row };

            Test.startTest();
            List<OrderHistoryController.OrderSummaryRow> rows = OrderHistoryController.getOrders(null);
            Test.stopTest();

            System.assertEquals(1, rows.size());
            System.assertEquals('000123', rows[0].orderNumber);
            System.assertEquals('Activated', rows[0].status);
            System.assertEquals(41, rows[0].grandTotalAmount);
            System.assertEquals(1, rows[0].lineItems.size());
            System.assertEquals('Georgia K-12 Standards Success Grade 2 ELA (Color)', rows[0].lineItems[0].name);
            System.assertEquals(24, rows[0].lineItems[0].quantity);
            System.assertEquals(44.00, rows[0].lineItems[0].unitPrice);
            System.assertEquals('01t000000000001AAA', rows[0].lineItems[0].productId);
        }
    }

    @IsTest
    static void getOrdersReturnsEmptyWhenBuyerAccountHasNoOrders() {
        User runAsUser = createRunAsUser();
        Account account = new Account(Name = 'Order History Test Account');
        insert account;

        System.runAs(runAsUser) {
            OrderHistoryController.resetTestState();
            OrderHistoryController.buyerAccountIdOverride = account.Id;

            Test.startTest();
            List<OrderHistoryController.OrderSummaryRow> rows = OrderHistoryController.getOrders(12);
            Test.stopTest();

            System.assertEquals(0, rows.size());
        }
    }

    @IsTest
    static void getOrdersReturnsEmptyForAllOrdersQueryWhenNoRecordsExist() {
        User runAsUser = createRunAsUser();
        Account account = new Account(Name = 'All Orders Query Account');
        insert account;

        System.runAs(runAsUser) {
            OrderHistoryController.resetTestState();
            OrderHistoryController.buyerAccountIdOverride = account.Id;

            Test.startTest();
            List<OrderHistoryController.OrderSummaryRow> rows = OrderHistoryController.getOrders(null);
            Test.stopTest();

            System.assertEquals(0, rows.size());
        }
    }

    @IsTest
    static void getOrdersTreatsNonPositiveMonthsAsAllOrders() {
        User runAsUser = createRunAsUser();
        Account account = new Account(Name = 'Non Positive Months Account');
        insert account;

        System.runAs(runAsUser) {
            OrderHistoryController.resetTestState();
            OrderHistoryController.buyerAccountIdOverride = account.Id;

            Test.startTest();
            List<OrderHistoryController.OrderSummaryRow> rows = OrderHistoryController.getOrders(0);
            Test.stopTest();

            System.assertEquals(0, rows.size());
        }
    }

    private static User createRunAsUser() {
        String uniqueToken = String.valueOf(System.currentTimeMillis());
        User runAsUser = new User(
            Alias = 'ordhist',
            Email = 'order.history.' + uniqueToken + '@example.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Runner',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Chicago',
            Username = 'order.history.' + uniqueToken + '@example.test'
        );
        insert runAsUser;
        return runAsUser;
    }
}