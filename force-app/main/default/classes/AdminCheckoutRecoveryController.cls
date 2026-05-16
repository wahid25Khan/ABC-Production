public with sharing class AdminCheckoutRecoveryController {
    public class AccessDecision {
        public Boolean allowed;
        public String message;
    }

    public interface AccessEvaluator {
        AccessDecision evaluate();
    }

    public interface RecoveryExecutor {
        AuthenticatedBuyerAdminRecoveryService.RecoveryResult run(String checkoutSessionId);
    }

    private class DefaultAccessEvaluator implements AccessEvaluator {
        public AccessDecision evaluate() {
            AccessDecision decision = new AccessDecision();
            List<User> users = [
                SELECT Id, IsPortalEnabled, Profile.PermissionsModifyAllData, Profile.PermissionsViewSetup
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];

            if (users.isEmpty()) {
                decision.allowed = false;
                decision.message = 'Current user context could not be verified.';
                return decision;
            }

            User currentUser = users[0];
            Boolean hasAdminAccess = !currentUser.IsPortalEnabled
                && currentUser.Profile != null
                && (currentUser.Profile.PermissionsModifyAllData || currentUser.Profile.PermissionsViewSetup);

            decision.allowed = hasAdminAccess;
            decision.message = hasAdminAccess
                ? null
                : 'This recovery tool is restricted to internal admin users.';
            return decision;
        }
    }

    private class DefaultRecoveryExecutor implements RecoveryExecutor {
        public AuthenticatedBuyerAdminRecoveryService.RecoveryResult run(String checkoutSessionId) {
            return AuthenticatedBuyerAdminRecoveryService.recoverAuthenticatedBuyerCheckout(checkoutSessionId);
        }
    }

    @TestVisible private static AccessEvaluator accessEvaluator = new DefaultAccessEvaluator();
    @TestVisible private static RecoveryExecutor recoveryExecutor = new DefaultRecoveryExecutor();

    public String checkoutSessionId { get; set; }
    public AuthenticatedBuyerAdminRecoveryService.RecoveryResult result { get; private set; }
    public String errorMessage { get; private set; }
    public Boolean attempted { get; private set; }

    public PageReference runRecovery() {
        attempted = true;
        errorMessage = null;
        result = null;

        AccessDecision decision = accessEvaluator.evaluate();
        if (decision == null || !decision.allowed) {
            errorMessage = decision != null && String.isNotBlank(decision.message)
                ? decision.message
                : 'This recovery tool is restricted to internal admin users.';
            return null;
        }

        if (String.isBlank(checkoutSessionId)) {
            errorMessage = 'Checkout Session Id is required.';
            return null;
        }

        try {
            result = recoveryExecutor.run(checkoutSessionId.trim());
            if (result == null) {
                errorMessage = 'No recovery result was returned.';
            }
        } catch (Exception ex) {
            errorMessage = ex.getMessage();
        }

        return null;
    }

    public Boolean getHasError() {
        return String.isNotBlank(errorMessage);
    }

    public Boolean getHasResult() {
        return result != null;
    }

    public String getResultSuccess() {
        return result != null ? String.valueOf(result.success) : null;
    }

    public String getResultDuplicateDetected() {
        return result != null ? String.valueOf(result.duplicateDetected) : null;
    }

    public String getResultMessage() {
        return result != null ? result.message : null;
    }

    public String getResultCheckoutSessionId() {
        return result != null ? String.valueOf(result.checkoutSessionId) : null;
    }

    public String getResultEffectiveAccountId() {
        return result != null ? String.valueOf(result.effectiveAccountId) : null;
    }

    public String getResultOrderId() {
        return result != null ? String.valueOf(result.orderId) : null;
    }

    public String getResultOrderReferenceNumber() {
        return result != null ? result.orderReferenceNumber : null;
    }

    @TestVisible
    private static void resetTestState() {
        accessEvaluator = new DefaultAccessEvaluator();
        recoveryExecutor = new DefaultRecoveryExecutor();
    }
}