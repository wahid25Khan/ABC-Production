@SuppressWarnings('PMD.ApexDoc')
@IsTest
private class GoogleRegHandlerTest {
    @TestSetup
    static void setupData() {
        insert new Account(Name = 'Existing Google Buyer');
        insert new Contact(
            FirstName = 'Existing',
            LastName = 'Buyer',
            Email = 'existing.google@example.com',
            AccountId = [SELECT Id FROM Account WHERE Name = 'Existing Google Buyer' LIMIT 1].Id
        );
    }

    @IsTest
    static void canCreateUserRequiresEmail() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            Auth.UserData data = buildUserData('', 'Pat', 'Buyer', new Map<String, String>());

            System.assertEquals(false, new AutocreatedRegHandler1772220667704().canCreateUser(data));
        }
    }

    @IsTest
    static void canCreateUserRejectsExistingInternalUserWithoutContact() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            AutocreatedRegHandler1772220667704.existingUserOverride = new User(
                Id = UserInfo.getUserId(),
                Email = 'internal.only@example.com',
                Username = 'internal.only@example.com',
                ContactId = null
            );

            Auth.UserData data = buildUserData('internal.only@example.com', 'Internal', 'Only', new Map<String, String>());
            System.assertEquals(false, new AutocreatedRegHandler1772220667704().canCreateUser(data));
        }
    }

    @IsTest
    static void createUserBuildsBuyerCommunityUser() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            AutocreatedRegHandler1772220667704.profileIdOverride = UserInfo.getProfileId();
            AutocreatedRegHandler1772220667704.accountOwnerIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.buyerGroupIdOverride = UserInfo.getUserId();
            AutocreatedRegHandler1772220667704.createdExternalUserIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getUserId();

            Map<String, String> attributes = new Map<String, String>{
                'sfdc_networkid' => '0DBfake000000001',
                'hd' => 'district.example.org'
            };
            Auth.UserData data = buildUserData('new.google@example.com', 'Pat', 'Buyer', attributes);

            Test.startTest();
            User createdUser = new AutocreatedRegHandler1772220667704().createUser(null, data);
            Test.stopTest();

            System.assertNotEquals(null, createdUser, 'Handler should return a user for a new Google shopper.');
            System.assertEquals('new.google@example.com', createdUser.Email);
            System.assert(createdUser.Username.contains('+abcshop-'), 'Google shoppers should get an org-unique username to avoid global username collisions.');
            System.assert(createdUser.Username.endsWith('@example.com'), 'The generated username should preserve the customer email domain.');
            System.assertEquals(UserInfo.getProfileId(), createdUser.ProfileId);
            System.assertNotEquals(null, createdUser.ContactId, 'Returned user should point to the inserted contact.');
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastAssignedBuyerGroupId, 'Buyer group assignment should be attempted via override.');
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastPermissionSetAssignedUserId, 'New social users should receive the B2B buyer permission set.');
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastAssignedPermissionSetId, 'The configured B2B buyer permission set should be targeted.');
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastPermissionSetLicenseAssignedUserId, 'New social users should receive the B2B buyer permission set license.');
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastAssignedPermissionSetLicenseId, 'The configured B2B buyer permission set license should be targeted.');
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastPermissionSetGroupAssignedUserId, 'New social users should receive the Commerce_Buyer permission set group.');
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastAssignedPermissionSetGroupId, 'The configured Commerce_Buyer permission set group should be targeted.');

            Contact createdContact = [
                SELECT Id, Account.Name, HasOptedOutOfEmail
                FROM Contact
                WHERE Id = :createdUser.ContactId
                LIMIT 1
            ];
            System.assertEquals('district.example.org', createdContact.Account.Name, 'Hosted domain should seed the buyer account name.');
            System.assertEquals(true, createdContact.HasOptedOutOfEmail, 'Social signup should default to marketing opt-out until explicit consent is collected.');
        }
    }

    @IsTest
    static void createUserUsesEmailDomainForMicrosoftBuyerAccounts() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            AutocreatedRegHandler1772220667704.profileIdOverride = UserInfo.getProfileId();
            AutocreatedRegHandler1772220667704.accountOwnerIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.buyerGroupIdOverride = UserInfo.getUserId();

            Map<String, String> attributes = new Map<String, String>{
                'preferred_username' => 'teacher@district.k12.ga.us',
                'tid' => 'tenant-id-123'
            };
            Auth.UserData data = buildUserData('teacher@district.k12.ga.us', 'Taylor', 'Teacher', attributes, 'Microsoft');

            Test.startTest();
            User createdUser = new AutocreatedRegHandler1772220667704().createUser(null, data);
            Test.stopTest();

            Contact createdContact = [
                SELECT Id, Account.Name
                FROM Contact
                WHERE Id = :createdUser.ContactId
                LIMIT 1
            ];
            System.assertEquals('district.k12.ga.us', createdContact.Account.Name, 'Microsoft work accounts should seed the buyer account from the email domain.');
        }
    }

    @IsTest
    static void createUserFallsBackForConsumerMicrosoftAccounts() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            AutocreatedRegHandler1772220667704.profileIdOverride = UserInfo.getProfileId();
            AutocreatedRegHandler1772220667704.accountOwnerIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.buyerGroupIdOverride = UserInfo.getUserId();

            Auth.UserData data = buildUserData(
                'fallback.user@outlook.com',
                '',
                '',
                new Map<String, String>{ 'preferred_username' => 'fallback.user@outlook.com' },
                'Microsoft'
            );

            Test.startTest();
            User createdUser = new AutocreatedRegHandler1772220667704().createUser(null, data);
            Test.stopTest();

            System.assertEquals('fallbackuser', createdUser.FirstName, 'Consumer Microsoft accounts should fall back to the email local part when names are unavailable.');
            System.assertEquals('Shopper', createdUser.LastName, 'Fallback last name should remain shopper-safe.');

            Contact createdContact = [
                SELECT Id, Account.Name
                FROM Contact
                WHERE Id = :createdUser.ContactId
                LIMIT 1
            ];
            System.assertEquals('Shopper Buyer Account', createdContact.Account.Name, 'Consumer email domains should not become buyer account names.');
        }
    }

    @IsTest
    static void createUserReusesExistingExternalUser() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            Account existingAccount = [SELECT Id FROM Account WHERE Name = 'Existing Google Buyer' LIMIT 1];
            Contact existingContact = [SELECT Id, AccountId FROM Contact WHERE Email = 'existing.google@example.com' LIMIT 1];

            User existingUser = new User(
                Id = UserInfo.getUserId(),
                Email = 'existing.google@example.com',
                Username = 'existing.google@example.com',
                ContactId = existingContact.Id
            );
            AutocreatedRegHandler1772220667704.existingUserOverride = existingUser;

            CommerceRegistrationProvisioning.buyerGroupIdOverride = existingAccount.Id;
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getUserId();
            Auth.UserData data = buildUserData('existing.google@example.com', 'Existing', 'Buyer', new Map<String, String>{ 'sfdc_networkid' => '0DBfake000000001' });

            Test.startTest();
            User returnedUser = new AutocreatedRegHandler1772220667704().createUser(null, data);
            Test.stopTest();

            System.assertEquals(existingUser.Id, returnedUser.Id, 'Existing buyer users should be reused rather than duplicated.');
            System.assertEquals(existingContact.AccountId, CommerceRegistrationProvisioning.lastAssignedBuyerId, 'Existing buyers should still be ensured into the buyer group.');
            System.assertEquals(existingUser.Id, CommerceRegistrationProvisioning.lastPermissionSetAssignedUserId, 'Existing social users should also be backfilled with the B2B buyer permission set.');
            System.assertEquals(existingUser.Id, CommerceRegistrationProvisioning.lastPermissionSetLicenseAssignedUserId, 'Existing social users should also be backfilled with the B2B buyer permission set license.');
            System.assertEquals(existingUser.Id, CommerceRegistrationProvisioning.lastPermissionSetGroupAssignedUserId, 'Existing social users should also be backfilled with the Commerce_Buyer permission set group.');
        }
    }

    @IsTest
    static void createUserReactivatesExistingBuyerAccount() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            Account existingAccount = [SELECT Id, Name FROM Account WHERE Name = 'Existing Google Buyer' LIMIT 1];
            Contact existingContact = [SELECT Id FROM Contact WHERE Email = 'existing.google@example.com' LIMIT 1];

            insert new BuyerAccount(
                Name = existingAccount.Name,
                BuyerId = existingAccount.Id,
                OwnerId = UserInfo.getUserId(),
                BuyerStatus = 'Pending',
                CommerceType = 'Buyer',
                IsActive = false
            );

            AutocreatedRegHandler1772220667704.existingUserOverride = new User(
                Id = UserInfo.getUserId(),
                Email = 'existing.google@example.com',
                Username = 'existing.google@example.com',
                ContactId = existingContact.Id
            );
            CommerceRegistrationProvisioning.buyerGroupIdOverride = existingAccount.Id;
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getUserId();

            Test.startTest();
            User returnedUser = new AutocreatedRegHandler1772220667704().createUser(
                null,
                buildUserData('existing.google@example.com', 'Existing', 'Buyer', new Map<String, String>())
            );
            Test.stopTest();

            BuyerAccount refreshedBuyerAccount = [
                SELECT BuyerStatus, CommerceType, IsActive
                FROM BuyerAccount
                WHERE BuyerId = :existingAccount.Id
                LIMIT 1
            ];
            System.assertEquals(UserInfo.getUserId(), returnedUser.Id, 'The existing user should still be reused.');
            System.assertEquals('Active', refreshedBuyerAccount.BuyerStatus, 'Existing buyer accounts should be reactivated during social login reuse.');
            System.assertEquals(true, refreshedBuyerAccount.IsActive, 'Existing buyer accounts should be marked active during social login reuse.');
        }
    }

    @IsTest
    static void updateUserRefreshesBasicProfileFields() {
        User userToUpdate = createRunAsUser();

        System.runAs(userToUpdate) {
            Auth.UserData data = buildUserData('updated.google@example.com', 'Updated', 'Name', new Map<String, String>());

            Test.startTest();
            new AutocreatedRegHandler1772220667704().updateUser(userToUpdate.Id, null, data);
            Test.stopTest();
        }

        User refreshedUser = [SELECT Email, FirstName, LastName FROM User WHERE Id = :userToUpdate.Id LIMIT 1];
        System.assertEquals('updated.google@example.com', refreshedUser.Email);
        System.assertEquals('Updated', refreshedUser.FirstName);
        System.assertEquals('Name', refreshedUser.LastName);
    }

    @IsTest
    static void createUserSurfacesExternalProvisioningFailureInTests() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            AutocreatedRegHandler1772220667704.externalUserErrorOverride = 'Provisioning failed.';
            AutocreatedRegHandler1772220667704.accountOwnerIdOverride = UserInfo.getUserId();
            AutocreatedRegHandler1772220667704.profileIdOverride = UserInfo.getProfileId();

            try {
                new AutocreatedRegHandler1772220667704().createUser(
                    null,
                    buildUserData('failure.google@example.com', 'Fail', 'Case', new Map<String, String>())
                );
                System.assert(false, 'Expected the test override to simulate an external user provisioning failure.');
            } catch (AuraHandledException ex) {
                System.assertNotEquals(null, ex, 'The test override should surface an AuraHandledException.');
            }
        }
    }

    @IsTest
    static void createUserSkipsDuplicatePermissionAssignments() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            AutocreatedRegHandler1772220667704.resetTestState();
            Account existingAccount = [SELECT Id FROM Account WHERE Name = 'Existing Google Buyer' LIMIT 1];
            Contact existingContact = [SELECT Id FROM Contact WHERE Email = 'existing.google@example.com' LIMIT 1];

            AutocreatedRegHandler1772220667704.existingUserOverride = new User(
                Id = UserInfo.getUserId(),
                Email = 'existing.google@example.com',
                Username = 'existing.google@example.com',
                ContactId = existingContact.Id
            );
            CommerceRegistrationProvisioning.buyerGroupIdOverride = existingAccount.Id;
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.permissionSetAssignmentExistsOverride = true;
            CommerceRegistrationProvisioning.permissionSetLicenseAssignmentExistsOverride = true;
            CommerceRegistrationProvisioning.permissionSetGroupAssignmentExistsOverride = true;

            Test.startTest();
            new AutocreatedRegHandler1772220667704().createUser(
                null,
                buildUserData('existing.google@example.com', 'Existing', 'Buyer', new Map<String, String>())
            );
            Test.stopTest();

            System.assertEquals(null, CommerceRegistrationProvisioning.lastPermissionSetAssignedUserId, 'The permission set should not be re-assigned when it already exists.');
            System.assertEquals(null, CommerceRegistrationProvisioning.lastPermissionSetLicenseAssignedUserId, 'The permission set license should not be re-assigned when it already exists.');
            System.assertEquals(null, CommerceRegistrationProvisioning.lastPermissionSetGroupAssignedUserId, 'The permission set group should not be re-assigned when it already exists.');
        }
    }

    private static Auth.UserData buildUserData(
        String email,
        String firstName,
        String lastName,
        Map<String, String> attributes
    ) {
        return buildUserData(email, firstName, lastName, attributes, 'Google');
    }

    private static Auth.UserData buildUserData(
        String email,
        String firstName,
        String lastName,
        Map<String, String> attributes,
        String provider
    ) {
        String fullName = String.join(new List<String>{ firstName, lastName }, ' ').trim();
        return new Auth.UserData(
            email,
            firstName,
            lastName,
            fullName,
            email,
            null,
            email,
            'en_US',
            provider,
            null,
            attributes
        );
    }

    private static User createRunAsUser() {
        String uniqueToken = String.valueOf(System.currentTimeMillis()) + String.valueOf(Math.mod(Crypto.getRandomInteger(), 1000)).replace('-', '');
        User runAsUser = new User(
            Alias = 'gglrun',
            Email = 'google.run.' + uniqueToken + '@example.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Runner',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Chicago',
            Username = 'google.run.' + uniqueToken + '@example.test'
        );
        insert runAsUser;
        return runAsUser;
    }
}