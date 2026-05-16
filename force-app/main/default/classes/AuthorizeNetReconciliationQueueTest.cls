@IsTest
private class AuthorizeNetReconciliationQueueTest {
    private class FailProvider implements AuthorizeNetReconciliationQueue.ResolutionProvider {
        public AuthorizeNetReconciliationQueue.ReconcileResult resolve(AuthorizeNet_Transaction__c txn) {
            return new AuthorizeNetReconciliationQueue.ReconcileResult(false, 'Simulated unresolved checkout/order linkage');
        }
    }

    private class SuccessProvider implements AuthorizeNetReconciliationQueue.ResolutionProvider {
        public AuthorizeNetReconciliationQueue.ReconcileResult resolve(AuthorizeNet_Transaction__c txn) {
            return new AuthorizeNetReconciliationQueue.ReconcileResult(true, 'Simulated recovered order linkage');
        }
    }

    private static AuthorizeNet_Transaction__c makeTxn(String suffix, Integer minutesAgo) {
        AuthorizeNet_Transaction__c txn = new AuthorizeNet_Transaction__c(
            NotificationId__c = 't6-notif-' + suffix,
            EventType__c = 'net.authorize.payment.authcapture.created',
            InvoiceNumber__c = '0a6Wj000000' + suffix,
            Processed__c = false,
            Payload__c = '{"eventType":"net.authorize.payment.authcapture.created"}',
            ProcessingError__c = null
        );
        insert txn;
        Test.setCreatedDate(txn.Id, System.now().addMinutes(-minutesAgo));
        return [SELECT Id, CreatedDate, Processed__c, ProcessingError__c FROM AuthorizeNet_Transaction__c WHERE Id = :txn.Id LIMIT 1];
    }

    @IsTest
    static void test_not_due_before_first_minute_skips() {
        AuthorizeNet_Transaction__c txn = makeTxn('A1', 0);
        AuthorizeNetReconciliationQueue.testProvider = new FailProvider();

        Test.startTest();
        AuthorizeNetReconciliationQueue.RunSummary summary = AuthorizeNetReconciliationQueue.runNow(50);
        Test.stopTest();

        txn = [SELECT Processed__c, ProcessingError__c FROM AuthorizeNet_Transaction__c WHERE Id = :txn.Id LIMIT 1];
        System.assertEquals(1, summary.evaluated, 'One record should be evaluated');
        System.assertEquals(1, summary.skipped, 'Record should be skipped before 1 minute');
        System.assertEquals(false, txn.Processed__c, 'Record remains unprocessed');
        System.assertEquals(null, txn.ProcessingError__c, 'No retry metadata yet before first due time');
    }

    @IsTest
    static void test_retry_cadence_and_manual_review_state() {
        AuthorizeNet_Transaction__c txn = makeTxn('B2', 16);
        AuthorizeNetReconciliationQueue.testProvider = new FailProvider();

        Test.startTest();
        AuthorizeNetReconciliationQueue.RunSummary run1 = AuthorizeNetReconciliationQueue.runNow(50);
        AuthorizeNetReconciliationQueue.RunSummary run2 = AuthorizeNetReconciliationQueue.runNow(50);
        AuthorizeNetReconciliationQueue.RunSummary run3 = AuthorizeNetReconciliationQueue.runNow(50);
        Test.stopTest();

        txn = [SELECT Processed__c, ProcessingError__c FROM AuthorizeNet_Transaction__c WHERE Id = :txn.Id LIMIT 1];

        System.assertEquals(1, run1.failed, 'First due run should attempt and fail');
        System.assertEquals(1, run2.failed, 'Second due run should attempt and fail');
        System.assertEquals(1, run3.failed, 'Third due run should attempt and fail');
        System.assertEquals(false, txn.Processed__c, 'Record should remain unprocessed after failed retries');
        System.assert(txn.ProcessingError__c != null && txn.ProcessingError__c.contains('"state":"MANUAL_REVIEW"'),
            'Record should transition to MANUAL_REVIEW after 3 failed attempts');
    }

    @IsTest
    static void test_recovered_marks_processed_and_idempotent() {
        AuthorizeNet_Transaction__c txn = makeTxn('C3', 6);
        AuthorizeNetReconciliationQueue.testProvider = new SuccessProvider();

        Test.startTest();
        AuthorizeNetReconciliationQueue.RunSummary run1 = AuthorizeNetReconciliationQueue.runNow(50);
        AuthorizeNetReconciliationQueue.RunSummary run2 = AuthorizeNetReconciliationQueue.runNow(50);
        Test.stopTest();

        txn = [SELECT Processed__c, ProcessingError__c FROM AuthorizeNet_Transaction__c WHERE Id = :txn.Id LIMIT 1];

        System.assertEquals(1, run1.processed, 'First run should mark record processed when reconciliation succeeds');
        System.assertEquals(0, run2.evaluated, 'Processed records must not be reprocessed (idempotent)');
        System.assertEquals(true, txn.Processed__c, 'Processed flag should be true after recovery');
        System.assert(txn.ProcessingError__c != null && txn.ProcessingError__c.contains('"state":"RESOLVED"'),
            'Metadata should reflect RESOLVED state');
    }

    @IsTest
    static void test_schedulable_execute_runs_without_error() {
        AuthorizeNet_Transaction__c txn = makeTxn('D4', 6);
        AuthorizeNetReconciliationQueue.testProvider = new SuccessProvider();

        Test.startTest();
        String jobId = System.schedule('t6-reconcile-' + System.now().getTime(), '0 0 0 1 1 ? 2099', new AuthorizeNetReconciliationQueue());
        System.assertNotEquals(null, jobId, 'Schedule should return a job id');
        new AuthorizeNetReconciliationQueue().execute(null);
        Test.stopTest();

        txn = [SELECT Processed__c FROM AuthorizeNet_Transaction__c WHERE Id = :txn.Id LIMIT 1];
        System.assertEquals(true, txn.Processed__c, 'Schedulable execute path should process eligible records');
    }

    @IsTest
    static void test_default_provider_missing_checkout_session_sets_retry() {
        AuthorizeNet_Transaction__c txn = makeTxn('E5', 16);
        AuthorizeNetReconciliationQueue.testProvider = null;

        Test.startTest();
        AuthorizeNetReconciliationQueue.RunSummary summary = AuthorizeNetReconciliationQueue.runNow(50);
        Test.stopTest();

        txn = [SELECT Processed__c, ProcessingError__c FROM AuthorizeNet_Transaction__c WHERE Id = :txn.Id LIMIT 1];
        System.assertEquals(1, summary.failed, 'Default provider should fail when checkout session cannot be found');
        System.assertEquals(false, txn.Processed__c, 'Unresolved records should remain unprocessed');
        System.assert(txn.ProcessingError__c != null && txn.ProcessingError__c.contains('No CartCheckoutSession found'),
            'Retry metadata should include missing checkout-session reason');
        System.assert(txn.ProcessingError__c.contains('"state":"RETRY_PENDING"'),
            'State should be RETRY_PENDING before retry exhaustion');
    }

    @IsTest
    static void test_try_authoritative_place_order_guardrail_messages() {
        AuthorizeNetReconciliationQueue.ReconcileResult nullSessionResult =
            AuthorizeNetReconciliationQueue.tryAuthoritativePlaceOrder(null);
        System.assertEquals(false, nullSessionResult.recovered, 'Null session cannot be recovered');
        System.assert(nullSessionResult.detail.contains('checkout session is null'),
            'Should return explicit null-session guardrail message');

        CartCheckoutSession s = new CartCheckoutSession();
        s.WebCart = new WebCart(WebStoreId = '0ZEam000004dJDNGA2');

        AuthorizeNetReconciliationQueue.ReconcileResult guardedResult =
            AuthorizeNetReconciliationQueue.tryAuthoritativePlaceOrder(s);
        System.assertEquals(false, guardedResult.recovered, 'Without a valid session the result should not be recovered');
        // In a test/scheduled context UserInfo.getSessionId() returns null, so the
        // method now surfaces a clear "session auth unavailable" message and directs
        // the operator to AdminCheckoutRecoveryController for manual recovery.
        // In a scheduled/async context getSessionId() returns null → 'session auth unavailable'.
        // In an interactive test context getSessionId() returns a live session → the recovery
        // service is called but fails because the unsaved CartCheckoutSession has no Id
        // → 'No CartCheckoutSession'. Both are valid failure outcomes for this guardrail.
        System.assert(
            guardedResult.detail.contains('session auth unavailable')
                || guardedResult.detail.contains('AdminCheckoutRecoveryController')
                || guardedResult.detail.contains('No CartCheckoutSession'),
            'Guardrail detail should explain the missing session and direct to manual recovery: ' + guardedResult.detail
        );

        CartCheckoutSession noStore = new CartCheckoutSession();
        noStore.WebCart = new WebCart();
        AuthorizeNetReconciliationQueue.ReconcileResult missingStoreResult =
            AuthorizeNetReconciliationQueue.tryAuthoritativePlaceOrder(noStore);
        System.assertEquals(false, missingStoreResult.recovered, 'Missing WebStoreId cannot be recovered');
        System.assert(missingStoreResult.detail.contains('missing WebStoreId'),
            'Guardrail should explicitly flag missing WebStoreId');
    }

    @IsTest
    static void test_runNow_skips_existing_manual_review_records() {
        AuthorizeNet_Transaction__c txn = new AuthorizeNet_Transaction__c(
            NotificationId__c = 't6-notif-manual-skip',
            EventType__c = 'net.authorize.payment.authcapture.created',
            InvoiceNumber__c = '0a6Wj000000MSKIP',
            Processed__c = false,
            Payload__c = '{"eventType":"net.authorize.payment.authcapture.created"}',
            ProcessingError__c = 'T6:{"attempt":3,"state":"MANUAL_REVIEW","updatedAt":"2026-04-19T00:00:00Z"}'
        );
        insert txn;

        Test.startTest();
        AuthorizeNetReconciliationQueue.RunSummary summary = AuthorizeNetReconciliationQueue.runNow(50);
        Test.stopTest();

        System.assertEquals(1, summary.evaluated, 'Record should be included in evaluated set');
        System.assertEquals(1, summary.skipped, 'Manual-review records should be skipped');
        System.assertEquals(1, summary.manualReview, 'Manual-review count should increment for skipped manual record');
    }

    @IsTest
    static void test_runNow_exhausted_attempt_forces_manual_review() {
        AuthorizeNet_Transaction__c txn = makeTxn('F6', 20);
        txn.ProcessingError__c = 'T6:{"attempt":3,"state":"RETRY_PENDING","updatedAt":"2026-04-19T00:00:00Z"}';
        update txn;

        Test.startTest();
        AuthorizeNetReconciliationQueue.RunSummary summary = AuthorizeNetReconciliationQueue.runNow(50);
        Test.stopTest();

        txn = [SELECT ProcessingError__c FROM AuthorizeNet_Transaction__c WHERE Id = :txn.Id LIMIT 1];
        System.assertEquals(1, summary.manualReview, 'Exhausted attempt path should move record to manual review');
        System.assert(txn.ProcessingError__c != null && txn.ProcessingError__c.contains('"state":"MANUAL_REVIEW"'),
            'State should be rewritten to MANUAL_REVIEW when attempts are exhausted');
    }

    @IsTest
    static void test_bootstrap_schedules_job() {
        Test.startTest();
        String jobId = AuthorizeNetReconciliationQueue.bootstrap();
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Bootstrap should return a scheduled job id');
    }
}