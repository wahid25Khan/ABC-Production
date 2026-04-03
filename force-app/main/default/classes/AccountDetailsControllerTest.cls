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
            AccountDetailsController.ActionResult result = AccountDetailsController.updateOrganization('American Book Company');
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
