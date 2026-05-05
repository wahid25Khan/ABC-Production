@SuppressWarnings('PMD.ApexDoc')
@IsTest
private class BuyerSelfRegistrationServiceTest {
    private class MockExternalUserGateway implements BuyerSelfRegistrationService.ExternalUserGateway {
        Id contactId;
        Id accountId;
        String userIdToReturn;

        MockExternalUserGateway(Id contactId, Id accountId, String userIdToReturn) {
            this.contactId = contactId;
            this.accountId = accountId;
            this.userIdToReturn = userIdToReturn;
        }

        public BuyerSelfRegistrationService.ExternalUserOutcome createExternalUser(
            BuyerSelfRegistrationService.RegistrationRequest req,
            Account account,
            Id profileId
        ) {
            BuyerSelfRegistrationService.ExternalUserOutcome outcome =
                new BuyerSelfRegistrationService.ExternalUserOutcome();
            outcome.contactId = this.contactId;
            outcome.accountId = this.accountId != null ? this.accountId : account.Id;
            outcome.userId = this.userIdToReturn;
            return outcome;
        }
    }

    private class MockBuyerAccessGateway implements BuyerSelfRegistrationService.BuyerAccessGateway {
        Id capturedBuyerId;
        String capturedBuyerGroupName;
        Integer callCount = 0;

        public void ensureBuyerAccess(Id buyerId, String buyerGroupName) {
            this.capturedBuyerId = buyerId;
            this.capturedBuyerGroupName = buyerGroupName;
            this.callCount++;
        }
    }

    @TestSetup
    static void setupData() {
        insert new Account(Name = 'Existing Customer');
        insert new Contact(
            FirstName = 'Existing',
            LastName = 'Customer',
            Email = 'existing@example.com',
            AccountId = [SELECT Id FROM Account WHERE Name = 'Existing Customer' LIMIT 1].Id
        );
    }

    @IsTest
    static void registerBuyerCreatesAccountUpdatesConsentAndAssignsBuyerGroup() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();
            Account existingAccount = [SELECT Id FROM Account WHERE Name = 'Existing Customer' LIMIT 1];
            Contact contact = [SELECT Id, HasOptedOutOfEmail FROM Contact WHERE Email = 'existing@example.com' LIMIT 1];
            MockBuyerAccessGateway buyerGateway = new MockBuyerAccessGateway();

            BuyerSelfRegistrationService.externalUserGateway =
                new MockExternalUserGateway(contact.Id, existingAccount.Id, UserInfo.getUserId());
            BuyerSelfRegistrationService.buyerAccessGateway = buyerGateway;
            BuyerSelfRegistrationService.accountOwnerIdOverride = UserInfo.getUserId();
            BuyerSelfRegistrationService.profileIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getProfileId();

            BuyerSelfRegistrationService.RegistrationRequest req = buildRequest();
            req.marketingConsent = true;

            Test.startTest();
            BuyerSelfRegistrationService.RegistrationResponse result =
                BuyerSelfRegistrationService.registerBuyer(req);
            Test.stopTest();

            System.assertEquals(true, result.success, 'Registration should succeed.');
            System.assertEquals('/myprofile', result.redirectUrl, 'Should return the account landing page.');
            System.assertEquals(existingAccount.Id, result.accountId, 'Response should include the buyer account id.');
            System.assertEquals(1, buyerGateway.callCount, 'Buyer access should be assigned once.');
            System.assertEquals(existingAccount.Id, buyerGateway.capturedBuyerId, 'Buyer access should use the returned buyer account.');
            System.assertEquals('American Book Company Buyer Group', buyerGateway.capturedBuyerGroupName, 'Should assign the default buyer group.');

            System.assertNotEquals(null, CommerceRegistrationProvisioning.lastPermissionSetAssignedUserId, 'B2B buyer permission set should be assigned.');
            System.assertNotEquals(null, CommerceRegistrationProvisioning.lastPermissionSetLicenseAssignedUserId, 'B2B buyer permission set license should be assigned.');
            System.assertNotEquals(null, CommerceRegistrationProvisioning.lastPermissionSetGroupAssignedUserId, 'Commerce buyer permission set group should be assigned.');

            Contact updatedContact = [SELECT HasOptedOutOfEmail FROM Contact WHERE Id = :contact.Id LIMIT 1];
            System.assertEquals(false, updatedContact.HasOptedOutOfEmail, 'Marketing consent should opt the contact in.');

            Integer createdAccounts = [SELECT COUNT() FROM Account WHERE Name = 'Springfield Middle School'];
            System.assertEquals(1, createdAccounts, 'A buyer account should be created for the registration.');
        }
    }

    @IsTest
    static void registerBuyerRejectsDuplicateEmail() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();
            User duplicateUser = new User(
                Alias = 'existusr',
                Email = 'existing@example.com',
                EmailEncodingKey = 'UTF-8',
                LastName = 'Duplicate',
                LanguageLocaleKey = 'en_US',
                LocaleSidKey = 'en_US',
                ProfileId = UserInfo.getProfileId(),
                TimeZoneSidKey = 'America/Chicago',
                Username = 'existing@example.com.' + System.currentTimeMillis() + '@example.test'
            );
            insert duplicateUser;

            BuyerSelfRegistrationService.accountOwnerIdOverride = UserInfo.getUserId();
            BuyerSelfRegistrationService.profileIdOverride = UserInfo.getProfileId();
            BuyerSelfRegistrationService.buyerAccessGateway = new MockBuyerAccessGateway();
            BuyerSelfRegistrationService.externalUserGateway =
                new MockExternalUserGateway(null, null, UserInfo.getUserId());

            BuyerSelfRegistrationService.RegistrationRequest req = buildRequest();
            req.email = 'existing@example.com';
            req.confirmEmail = 'existing@example.com';

            Test.startTest();
            BuyerSelfRegistrationService.RegistrationResponse result =
                BuyerSelfRegistrationService.registerBuyer(req);
            Test.stopTest();

            System.assertEquals(false, result.success, 'Duplicate emails should be rejected.');
            System.assertEquals(
                'An account with this email already exists. Please sign in or reset your password.',
                result.message,
                'Should surface a friendly duplicate-user message.'
            );
        }
    }

    @IsTest
    static void registerBuyerRequiresOrganizationName() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();
            BuyerSelfRegistrationService.accountOwnerIdOverride = UserInfo.getUserId();
            BuyerSelfRegistrationService.profileIdOverride = UserInfo.getProfileId();
            BuyerSelfRegistrationService.buyerAccessGateway = new MockBuyerAccessGateway();
            BuyerSelfRegistrationService.externalUserGateway =
                new MockExternalUserGateway(null, null, UserInfo.getUserId());

            BuyerSelfRegistrationService.RegistrationRequest req = buildRequest();
            req.organizationName = '   ';

            Test.startTest();
            BuyerSelfRegistrationService.RegistrationResponse result =
                BuyerSelfRegistrationService.registerBuyer(req);
            Test.stopTest();

            System.assertEquals(false, result.success, 'Blank organization names should fail validation.');
            System.assertEquals('Please enter your organization name.', result.message);
        }
    }

    @IsTest
    static void registerBuyerFromJsonRejectsBlankRequest() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            try {
                BuyerSelfRegistrationService.registerBuyerFromJson('   ');
                System.assert(false, 'Expected a blank JSON request to fail fast.');
            } catch (AuraHandledException ex) {
                System.assertEquals('Missing registration request.', ex.getMessage());
            }
        }
    }

    @IsTest
    static void registerBuyerFromJsonDeserializesAndRegisters() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();
            Account existingAccount = [SELECT Id FROM Account WHERE Name = 'Existing Customer' LIMIT 1];
            Contact contact = [SELECT Id FROM Contact WHERE Email = 'existing@example.com' LIMIT 1];

            BuyerSelfRegistrationService.externalUserGateway =
                new MockExternalUserGateway(contact.Id, existingAccount.Id, UserInfo.getUserId());
            BuyerSelfRegistrationService.buyerAccessGateway = new MockBuyerAccessGateway();
            BuyerSelfRegistrationService.accountOwnerIdOverride = UserInfo.getUserId();
            BuyerSelfRegistrationService.profileIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getProfileId();

            Test.startTest();
            BuyerSelfRegistrationService.RegistrationResponse result =
                BuyerSelfRegistrationService.registerBuyerFromJson(JSON.serialize(buildRequest()));
            Test.stopTest();

            System.assertEquals(true, result.success, 'JSON registration requests should succeed when the payload is valid.');
            System.assertEquals('/myprofile', result.redirectUrl);
        }
    }

    @IsTest
    static void buildExternalUsernameUsesOrgUniqueSuffix() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            String generatedUsername = BuyerSelfRegistrationService.buildExternalUsername(
                'student@example.com'
            );

            System.assertNotEquals('student@example.com', generatedUsername);
            System.assert(generatedUsername.contains('+abcshop-'), 'Self-registration should use an org-unique username suffix.');
            System.assert(generatedUsername.endsWith('@example.com'), 'The generated username should preserve the customer email domain.');
        }
    }

    @IsTest
    static void buildExternalUsernameHandlesBlankAndLongEmails() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            System.assertEquals('', BuyerSelfRegistrationService.buildExternalUsername(''));

            String longLocalPart = 'averyveryveryveryveryveryverylongstudentidentifier';
            String generatedUsername = BuyerSelfRegistrationService.buildExternalUsername(
                longLocalPart + '@example.com'
            );

            System.assert(generatedUsername.contains('+abcshop-'));
            System.assert(generatedUsername.endsWith('@example.com'));
            System.assert(generatedUsername.length() <= 80, 'Generated usernames must stay within Salesforce limits.');
        }
    }

    @IsTest
    static void registerBuyerUsesDefaultGatewaysForCoverage() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            Account existingAccount = [SELECT Id FROM Account WHERE Name = 'Existing Customer' LIMIT 1];
            Contact contact = [SELECT Id FROM Contact WHERE Email = 'existing@example.com' LIMIT 1];

            BuyerSelfRegistrationService.ExternalUserOutcome outcome =
                new BuyerSelfRegistrationService.ExternalUserOutcome();
            outcome.userId = UserInfo.getUserId();
            outcome.contactId = contact.Id;

            BuyerSelfRegistrationService.externalUserOutcomeOverride = outcome;
            BuyerSelfRegistrationService.accountOwnerIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.buyerGroupIdOverride = existingAccount.Id;
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getProfileId();

            Test.startTest();
            BuyerSelfRegistrationService.RegistrationResponse result =
                BuyerSelfRegistrationService.registerBuyer(buildRequest());
            Test.stopTest();

            System.assertEquals(true, result.success, 'Registration should succeed through the default gateways.');
            System.assertNotEquals(null, CommerceRegistrationProvisioning.lastAssignedBuyerId, 'Buyer group assignment should be attempted.');
            System.assertEquals(existingAccount.Id, CommerceRegistrationProvisioning.lastAssignedBuyerGroupId, 'The test override buyer group id should be recorded.');
        }
    }

    @IsTest
    static void ensureBuyerAccountCreatesAndActivatesCommerceBuyerRecord() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            Account account = new Account(
                Name = 'Buyer Account Coverage School',
                OwnerId = UserInfo.getUserId()
            );
            insert account;

            Test.startTest();
            CommerceRegistrationProvisioning.ensureBuyerAccount(account);
            Test.stopTest();

            BuyerAccount buyerAccount = [
                SELECT Id, BuyerId, BuyerStatus, CommerceType, IsActive
                FROM BuyerAccount
                WHERE BuyerId = :account.Id
                LIMIT 1
            ];
            System.assertEquals(account.Id, buyerAccount.BuyerId, 'Buyer account should point to the shopper account.');
            System.assertEquals('Active', buyerAccount.BuyerStatus, 'Buyer account should be activated for shopper provisioning.');
            System.assertEquals('Buyer', buyerAccount.CommerceType, 'Buyer account should use Buyer commerce type.');
            System.assertEquals(true, buyerAccount.IsActive, 'Buyer account should be active.');

            update new BuyerAccount(
                Id = buyerAccount.Id,
                BuyerStatus = 'Pending',
                IsActive = false
            );

            CommerceRegistrationProvisioning.ensureBuyerAccount(account);

            BuyerAccount refreshedBuyerAccount = [
                SELECT BuyerStatus, CommerceType, IsActive
                FROM BuyerAccount
                WHERE Id = :buyerAccount.Id
                LIMIT 1
            ];
            System.assertEquals('Active', refreshedBuyerAccount.BuyerStatus, 'Existing buyer accounts should be reactivated when needed.');
            System.assertEquals('Buyer', refreshedBuyerAccount.CommerceType, 'Existing buyer accounts should retain Buyer commerce type.');
            System.assertEquals(true, refreshedBuyerAccount.IsActive, 'Existing buyer accounts should be marked active.');

            CommerceRegistrationProvisioning.ensureBuyerAccount(account);
			Integer buyerAccountCount = [SELECT COUNT() FROM BuyerAccount WHERE BuyerId = :account.Id];
			System.assertEquals(1, buyerAccountCount, 'Re-ensuring an already active buyer account should not create duplicates.');
        }
    }

    @IsTest
    static void registerBuyerSurfacesDefaultGatewayErrors() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();
            BuyerSelfRegistrationService.accountOwnerIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.buyerGroupIdOverride = UserInfo.getUserId();
            BuyerSelfRegistrationService.externalUserErrorOverride = 'Registration service unavailable.';

            Test.startTest();
            BuyerSelfRegistrationService.RegistrationResponse result =
                BuyerSelfRegistrationService.registerBuyer(buildRequest());
            Test.stopTest();

            System.assertEquals(false, result.success, 'Injected gateway failures should return a handled error.');
            System.assertEquals('Registration service unavailable.', result.message);
        }
    }

    @IsTest
    static void registerBuyerCoversMembershipAndAliasFallbacks() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            Account existingAccount = [SELECT Id FROM Account WHERE Name = 'Existing Customer' LIMIT 1];
            Contact contact = [SELECT Id FROM Contact WHERE Email = 'existing@example.com' LIMIT 1];

            BuyerSelfRegistrationService.ExternalUserOutcome outcome =
                new BuyerSelfRegistrationService.ExternalUserOutcome();
            outcome.userId = UserInfo.getUserId();
            outcome.contactId = contact.Id;
            outcome.accountId = existingAccount.Id;

            BuyerSelfRegistrationService.externalUserOutcomeOverride = outcome;
            BuyerSelfRegistrationService.accountOwnerIdOverride = UserInfo.getUserId();
            CommerceRegistrationProvisioning.buyerGroupIdOverride = existingAccount.Id;
            CommerceRegistrationProvisioning.buyerMembershipExistsOverride = true;
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getProfileId();

            BuyerSelfRegistrationService.RegistrationRequest req = buildRequest();
            req.firstName = '!!!';
            req.lastName = '###';

            Test.startTest();
            BuyerSelfRegistrationService.RegistrationResponse result =
                BuyerSelfRegistrationService.registerBuyer(req);
            Test.stopTest();

            System.assertEquals(true, result.success, 'Fallback alias and nickname generation should still allow registration.');
            System.assertEquals(existingAccount.Id, result.accountId, 'A non-null account outcome should be preserved.');
            System.assertEquals(null, CommerceRegistrationProvisioning.lastAssignedBuyerId, 'No buyer assignment should run when membership already exists.');
        }
    }

    private static BuyerSelfRegistrationService.RegistrationRequest buildRequest() {
        BuyerSelfRegistrationService.RegistrationRequest req =
            new BuyerSelfRegistrationService.RegistrationRequest();
        req.firstName = 'Pat';
        req.lastName = 'Buyer';
        req.email = 'pat.buyer@example.com';
        req.confirmEmail = 'pat.buyer@example.com';
        req.organizationName = 'Springfield Middle School';
        req.password = 'Password1!';
        req.confirmPassword = 'Password1!';
        req.marketingConsent = false;
        return req;
    }

    private static User createRunAsUser() {
        String uniqueToken = String.valueOf(System.currentTimeMillis());
        User runAsUser = new User(
            Alias = 'testrun',
            Email = 'buyer.test.' + uniqueToken + '@example.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Runner',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Chicago',
            Username = 'buyer.test.' + uniqueToken + '@example.test'
        );
        insert runAsUser;
        return runAsUser;
    }
}