@SuppressWarnings('PMD.ApexCRUDViolation')
/**
 * Provides the Account Details page data and mutations for the authenticated storefront user.
 */
public with sharing class AccountDetailsController {
    private static final String PASSWORD_SUCCESS_MESSAGE = 'Your password has been updated.';
    private static final String PROFILE_SUCCESS_MESSAGE = 'Your account details have been updated.';
    private static final String ORGANIZATION_SUCCESS_MESSAGE = 'Your organization details have been updated.';
    private static final String PAYMENT_SUCCESS_MESSAGE = 'Payment method saved successfully.';
    private static final String DEFAULT_PAYMENT_MESSAGE = 'No payment on file.';
    @TestVisible private static Id testAccountIdOverride;

    /** Wrapper returned to the LWC for current account details. */
    public class AccountDetailsResult {
        @AuraEnabled public String firstName;
        @AuraEnabled public String lastName;
        @AuraEnabled public String fullName;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String organizationName;
        @AuraEnabled public Boolean hasOrganization;
        @AuraEnabled public String organizationPhone;
        @AuraEnabled public String billingStreet;
        @AuraEnabled public String billingCity;
        @AuraEnabled public String billingState;
        @AuraEnabled public String billingPostalCode;
        @AuraEnabled public String shippingAddress;
        @AuraEnabled public Boolean hasShippingAddress;
        @AuraEnabled public String shippingStreet;
        @AuraEnabled public String shippingCity;
        @AuraEnabled public String shippingState;
        @AuraEnabled public String shippingPostalCode;
        @AuraEnabled public String shippingCountry;
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
     * Updates the current user's related organization details (name, billing address, phone).
     *
     * @param organizationName School / organization name.
     * @param street Billing street address.
     * @param city Billing city.
     * @param stateCode Two-letter US state abbreviation.
     * @param postalCode ZIP code.
     * @param phone Main phone number.
     * @return Mutation result and refreshed account details.
     */
    @AuraEnabled
    public static ActionResult updateOrganization(
        String organizationName,
        String street,
        String city,
        String stateCode,
        String postalCode,
        String phone
    ) {
        if (String.isBlank(organizationName)) {
            return errorResult('Please enter a school name.');
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
            Id               = accountId,
            Name             = organizationName.trim(),
            BillingStreet    = String.isBlank(street)     ? null : street.trim(),
            BillingCity      = String.isBlank(city)       ? null : city.trim(),
            BillingState     = String.isBlank(stateCode)  ? null : stateCode.trim(),
            BillingPostalCode = String.isBlank(postalCode) ? null : postalCode.trim(),
            Phone            = String.isBlank(phone)      ? null : phone.trim()
        );

        return successResult(ORGANIZATION_SUCCESS_MESSAGE);
    }

    /**
     * Updates the current user's shipping address fields.
     *
     * @param street Street address line.
     * @param city City.
     * @param stateCode Two-letter state/province code.
     * @param postalCode ZIP or postal code.
     * @param country Country (defaults to US when blank).
     * @return Mutation result and refreshed account details.
     */
    @AuraEnabled
    public static ActionResult updateShippingAddress(
        String street,
        String city,
        String stateCode,
        String postalCode,
        String country
    ) {
        if (String.isBlank(street) || String.isBlank(city)
            || String.isBlank(stateCode) || String.isBlank(postalCode)) {
            return errorResult('Street, city, state, and ZIP code are required.');
        }

        update new User(
            Id           = UserInfo.getUserId(),
            Street       = street.trim(),
            City         = city.trim(),
            State        = stateCode.trim(),
            PostalCode   = postalCode.trim(),
            Country      = String.isBlank(country) ? 'US' : country.trim()
        );

        return successResult('Shipping address updated successfully.');
    }

    /**
     * Creates a card payment method for the current user's account.
     *
     * @param cardHolderName Name shown on the card.
     * @param cardNumber Card number entered by the user.
     * @param expiryMonth Expiration month.
     * @param expiryYear Expiration year.
     * @param nickName Optional label for the card.
     * @return Mutation result and refreshed account details.
     */
    @AuraEnabled
    public static ActionResult savePaymentMethod(
        String cardHolderName,
        String cardNumber,
        String expiryMonth,
        String expiryYear,
        String billingStreet,
        String billingCity,
        String billingStateCode,
        String billingZip
    ) {
        if (String.isBlank(cardHolderName)) {
            return errorResult('Please enter the cardholder name.');
        }

        String normalizedCardNumber = normalizeCardNumber(cardNumber);
        if (normalizedCardNumber.length() < 12 || normalizedCardNumber.length() > 19) {
            return errorResult('Please enter a valid card number.');
        }

        Integer monthValue;
        Integer yearValue;
        try {
            monthValue = Integer.valueOf(safeString(expiryMonth));
            yearValue = normalizeExpiryYear(expiryYear);
        } catch (Exception e) {
            return errorResult('Please enter a valid expiration date.');
        }

        if (monthValue < 1 || monthValue > 12) {
            return errorResult('Please choose a valid expiration month.');
        }

        Date currentMonth = Date.newInstance(Date.today().year(), Date.today().month(), 1);
        Date enteredMonth = Date.newInstance(yearValue, monthValue, 1);
        if (enteredMonth < currentMonth) {
            return errorResult('The expiration date must be in the future.');
        }

        User currentUser = [
            SELECT Email, Phone, Contact.AccountId, Contact.Account.Name
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

        Id accountId = getAccountId(currentUser);
        if (accountId == null) {
            return errorResult('No organization is available for this account.');
        }

        CardPaymentMethod paymentMethod = new CardPaymentMethod(
            AccountId = accountId,
            CardHolderName = cardHolderName.trim(),
            InputCardNumber = normalizedCardNumber,
            ExpiryMonth = monthValue,
            ExpiryYear = yearValue,
            NickName = buildCardNickname(normalizedCardNumber),
            Status = 'Active',
            ProcessingMode = 'External',
            Email = String.isBlank(currentUser.Email) ? null : currentUser.Email.trim(),
            Phone = String.isBlank(currentUser.Phone) ? null : currentUser.Phone.trim(),
            CompanyName = getAccountName(currentUser, accountId),
            PaymentMethodStreet = String.isBlank(billingStreet) ? null : billingStreet.trim(),
            PaymentMethodCity = String.isBlank(billingCity) ? null : billingCity.trim(),
            PaymentMethodState = String.isBlank(billingStateCode) ? null : billingStateCode.trim(),
            PaymentMethodPostalCode = String.isBlank(billingZip) ? null : billingZip.trim(),
            PaymentMethodCountry = 'US'
        );

        String cardType = inferCardType(normalizedCardNumber);
        if (String.isNotBlank(cardType)) {
            paymentMethod.CardType = cardType;
        }

        List<String> nameParts = splitCardHolderName(cardHolderName);
        if (!nameParts.isEmpty()) {
            paymentMethod.CardHolderFirstName = nameParts[0];
            if (nameParts.size() > 1) {
                paymentMethod.CardHolderLastName = nameParts[1];
            }
        }

        insert as system paymentMethod;

        return successResult(PAYMENT_SUCCESS_MESSAGE);
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
                Contact.Account.Name,
                Contact.Account.BillingStreet,
                Contact.Account.BillingCity,
                Contact.Account.BillingState,
                Contact.Account.BillingPostalCode,
                Contact.Account.Phone
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
        Id accountId = getAccountId(currentUser);
        result.organizationName = currentUser.Contact != null && currentUser.Contact.Account != null
            ? safeString(currentUser.Contact.Account.Name)
            : '';
        result.hasOrganization = String.isNotBlank(result.organizationName);
        result.organizationPhone = currentUser.Contact != null && currentUser.Contact.Account != null
            ? safeString(currentUser.Contact.Account.Phone) : '';
        result.billingStreet = currentUser.Contact != null && currentUser.Contact.Account != null
            ? safeString(currentUser.Contact.Account.BillingStreet) : '';
        result.billingCity = currentUser.Contact != null && currentUser.Contact.Account != null
            ? safeString(currentUser.Contact.Account.BillingCity) : '';
        result.billingState = currentUser.Contact != null && currentUser.Contact.Account != null
            ? safeString(currentUser.Contact.Account.BillingState) : '';
        result.billingPostalCode = currentUser.Contact != null && currentUser.Contact.Account != null
            ? safeString(currentUser.Contact.Account.BillingPostalCode) : '';
        result.shippingAddress = buildAddressSummary(currentUser);
        result.hasShippingAddress = String.isNotBlank(result.shippingAddress);
        result.shippingStreet = safeString(currentUser.Street);
        result.shippingCity = safeString(currentUser.City);
        result.shippingState = safeString(currentUser.State);
        result.shippingPostalCode = safeString(currentUser.PostalCode);
        result.shippingCountry = safeString(currentUser.Country);

        CardPaymentMethod latestPaymentMethod = getLatestPaymentMethod(accountId);
        result.paymentSummary = latestPaymentMethod == null
            ? DEFAULT_PAYMENT_MESSAGE
            : buildPaymentSummary(latestPaymentMethod);
        result.hasPaymentMethods = latestPaymentMethod != null;
        return result;
    }

    private static CardPaymentMethod getLatestPaymentMethod(Id accountId) {
        if (accountId == null) {
            return null;
        }

        List<CardPaymentMethod> paymentMethods = [
            SELECT NickName, CardType, DisplayCardNumber, CardLastFour, ExpiryMonth, ExpiryYear
            FROM CardPaymentMethod
            WHERE AccountId = :accountId
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        return paymentMethods.isEmpty() ? null : paymentMethods[0];
    }

    private static String buildPaymentSummary(CardPaymentMethod paymentMethod) {
        List<String> parts = new List<String>();
        if (String.isNotBlank(paymentMethod.NickName)) {
            parts.add(paymentMethod.NickName.trim());
        }
        if (String.isNotBlank(paymentMethod.CardType)) {
            parts.add(paymentMethod.CardType.trim());
        }

        String displayCardNumber = safeString(paymentMethod.DisplayCardNumber);
        if (String.isBlank(displayCardNumber) && paymentMethod.CardLastFour != null) {
            displayCardNumber = '•••• ' + String.valueOf(paymentMethod.CardLastFour).replace('.0', '');
        }
        if (String.isNotBlank(displayCardNumber)) {
            parts.add(displayCardNumber);
        }

        if (paymentMethod.ExpiryMonth != null && paymentMethod.ExpiryYear != null) {
            String paddedMonth = String.valueOf(paymentMethod.ExpiryMonth).leftPad(2, '0');
            String shortYear = String.valueOf(paymentMethod.ExpiryYear);
            if (shortYear.length() > 2) {
                shortYear = shortYear.right(2);
            }
            parts.add('Exp ' + paddedMonth + '/' + shortYear);
        }

        return parts.isEmpty() ? DEFAULT_PAYMENT_MESSAGE : String.join(parts, ' • ');
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

    private static Id getAccountId(User currentUser) {
        Id accountId = currentUser.Contact != null ? currentUser.Contact.AccountId : null;
        if (accountId == null && Test.isRunningTest() && testAccountIdOverride != null) {
            return testAccountIdOverride;
        }
        return accountId;
    }

    private static String getAccountName(User currentUser, Id accountId) {
        if (currentUser.Contact != null && currentUser.Contact.Account != null) {
            return safeString(currentUser.Contact.Account.Name);
        }
        if (Test.isRunningTest() && accountId != null) {
            List<Account> accounts = [SELECT Name FROM Account WHERE Id = :accountId LIMIT 1];
            if (!accounts.isEmpty()) {
                return safeString(accounts[0].Name);
            }
        }
        return null;
    }

    private static String normalizeCardNumber(String cardNumber) {
        return safeString(cardNumber).replaceAll('[^0-9]', '');
    }

    private static Integer normalizeExpiryYear(String expiryYear) {
        String normalizedYear = safeString(expiryYear);
        if (normalizedYear.length() == 2) {
            return Integer.valueOf('20' + normalizedYear);
        }
        return Integer.valueOf(normalizedYear);
    }

    private static String buildCardNickname(String cardNumber) {
        if (String.isBlank(cardNumber) || cardNumber.length() < 4) {
            return 'Card';
        }
        return 'Card ending in ' + cardNumber.right(4);
    }

    private static List<String> splitCardHolderName(String cardHolderName) {
        List<String> parts = new List<String>();
        String normalized = safeString(cardHolderName);
        if (String.isBlank(normalized)) {
            return parts;
        }

        List<String> rawParts = normalized.split('\\s+');
        if (!rawParts.isEmpty()) {
            parts.add(rawParts[0]);
            if (rawParts.size() > 1) {
                parts.add(rawParts[rawParts.size() - 1]);
            }
        }
        return parts;
    }

    private static String inferCardType(String cardNumber) {
        if (String.isBlank(cardNumber)) {
            return null;
        }
        if (cardNumber.startsWith('4')) {
            return 'Visa';
        }
        if (Pattern.matches('^(5[1-5].*|2(2[2-9].*|[3-6].*|7[01].*|720.*))$', cardNumber)) {
            return 'Master Card';
        }
        if (Pattern.matches('^(34.*|37.*)$', cardNumber)) {
            return 'American Express';
        }
        if (Pattern.matches('^(6011.*|65.*|64[4-9].*)$', cardNumber)) {
            return 'Discover';
        }
        return null;
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