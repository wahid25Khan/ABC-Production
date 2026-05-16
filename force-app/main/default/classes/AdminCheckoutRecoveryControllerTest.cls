@IsTest
private class AdminCheckoutRecoveryControllerTest {
    private static String sampleCheckoutSessionId() {
        return '2z9Wj000000hRD3IAM';
    }

    private static User currentUser() {
        return [SELECT Id FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
    }

    private class AllowAccessEvaluator implements AdminCheckoutRecoveryController.AccessEvaluator {
        /** test stub */
        public AdminCheckoutRecoveryController.AccessDecision evaluate() {
            AdminCheckoutRecoveryController.AccessDecision decision =
                new AdminCheckoutRecoveryController.AccessDecision();
            decision.allowed = true;
            return decision;
        }
    }

    private class DenyAccessEvaluator implements AdminCheckoutRecoveryController.AccessEvaluator {
        /** test stub */
        public AdminCheckoutRecoveryController.AccessDecision evaluate() {
            AdminCheckoutRecoveryController.AccessDecision decision =
                new AdminCheckoutRecoveryController.AccessDecision();
            decision.allowed = false;
            decision.message = 'Blocked for test';
            return decision;
        }
    }

    private class NullAccessEvaluator implements AdminCheckoutRecoveryController.AccessEvaluator {
        /** test stub */
        public AdminCheckoutRecoveryController.AccessDecision evaluate() {
            return null;
        }
    }

    private class SuccessExecutor implements AdminCheckoutRecoveryController.RecoveryExecutor {
        /** test stub */
        public AuthenticatedBuyerAdminRecoveryService.RecoveryResult run(String checkoutSessionId) {
            AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
                new AuthenticatedBuyerAdminRecoveryService.RecoveryResult();
            result.success = true;
            result.duplicateDetected = false;
            result.checkoutSessionId = (Id) checkoutSessionId;
            result.effectiveAccountId = (Id) '001Wj000017nncaIAA';
            result.orderId = (Id) '801Wj0000000009IAA';
            result.orderReferenceNumber = 'REF-SUCCESS';
            result.message = 'ok';
            return result;
        }
    }

    private class NullExecutor implements AdminCheckoutRecoveryController.RecoveryExecutor {
        /** test stub */
        public AuthenticatedBuyerAdminRecoveryService.RecoveryResult run(String checkoutSessionId) {
            return null;
        }
    }

    private class ThrowingExecutor implements AdminCheckoutRecoveryController.RecoveryExecutor {
        /** test stub */
        public AuthenticatedBuyerAdminRecoveryService.RecoveryResult run(String checkoutSessionId) {
            throw new AuraHandledException('Boom');
        }
    }

    @IsTest
    static void testBlocksNonAdminAccess() {
        System.runAs(currentUser()) {
            AdminCheckoutRecoveryController.accessEvaluator = new DenyAccessEvaluator();
            AdminCheckoutRecoveryController controller = new AdminCheckoutRecoveryController();
            controller.checkoutSessionId = sampleCheckoutSessionId();

            Test.startTest();
            controller.runRecovery();
            Test.stopTest();

            System.assertEquals(true, controller.getHasError(), 'Blocked access should render an error.');
            System.assertEquals('Blocked for test', controller.errorMessage);
            System.assertEquals(false, controller.getHasResult(), 'Blocked access should not return a result.');

            AdminCheckoutRecoveryController.resetTestState();
        }
    }

    @IsTest
    static void testRequiresCheckoutSessionId() {
        System.runAs(currentUser()) {
            AdminCheckoutRecoveryController.accessEvaluator = new AllowAccessEvaluator();
            AdminCheckoutRecoveryController controller = new AdminCheckoutRecoveryController();

            Test.startTest();
            controller.runRecovery();
            Test.stopTest();

            System.assertEquals(true, controller.getHasError(), 'Blank input should render an error.');
            System.assertEquals('Checkout Session Id is required.', controller.errorMessage);

            AdminCheckoutRecoveryController.resetTestState();
        }
    }

    @IsTest
    static void testRendersSuccessResult() {
        System.runAs(currentUser()) {
            AdminCheckoutRecoveryController.accessEvaluator = new AllowAccessEvaluator();
            AdminCheckoutRecoveryController.recoveryExecutor = new SuccessExecutor();
            AdminCheckoutRecoveryController controller = new AdminCheckoutRecoveryController();
            controller.checkoutSessionId = sampleCheckoutSessionId();

            Test.startTest();
            controller.runRecovery();
            Test.stopTest();

            System.assertEquals(false, controller.getHasError(), 'Successful execution should not render an error.');
            System.assertEquals(true, controller.getHasResult(), 'Successful execution should render a result.');
            System.assertEquals(true, controller.result.success);
            System.assertEquals('true', controller.getResultSuccess());
            System.assertEquals('false', controller.getResultDuplicateDetected());
            System.assertEquals('ok', controller.getResultMessage());
            System.assertEquals(sampleCheckoutSessionId(), controller.getResultCheckoutSessionId());
            System.assertEquals('001Wj000017nncaIAA', controller.getResultEffectiveAccountId());
            System.assertEquals('801Wj0000000009IAA', controller.getResultOrderId());
            System.assertEquals('REF-SUCCESS', controller.getResultOrderReferenceNumber());

            AdminCheckoutRecoveryController.resetTestState();
        }
    }

    @IsTest
    static void testHandlesNullResult() {
        System.runAs(currentUser()) {
            AdminCheckoutRecoveryController.accessEvaluator = new AllowAccessEvaluator();
            AdminCheckoutRecoveryController.recoveryExecutor = new NullExecutor();

            AdminCheckoutRecoveryController controller = new AdminCheckoutRecoveryController();
            controller.checkoutSessionId = sampleCheckoutSessionId();

            Test.startTest();
            controller.runRecovery();
            Test.stopTest();

            System.assertEquals('No recovery result was returned.', controller.errorMessage);
            System.assertEquals(null, controller.getResultSuccess());

            AdminCheckoutRecoveryController.resetTestState();
        }
    }

    @IsTest
    static void testHandlesThrownException() {
        System.runAs(currentUser()) {
            AdminCheckoutRecoveryController.accessEvaluator = new AllowAccessEvaluator();
            AdminCheckoutRecoveryController.recoveryExecutor = new ThrowingExecutor();

            AdminCheckoutRecoveryController controller = new AdminCheckoutRecoveryController();
            controller.checkoutSessionId = sampleCheckoutSessionId();

            Test.startTest();
            controller.runRecovery();
            Test.stopTest();

            System.assertEquals(true, controller.getHasError(), 'Exceptions should be surfaced as an error.');
            System.assertEquals('Script-thrown exception', controller.errorMessage);

            AdminCheckoutRecoveryController.resetTestState();
        }
    }

    @IsTest
    static void testHandlesNullAccessDecision() {
        System.runAs(currentUser()) {
            AdminCheckoutRecoveryController.accessEvaluator = new NullAccessEvaluator();
            AdminCheckoutRecoveryController controller = new AdminCheckoutRecoveryController();
            controller.checkoutSessionId = sampleCheckoutSessionId();

            Test.startTest();
            controller.runRecovery();
            Test.stopTest();

            System.assertEquals('This recovery tool is restricted to internal admin users.', controller.errorMessage);

            AdminCheckoutRecoveryController.resetTestState();
        }
    }

    @IsTest
    static void testUsesDefaultEvaluatorAndExecutor() {
        System.runAs(currentUser()) {
            AdminCheckoutRecoveryController.resetTestState();
            AdminCheckoutRecoveryController controller = new AdminCheckoutRecoveryController();
            controller.checkoutSessionId = 'not-a-salesforce-id';

            Test.startTest();
            controller.runRecovery();
            Test.stopTest();

            System.assertEquals(true, controller.getHasResult(), 'Default executor should still return a failure result object.');
            System.assertEquals('false', controller.getResultSuccess());
            System.assert(String.isNotBlank(controller.getResultMessage()), 'Default executor should surface a message from the recovery service.');

            AdminCheckoutRecoveryController.resetTestState();
        }
    }
}