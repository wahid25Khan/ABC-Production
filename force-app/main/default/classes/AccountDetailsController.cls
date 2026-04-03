@SuppressWarnings('PMD.ApexCRUDViolation')
/**
 * Provides the Account Details page data and mutations for the authenticated storefront user.
 */
public with sharing class AccountDetailsController {
    private static final String PASSWORD_SUCCESS_MESSAGE = 'Your password has been updated.';
    private static final String PROFILE_SUCCESS_MESSAGE = 'Your account details have been updated.';
    private static final String ORGANIZATION_SUCCESS_MESSAGE = 'Your organization details have been updated.';
    private static final String DEFAULT_PAYMENT_MESSAGE = 'No payment on file.';

    /** Wrapper returned to the LWC for current account details. */
    public class AccountDetailsResult {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String fullName;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String organizationName;
        @AuraEnabled public Boolean hasOrganization;
        @AuraEnabled public String shippingAddress;
        @AuraEnabled public Boolean hasShippingAddress;
        @AuraEnabled public String paymentSummary;
        @AuraEnabled public Boolean hasPaymentMethods;
    }

    /** Standard mutation response wrapper for the page. */
    public class ActionResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public String redirectUrl;
        @AuraEnabled public AccountDetailsResult details;
    }

    /**
     * Returns the current user's account details.
     *
     * @return The account details shown on the page.
     */
    @AuraEnabled(cacheable=true)
    public static AccountDetailsResult getAccountDetails() {
        return buildAccountDetails();
    }

    /**
     * Updates the current user's basic profile fields.
     *
     * @param firstName Updated first name.
     * @param lastName Updated last name.
     * @param email Updated email address.
     * @param phone Updated phone number.
     * @return Mutation result and refreshed account details.
     */
    @AuraEnabled
    public static ActionResult updateAboutYou(
        String firstName,
        String lastName,
        String email,
        String phone
    ) {
        if (String.isBlank(firstName) || String.isBlank(lastName)) {
            return errorResult('First and last name are required.');
        }
        if (!isValidEmail(email)) {
            return errorResult('Please enter a valid email address.');
        }

        User userToUpdate = new User(
            Id = UserInfo.getUserId(),
            FirstName = firstName.trim(),
            LastName = lastName.trim(),
            Email = email.trim(),
            Phone = String.isBlank(phone) ? null : phone.trim()
        );
        update userToUpdate;

        return successResult(PROFILE_SUCCESS_MESSAGE);
    }

    /**
     * Updates the current user's related organization name when an account is available.
     *
     * @param organizationName Updated organization/account name.
     * @return Mutation result and refreshed account details.
     */
    @AuraEnabled
    public static ActionResult updateOrganization(String organizationName) {
        if (String.isBlank(organizationName)) {
            return errorResult('Please enter an organization name.');
        }

        User currentUser = [
            SELECT Contact.AccountId
            FROM User
            WHERE Id = :UserInfo.getUserId()
            WITH USER_MODE
            LIMIT 1
        ];

        Id accountId = currentUser.Contact != null ? currentUser.Contact.AccountId : null;
        if (accountId == null) {
            return errorResult('No organization is available for this account.');
        }

        update new Account(
            Id = accountId,
            Name = organizationName.trim()
        );

        return successResult(ORGANIZATION_SUCCESS_MESSAGE);
    }

    /**
     * Changes the current user's password.
     *
     * @param currentPassword The current password.
     * @param newPassword The new password.
     * @param confirmPassword The confirmation password.
     * @return Mutation result and refreshed account details.
     */
    @AuraEnabled
    public static ActionResult changePassword(
        String currentPassword,
        String newPassword,
        String confirmPassword
    ) {
        if (String.isBlank(currentPassword)) {
            return errorResult('Current password is required.');
        }
        if (String.isBlank(newPassword) || String.isBlank(confirmPassword)) {
            return errorResult('Please complete all password fields.');
        }
        if (newPassword != confirmPassword) {
            return errorResult('New password and confirm password must match.');
        }

        if (!Test.isRunningTest()) {
            Site.changePassword(newPassword, confirmPassword, currentPassword);
        }

        return successResult(PASSWORD_SUCCESS_MESSAGE);
    }

    private static AccountDetailsResult buildAccountDetails() {
        User currentUser = [
            SELECT
                FirstName,
                LastName,
                Email,
                Phone,
                Street,
                City,
                State,
                PostalCode,
                Country,
                Contact.AccountId,
                Contact.FirstName,
                Contact.LastName,
                Contact.Email,
                Contact.Phone,
                Contact.MobilePhone,
                Contact.Account.Name
            FROM User
            WHERE Id = :UserInfo.getUserId()
            WITH USER_MODE
            LIMIT 1
        ];

        AccountDetailsResult result = new AccountDetailsResult();
        String contactFirstName = currentUser.Contact != null ? safeString(currentUser.Contact.FirstName) : '';
        String contactLastName = currentUser.Contact != null ? safeString(currentUser.Contact.LastName) : '';
        String contactEmail = currentUser.Contact != null ? safeString(currentUser.Contact.Email) : '';
        String contactPhone = currentUser.Contact != null ? safeString(currentUser.Contact.Phone) : '';
        String contactMobilePhone = currentUser.Contact != null ? safeString(currentUser.Contact.MobilePhone) : '';

        result.firstName = coalesceStrings(new List<String>{
            safeString(currentUser.FirstName),
            contactFirstName
        });
        result.lastName = coalesceStrings(new List<String>{
            safeString(currentUser.LastName),
            contactLastName
        });
        result.fullName = buildFullName(result.firstName, result.lastName);
        result.email = coalesceStrings(new List<String>{
            safeString(currentUser.Email),
            contactEmail
        });
        result.phone = coalesceStrings(new List<String>{
            safeString(currentUser.Phone),
            contactPhone,
            contactMobilePhone
        });
        result.organizationName = currentUser.Contact != null && currentUser.Contact.Account != null
            ? safeString(currentUser.Contact.Account.Name)
            : '';
        result.hasOrganization = String.isNotBlank(result.organizationName);
        result.shippingAddress = buildAddressSummary(currentUser);
        result.hasShippingAddress = String.isNotBlank(result.shippingAddress);
        result.paymentSummary = DEFAULT_PAYMENT_MESSAGE;
        result.hasPaymentMethods = false;
        return result;
    }

    private static String buildFullName(String firstName, String lastName) {
        List<String> nameParts = new List<String>();
        if (String.isNotBlank(firstName)) {
            nameParts.add(firstName);
        }
        if (String.isNotBlank(lastName)) {
            nameParts.add(lastName);
        }
        return String.join(nameParts, ' ');
    }

    private static String buildAddressSummary(User currentUser) {
        List<String> streetLines = new List<String>();
        if (String.isNotBlank(currentUser.Street)) {
            streetLines.add(currentUser.Street.trim());
        }

        List<String> cityLineParts = new List<String>();
        if (String.isNotBlank(currentUser.City)) {
            cityLineParts.add(currentUser.City.trim());
        }
        if (String.isNotBlank(currentUser.State)) {
            cityLineParts.add(currentUser.State.trim());
        }
        if (String.isNotBlank(currentUser.PostalCode)) {
            cityLineParts.add(currentUser.PostalCode.trim());
        }
        if (!cityLineParts.isEmpty()) {
            streetLines.add(String.join(cityLineParts, ', '));
        }
        if (String.isNotBlank(currentUser.Country)) {
            streetLines.add(currentUser.Country.trim());
        }

        return String.join(streetLines, ' • ');
    }

    @TestVisible
    private static String coalesceStrings(List<String> values) {
        for (String value : values) {
            if (String.isNotBlank(value)) {
                return value.trim();
            }
        }
        return '';
    }

    private static Boolean isValidEmail(String email) {
        String normalized = safeString(email);
        return normalized.contains('@') && normalized.substringAfter('@').contains('.');
    }

    private static String safeString(String value) {
        return value == null ? '' : value.trim();
    }

    private static ActionResult successResult(String message) {
        ActionResult result = new ActionResult();
        result.success = true;
        result.message = message;
        result.details = buildAccountDetails();
        return result;
    }

    private static ActionResult errorResult(String message) {
        ActionResult result = new ActionResult();
        result.success = false;
        result.message = message;
        result.details = buildAccountDetails();
        return result;
    }
}
