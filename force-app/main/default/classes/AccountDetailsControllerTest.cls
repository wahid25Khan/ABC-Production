@SuppressWarnings('PMD.ApexDoc')
@IsTest
private class AccountDetailsControllerTest {
    @IsTest
    static void getAccountDetailsReturnsCurrentUserData() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Test.startTest();
            AccountDetailsController.AccountDetailsResult result = AccountDetailsController.getAccountDetails();
            Test.stopTest();

            System.assertEquals('Pat', result.firstName);
            System.assertEquals('Buyer', result.lastName);
            System.assertEquals('Pat Buyer', result.fullName);
            System.assertEquals('pat.buyer@example.test', result.email);
            System.assertEquals('404-555-1212', result.phone);
            System.assertEquals(false, result.hasOrganization);
            System.assertEquals(false, result.hasShippingAddress);
            System.assertEquals('No payment on file.', result.paymentSummary);
        }
    }

    @IsTest
    static void updateAboutYouUpdatesCurrentUser() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Test.startTest();
            AccountDetailsController.ActionResult result = AccountDetailsController.updateAboutYou(
                'Updated',
                'Customer',
                'updated.customer@example.test',
                '678-555-2222'
            );
            Test.stopTest();

            User updatedUser = [
                SELECT FirstName, LastName, Email, Phone
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];

            System.assertEquals(true, result.success);
            System.assertEquals('Updated', updatedUser.FirstName);
            System.assertEquals('Customer', updatedUser.LastName);
            System.assertEquals('updated.customer@example.test', updatedUser.Email);
            System.assertEquals('678-555-2222', updatedUser.Phone);
        }
    }

    @IsTest
    static void updateOrganizationReturnsErrorWhenNoAccountExists() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Test.startTest();
            AccountDetailsController.ActionResult result = AccountDetailsController.updateOrganization(
                'American Book Company',
                null,
                null,
                null,
                null,
                null
            );
            Test.stopTest();

            System.assertEquals(false, result.success);
            System.assertEquals('No organization is available for this account.', result.message);
        }
    }

    @IsTest
    static void changePasswordSucceedsDuringTests() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Test.startTest();
            AccountDetailsController.ActionResult result = AccountDetailsController.changePassword(
                'OldPassword1!',
                'NewPassword1!',
                'NewPassword1!'
            );
            Test.stopTest();

            System.assertEquals(true, result.success);
            System.assertEquals('Your password has been updated.', result.message);
        }
    }

    @IsTest
    static void savePaymentMethodCreatesCardPaymentMethodForAccount() {
        User runAsUser = createRunAsUser();
        Account account = new Account(Name = 'American Book Company');
        insert account;

        System.runAs(runAsUser) {
            AccountDetailsController.testAccountIdOverride = account.Id;

            Test.startTest();
            AccountDetailsController.ActionResult result = AccountDetailsController.savePaymentMethod(
                'Pat Buyer',
                '4111 1111 1111 1111',
                '12',
                String.valueOf(Date.today().year() + 1),
                '123 Main St',
                'Atlanta',
                'GA',
                '30301'
            );
            Test.stopTest();

            CardPaymentMethod paymentMethod = [
                SELECT AccountId, CardHolderName, NickName, ExpiryMonth, ExpiryYear, Status, ProcessingMode,
                       PaymentMethodStreet, PaymentMethodCity, PaymentMethodState, PaymentMethodPostalCode, PaymentMethodCountry
                FROM CardPaymentMethod
                WHERE AccountId = :account.Id
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];

            System.assertEquals(true, result.success);
            System.assertEquals(account.Id, paymentMethod.AccountId);
            System.assertEquals('Pat Buyer', paymentMethod.CardHolderName);
            System.assertEquals(12, paymentMethod.ExpiryMonth);
            System.assertEquals(Date.today().year() + 1, paymentMethod.ExpiryYear);
            System.assertEquals('Active', paymentMethod.Status);
            System.assertEquals('External', paymentMethod.ProcessingMode);
            System.assertEquals('123 Main St', paymentMethod.PaymentMethodStreet);
            System.assertEquals('Atlanta', paymentMethod.PaymentMethodCity);
            System.assertEquals('GA', paymentMethod.PaymentMethodState);
            System.assertEquals('30301', paymentMethod.PaymentMethodPostalCode);
            System.assertEquals('US', paymentMethod.PaymentMethodCountry);
            System.assertEquals(true, result.details.hasPaymentMethods);
        }
    }

    @IsTest
    static void coalesceStringsReturnsFirstNonBlankValue() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            System.assertEquals(
                '404-555-1212',
                AccountDetailsController.coalesceStrings(new List<String>{ '', '  ', '404-555-1212', '678-555-2222' })
            );
            System.assertEquals(
                '',
                AccountDetailsController.coalesceStrings(new List<String>{ '', '   ' })
            );
        }
    }

    private static User createRunAsUser() {
        String uniqueToken = String.valueOf(System.currentTimeMillis());
        User runAsUser = new User(
            Alias = 'acctdet',
            Email = 'pat.buyer@example.test',
            EmailEncodingKey = 'UTF-8',
            FirstName = 'Pat',
            LastName = 'Buyer',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            Phone = '404-555-1212',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Chicago',
            Username = 'pat.buyer.' + uniqueToken + '@example.test'
        );
        insert runAsUser;
        return runAsUser;
    }
}