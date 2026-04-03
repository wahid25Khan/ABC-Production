@SuppressWarnings('PMD.ApexDoc')
@IsTest
private class WishlistControllerTest {
    @TestSetup
    static void setupData() {
        insert new Account(Name = 'Wishlist Test School');
        insert new WebStore(Name = 'Wishlist Test Store');
        insert new Product2(Name = 'Wishlist Test Product', IsActive = true);
    }

    @IsTest
    static void getFavoriteStateReturnsFalseWhenWishlistDoesNotExist() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Account account = [SELECT Id FROM Account LIMIT 1];
            WebStore store = [SELECT Id FROM WebStore LIMIT 1];
            Product2 product = [SELECT Id FROM Product2 LIMIT 1];

            WishlistController.resetTestState();
            WishlistController.buyerAccountIdOverride = account.Id;

            Test.startTest();
            WishlistController.FavoriteStateResult result = WishlistController.getFavoriteState(
                product.Id,
                store.Id
            );
            Test.stopTest();

            System.assertEquals(true, result.success);
            System.assertEquals(false, result.favorite);
            System.assertEquals(null, result.wishlistId);
        }
    }

    @IsTest
    static void toggleFavoriteCreatesWishlistAndItem() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Account account = [SELECT Id FROM Account LIMIT 1];
            WebStore store = [SELECT Id FROM WebStore LIMIT 1];
            Product2 product = [SELECT Id FROM Product2 LIMIT 1];

            WishlistController.resetTestState();
            WishlistController.buyerAccountIdOverride = account.Id;

            Test.startTest();
            WishlistController.FavoriteStateResult result = WishlistController.toggleFavorite(
                product.Id,
                store.Id
            );
            Test.stopTest();

            System.assertEquals(true, result.success);
            System.assertEquals(true, result.favorite);
            System.assertNotEquals(null, result.wishlistId);
            System.assertNotEquals(null, result.wishlistItemId);
            System.assertEquals(1, [SELECT COUNT() FROM Wishlist WHERE AccountId = :account.Id AND WebStoreId = :store.Id]);
            System.assertEquals(1, [SELECT COUNT() FROM WishlistItem WHERE WishlistId = :result.wishlistId AND Product2Id = :product.Id]);
        }
    }

    @IsTest
    static void toggleFavoriteRemovesExistingItem() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Account account = [SELECT Id FROM Account LIMIT 1];
            WebStore store = [SELECT Id FROM WebStore LIMIT 1];
            Product2 product = [SELECT Id FROM Product2 LIMIT 1];

            Wishlist wishlist = new Wishlist(
                AccountId = account.Id,
                Name = 'My Wishlist',
                WebStoreId = store.Id
            );
            insert wishlist;

            insert new WishlistItem(
                Name = 'My Wishlist',
                Product2Id = product.Id,
                WishlistId = wishlist.Id
            );

            WishlistController.resetTestState();
            WishlistController.buyerAccountIdOverride = account.Id;

            Test.startTest();
            WishlistController.FavoriteStateResult result = WishlistController.toggleFavorite(
                product.Id,
                store.Id
            );
            Test.stopTest();

            System.assertEquals(true, result.success);
            System.assertEquals(false, result.favorite);
            System.assertEquals(0, [SELECT COUNT() FROM WishlistItem WHERE WishlistId = :wishlist.Id AND Product2Id = :product.Id]);
        }
    }

    @IsTest
    static void getFavoriteStateReturnsTrueWhenItemExists() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            Account account = [SELECT Id FROM Account LIMIT 1];
            WebStore store = [SELECT Id FROM WebStore LIMIT 1];
            Product2 product = [SELECT Id FROM Product2 LIMIT 1];

            Wishlist wishlist = new Wishlist(
                AccountId = account.Id,
                Name = 'My Wishlist',
                WebStoreId = store.Id
            );
            insert wishlist;

            WishlistItem item = new WishlistItem(
                Name = 'My Wishlist',
                Product2Id = product.Id,
                WishlistId = wishlist.Id
            );
            insert item;

            WishlistController.resetTestState();
            WishlistController.buyerAccountIdOverride = account.Id;

            Test.startTest();
            WishlistController.FavoriteStateResult result = WishlistController.getFavoriteState(
                product.Id,
                store.Id
            );
            Test.stopTest();

            System.assertEquals(true, result.success);
            System.assertEquals(true, result.favorite);
            System.assertEquals(wishlist.Id, result.wishlistId);
            System.assertEquals(item.Id, result.wishlistItemId);
        }
    }

    @IsTest
    static void toggleFavoriteRejectsMissingInputs() {
        User runAsUser = createRunAsUser();

        System.runAs(runAsUser) {
            WishlistController.resetTestState();

            Test.startTest();
            WishlistController.FavoriteStateResult result = WishlistController.toggleFavorite(null, null);
            Test.stopTest();

            System.assertEquals(false, result.success);
            System.assertEquals('A product and web store are required.', result.message);
        }
    }

    private static User createRunAsUser() {
        String uniqueToken = String.valueOf(System.currentTimeMillis());
        User runAsUser = new User(
            Alias = 'wshrunr',
            Email = 'wishlist.runner.' + uniqueToken + '@example.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Runner',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Chicago',
            Username = 'wishlist.runner.' + uniqueToken + '@example.test'
        );
        insert runAsUser;
        return runAsUser;
    }
}