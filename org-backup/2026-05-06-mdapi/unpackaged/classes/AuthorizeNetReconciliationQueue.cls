public with sharing class AuthorizeNetReconciliationQueue implements Schedulable {
    private static final String META_PREFIX = 'T6:';
    private static final String JOB_PREFIX = 'AuthorizeNetReconciliationQueue_';
    private static final List<Integer> RETRY_MINUTES = new List<Integer>{ 1, 5, 15 };
    private static final Integer DEFAULT_BATCH_SIZE = 200;

    public class RunSummary {
        public Integer evaluated = 0;
        public Integer processed = 0;
        public Integer skipped = 0;
        public Integer failed = 0;
        public Integer manualReview = 0;
    }

    public class ReconcileResult {
        public Boolean recovered;
        public String detail;
        public ReconcileResult(Boolean recovered, String detail) {
            this.recovered = recovered;
            this.detail = detail;
        }
    }

    public interface ResolutionProvider {
        ReconcileResult resolve(AuthorizeNet_Transaction__c txn);
    }

    private class DefaultResolutionProvider implements ResolutionProvider {
        public ReconcileResult resolve(AuthorizeNet_Transaction__c txn) {
            if (String.isBlank(txn.InvoiceNumber__c)) {
                return new ReconcileResult(false, 'InvoiceNumber__c is blank; cannot map webhook to cart session.');
            }

            List<CartCheckoutSession> sessions = [
                SELECT Id, WebCartId, WebCart.WebStoreId, State, OrderId, OrderReferenceNumber, CreatedDate
                FROM CartCheckoutSession
                WHERE WebCartId = :txn.InvoiceNumber__c
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];

            if (sessions.isEmpty()) {
                return new ReconcileResult(false, 'No CartCheckoutSession found for invoice/cart reference: ' + txn.InvoiceNumber__c);
            }

            CartCheckoutSession s = sessions[0];
            if (s.OrderId != null) {
                return new ReconcileResult(true, 'Recovered via CartCheckoutSession.OrderId=' + s.OrderId);
            }

            if (String.isNotBlank(s.OrderReferenceNumber)) {
                List<Order> orders = [
                    SELECT Id, OrderNumber, OrderReferenceNumber, SalesStoreId
                    FROM Order
                    WHERE OrderReferenceNumber = :s.OrderReferenceNumber
                    ORDER BY CreatedDate DESC
                    LIMIT 1
                ];
                if (!orders.isEmpty()) {
                    return new ReconcileResult(true, 'Recovered via OrderReferenceNumber=' + s.OrderReferenceNumber + ', OrderId=' + orders[0].Id);
                }
            }

            // Ticket 7 guardrail: only attempt automatic recovery if we can invoke the
            // same authoritative storefront order-placement endpoint used by checkoutFlow
            // (/commerce/webstores/{webStoreId}/checkouts/{checkoutId}/orders).
            ReconcileResult placeOrderAttempt = tryAuthoritativePlaceOrder(s);
            if (placeOrderAttempt.recovered) {
                return placeOrderAttempt;
            }
            return placeOrderAttempt;
        }
    }

    @TestVisible
    private static ResolutionProvider testProvider;

    /**
     * Bootstraps the lightweight reconciliation heartbeat.
     * Aborts any existing queued jobs for this worker, then schedules a single
     * concrete run one minute from now. Each execution re-schedules the next run.
     */
    public static String bootstrap() {
        abortExistingJobs();
        return scheduleAt(System.now().addMinutes(1));
    }

    public void execute(SchedulableContext sc) {
        runNow(DEFAULT_BATCH_SIZE);
        if (!Test.isRunningTest()) {
            scheduleAt(System.now().addMinutes(1));
        }
    }

    public static RunSummary runNow(Integer batchSize) {
        Integer effectiveBatchSize = (batchSize == null || batchSize <= 0) ? DEFAULT_BATCH_SIZE : batchSize;
        RunSummary summary = new RunSummary();
        Datetime nowDt = System.now();

        List<AuthorizeNet_Transaction__c> candidates = [
            SELECT Id, CreatedDate, EventType__c, InvoiceNumber__c, Processed__c, ProcessingError__c, TransactionId__c, NotificationId__c
            FROM AuthorizeNet_Transaction__c
            WHERE Processed__c = false
              AND EventType__c = 'net.authorize.payment.authcapture.created'
            ORDER BY CreatedDate ASC
            LIMIT :effectiveBatchSize
        ];

        if (candidates.isEmpty()) {
            return summary;
        }

        summary.evaluated = candidates.size();

        ResolutionProvider provider = (Test.isRunningTest() && testProvider != null)
            ? testProvider
            : new DefaultResolutionProvider();

        List<AuthorizeNet_Transaction__c> updates = new List<AuthorizeNet_Transaction__c>();

        for (AuthorizeNet_Transaction__c txn : candidates) {
            RetryMeta meta = parseMeta(txn.ProcessingError__c);

            if ('MANUAL_REVIEW'.equals(meta.state)) {
                summary.skipped++;
                summary.manualReview++;
                continue;
            }

            if (meta.attempt >= RETRY_MINUTES.size()) {
                txn.ProcessingError__c = formatMeta(meta.attempt, 'MANUAL_REVIEW', meta.lastError, nowDt, null);
                updates.add(txn);
                summary.manualReview++;
                continue;
            }

            Integer elapsedMinutes = Integer.valueOf(Math.floor((nowDt.getTime() - txn.CreatedDate.getTime()) / 60000));
            Integer dueAt = RETRY_MINUTES[meta.attempt];
            if (elapsedMinutes < dueAt) {
                summary.skipped++;
                continue;
            }

            Integer nextAttempt = meta.attempt + 1;
            ReconcileResult rr = provider.resolve(txn);

            if (rr.recovered == true) {
                txn.Processed__c = true;
                txn.ProcessingError__c = formatMeta(nextAttempt, 'RESOLVED', rr.detail, nowDt, null);
                updates.add(txn);
                summary.processed++;
                continue;
            }

            summary.failed++;
            if (nextAttempt >= RETRY_MINUTES.size()) {
                txn.ProcessingError__c = formatMeta(nextAttempt, 'MANUAL_REVIEW', rr.detail, nowDt, null);
                updates.add(txn);
                summary.manualReview++;
            } else {
                Datetime nextRetryAt = txn.CreatedDate.addMinutes(RETRY_MINUTES[nextAttempt]);
                txn.ProcessingError__c = formatMeta(nextAttempt, 'RETRY_PENDING', rr.detail, nowDt, nextRetryAt);
                updates.add(txn);
            }
        }

        if (!updates.isEmpty()) {
            update updates;
        }

        return summary;
    }

    private class RetryMeta {
        Integer attempt;
        String state;
        String lastError;
        RetryMeta(Integer attempt, String state, String lastError) {
            this.attempt = attempt;
            this.state = state;
            this.lastError = lastError;
        }
    }

    @TestVisible
    private static ReconcileResult tryAuthoritativePlaceOrder(CartCheckoutSession checkoutSession) {
        if (checkoutSession == null) {
            return new ReconcileResult(false, 'Cannot place order: checkout session is null.');
        }

        String webStoreId = checkoutSession.WebCart != null
            ? String.valueOf(checkoutSession.WebCart.WebStoreId)
            : null;
        if (String.isBlank(webStoreId)) {
            return new ReconcileResult(false, 'Cannot place order: missing WebStoreId on related cart.');
        }

        // A valid session is required to call the authoritative checkout/orders endpoint.
        // In a scheduled/queued context this is usually null — in that case we cannot
        // auto-recover and must wait for an admin to run AdminCheckoutRecoveryController.
        String sessionId = UserInfo.getSessionId();
        if (String.isBlank(sessionId)) {
            return new ReconcileResult(false,
                'Cannot auto-place order: session auth unavailable in scheduled context. '
                + 'Use AdminCheckoutRecoveryController to recover manually.');
        }

        // Attempt recovery through the authenticated buyer recovery service, which uses
        // the same authoritative checkout/orders endpoint as the buyer checkout flow.
        try {
            AuthenticatedBuyerAdminRecoveryService.RecoveryResult result =
                AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(
                    String.valueOf(checkoutSession.Id)
                );
            if (result == null) {
                return new ReconcileResult(false, 'Recovery service returned a null result.');
            }
            if (result.success) {
                return new ReconcileResult(true,
                    'Recovered via AuthenticatedBuyerAdminRecoveryService.'
                    + ' OrderId=' + result.orderId
                    + (result.duplicateDetected ? ' (duplicate detected — order already existed)' : ''));
            }
            return new ReconcileResult(false, result.message);
        } catch (Exception ex) {
            return new ReconcileResult(false, 'Recovery attempt threw exception: ' + ex.getMessage());
        }
    }

    private static RetryMeta parseMeta(String raw) {
        if (String.isBlank(raw) || !raw.startsWith(META_PREFIX)) {
            return new RetryMeta(0, 'PENDING', null);
        }
        try {
            String jsonPart = raw.substring(META_PREFIX.length());
            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(jsonPart);
            Integer attempt = parsed.containsKey('attempt') && parsed.get('attempt') != null
                ? Integer.valueOf(String.valueOf(parsed.get('attempt')))
                : 0;
            String state = parsed.containsKey('state')
                ? String.valueOf(parsed.get('state'))
                : 'PENDING';
            String lastError = parsed.containsKey('lastError')
                ? String.valueOf(parsed.get('lastError'))
                : null;
            return new RetryMeta(attempt, state, lastError);
        } catch (Exception ex) {
            return new RetryMeta(0, 'PENDING', null);
        }
    }

    private static String formatMeta(Integer attempt, String state, String lastError, Datetime updatedAt, Datetime nextRetryAt) {
        Map<String, Object> payload = new Map<String, Object>{
            'ticket' => 'T6',
            'attempt' => attempt,
            'state' => state,
            'updatedAt' => updatedAt.formatGMT('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'')
        };
        if (String.isNotBlank(lastError)) {
            payload.put('lastError', lastError);
        }
        if (nextRetryAt != null) {
            payload.put('nextRetryAt', nextRetryAt.formatGMT('yyyy-MM-dd\'T\'HH:mm:ss\'Z\''));
        }
        return META_PREFIX + JSON.serialize(payload);
    }

    @TestVisible
    private static void abortExistingJobs() {
        List<CronTrigger> jobs = [
            SELECT Id, CronJobDetail.Name, State
            FROM CronTrigger
            WHERE CronJobDetail.Name LIKE :(JOB_PREFIX + '%')
              AND State IN ('WAITING', 'ACQUIRED')
        ];
        for (CronTrigger ct : jobs) {
            try {
                System.abortJob(ct.Id);
            } catch (Exception ex) {
                // best-effort cleanup
            }
        }
    }

    @TestVisible
    private static String scheduleAt(Datetime dt) {
        Datetime target = dt == null ? System.now().addMinutes(1) : dt;
        Integer sec = target.second();
        Integer min = target.minute();
        Integer hour = target.hour();
        Integer day = target.day();
        Integer month = target.month();
        Integer year = target.year();

        String cronExpr =
            String.valueOf(sec) + ' ' +
            String.valueOf(min) + ' ' +
            String.valueOf(hour) + ' ' +
            String.valueOf(day) + ' ' +
            String.valueOf(month) + ' ? ' +
            String.valueOf(year);

        String jobName = JOB_PREFIX + target.getTime();
        return System.schedule(jobName, cronExpr, new AuthorizeNetReconciliationQueue());
    }
}