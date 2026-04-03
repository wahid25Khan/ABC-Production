@SuppressWarnings('PMD.ApexDoc')
@IsTest(SeeAllData=true)
private class BuyerSelfRegQueryCovTest {
    @IsTest
    static void resolvesConfiguredBuyerGroupAndMembershipQuery() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            Id buyerGroupId = BuyerSelfRegistrationService.resolveBuyerGroupId('American Book Company Buyer Group');
            Account anyAccount = [SELECT Id FROM Account LIMIT 1];
            Boolean membershipExists = BuyerSelfRegistrationService.hasExistingBuyerMembership(anyAccount.Id, buyerGroupId);

            System.assertNotEquals(null, buyerGroupId, 'The store buyer group should be queryable.');
            System.assertNotEquals(null, membershipExists, 'Membership query should return a boolean result.');
        }
    }

    @IsTest
    static void resolvesConfiguredOwnerAndShopperProfile() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            BuyerSelfRegistrationService.resetTestState();

            Id ownerId = BuyerSelfRegistrationService.resolveAccountOwnerId();
            Id profileId = BuyerSelfRegistrationService.resolveShopperProfileId();

            System.assertNotEquals(null, ownerId, 'A default internal owner with a role should be available.');
            System.assertNotEquals(null, profileId, 'The shopper profile should be available.');
        }
    }

    private static User createRunAsUser() {
        String uniqueToken = String.valueOf(System.currentTimeMillis());
        User runAsUser = new User(
            Alias = 'qrycovr',
            Email = 'query.coverage.' + uniqueToken + '@example.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Runner',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Chicago',
            Username = 'query.coverage.' + uniqueToken + '@example.test'
        );
        insert runAsUser;
        return runAsUser;
    }
}