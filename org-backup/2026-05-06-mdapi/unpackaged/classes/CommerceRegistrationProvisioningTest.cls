@SuppressWarnings('PMD.ApexDoc')
@IsTest
private class CommerceRegistrationProvisioningTest {
    @IsTest
    static void ensureB2BBuyerEntitlementsAssignsPermissionArtifactsFromStringUserId() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            CommerceRegistrationProvisioning.resetTestState();
            CommerceRegistrationProvisioning.permissionSetIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetLicenseIdOverride = UserInfo.getProfileId();
            CommerceRegistrationProvisioning.permissionSetGroupIdOverride = UserInfo.getProfileId();

            Test.startTest();
            CommerceRegistrationProvisioning.ensureB2BBuyerEntitlements(String.valueOf(UserInfo.getUserId()));
            Test.stopTest();

            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastPermissionSetAssignedUserId);
            System.assertEquals(UserInfo.getProfileId(), CommerceRegistrationProvisioning.lastAssignedPermissionSetId);
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastPermissionSetLicenseAssignedUserId);
            System.assertEquals(UserInfo.getProfileId(), CommerceRegistrationProvisioning.lastAssignedPermissionSetLicenseId);
            System.assertEquals(UserInfo.getUserId(), CommerceRegistrationProvisioning.lastPermissionSetGroupAssignedUserId);
            System.assertEquals(UserInfo.getProfileId(), CommerceRegistrationProvisioning.lastAssignedPermissionSetGroupId);
        }
    }

    @IsTest
    static void ensureBuyerAccessSurfacesMissingBuyerGroupMessage() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            CommerceRegistrationProvisioning.resetTestState();

            Account account = new Account(
                Name = 'Missing Buyer Group School',
                OwnerId = UserInfo.getUserId()
            );
            insert account;

            try {
                CommerceRegistrationProvisioning.ensureBuyerAccess(
                    account.Id,
                    'Buyer Group That Does Not Exist',
                    'Buyer setup is incomplete. Please contact support.'
                );
                System.assert(false, 'A missing buyer group should raise a handled exception.');
            } catch (AuraHandledException ex) {
                System.assertEquals('Buyer setup is incomplete. Please contact support.', ex.getMessage());
            }
        }
    }

    @IsTest
    static void ensureBuyerAccountLoadsAccountById() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            CommerceRegistrationProvisioning.resetTestState();

            Account account = new Account(
                Name = 'Provisioning Id Coverage School',
                OwnerId = UserInfo.getUserId()
            );
            insert account;

            Test.startTest();
            CommerceRegistrationProvisioning.ensureBuyerAccount(account.Id);
            Test.stopTest();

            BuyerAccount buyerAccount = [
                SELECT BuyerId, BuyerStatus, CommerceType, IsActive
                FROM BuyerAccount
                WHERE BuyerId = :account.Id
                LIMIT 1
            ];
            System.assertEquals(account.Id, buyerAccount.BuyerId);
            System.assertEquals('Active', buyerAccount.BuyerStatus);
            System.assertEquals('Buyer', buyerAccount.CommerceType);
            System.assertEquals(true, buyerAccount.IsActive);
        }
    }

    @IsTest(SeeAllData=true)
    static void ensureBuyerAccessCreatesAndReusesConfiguredBuyerGroupMembership() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            CommerceRegistrationProvisioning.resetTestState();

            Account account = new Account(
                Name = 'Provisioning Buyer Group School',
                OwnerId = UserInfo.getUserId()
            );
            insert account;
            CommerceRegistrationProvisioning.ensureBuyerAccount(account);

            Test.startTest();
            CommerceRegistrationProvisioning.ensureBuyerAccess(
                account.Id,
                'American Book Company Buyer Group',
                'Buyer setup is incomplete. Please contact support.'
            );
            CommerceRegistrationProvisioning.ensureBuyerAccess(
                account.Id,
                'American Book Company Buyer Group',
                'Buyer setup is incomplete. Please contact support.'
            );
            Test.stopTest();

            Integer membershipCount = [
                SELECT COUNT()
                FROM BuyerGroupMember
                WHERE BuyerId = :account.Id
            ];
            System.assertEquals(1, membershipCount, 'The configured buyer group membership should be created once.');
        }
    }

    private static User createRunAsUser() {
        String uniqueToken = String.valueOf(System.currentTimeMillis());
        User runAsUser = new User(
            Alias = 'cmrprov',
            Email = 'commerce.provisioning.' + uniqueToken + '@example.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Runner',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Chicago',
            Username = 'commerce.provisioning.' + uniqueToken + '@example.test'
        );
        insert runAsUser;
        return runAsUser;
    }
}