@IsTest
private class ProductVariationControllerTest {
  /**
   * Uses SeeAllData=true because the org has a "Create Pricebook Entry" flow
   * that fires on Product2 insert and prevents test data creation.
   * Tests use existing org products, pricebook entries, and adjustment tiers.
   */

  @IsTest(SeeAllData=true)
  static void testSimpleProductPricing() {
    Product2 p = [SELECT Id FROM Product2 WHERE IsActive = TRUE LIMIT 1];
    Pricebook2 pb = [
      SELECT Id
      FROM Pricebook2
      WHERE Name = 'American Book Company Price Book'
      LIMIT 1
    ];

    ProductVariationController.testPricebookId = pb.Id;

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      p.Id,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    System.assert(
      !result.variations.isEmpty(),
      'Should return at least 1 pricing entry'
    );
  }

  @IsTest(SeeAllData=true)
  static void testProductWithTierPricing() {
    // Query a product that has a PricebookEntryAdjustment (tier pricing exists in the org)
    PricebookEntryAdjustment adj = [
      SELECT PricebookEntry.Product2Id, PricebookEntry.Pricebook2Id
      FROM PricebookEntryAdjustment
      LIMIT 1
    ];

    ProductVariationController.testPricebookId = adj.PricebookEntry.Pricebook2Id;

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      adj.PricebookEntry.Product2Id,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result);
    System.assert(
      !result.variations.isEmpty(),
      'Should have at least 1 variation'
    );

    ProductVariationController.VariationPricing vp = result.variations[0];
    System.assert(
      !vp.tiers.isEmpty(),
      'Product with adjustment should have tiers'
    );
  }

  @IsTest(SeeAllData=true)
  static void testWebStoreResolution() {
    Product2 p = [SELECT Id FROM Product2 WHERE IsActive = TRUE LIMIT 1];
    WebStore ws = [
      SELECT Id
      FROM WebStore
      WHERE Name = 'American Book Company'
      LIMIT 1
    ];

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      p.Id,
      ws.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, result);
    System.assert(
      !result.variations.isEmpty(),
      'Should return pricing via webstore pricebook'
    );
  }

  @IsTest
  static void testBlankProductId() {
    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      '',
      null
    );
    Test.stopTest();

    System.assertEquals(false, result.hasVariations);
    System.assertEquals(0, result.variations.size());
  }

  @IsTest
  static void testNonExistentProduct() {
    // Use a fake but valid-format Product2 ID
    ProductVariationController.testPricebookId = Test.getStandardPricebookId();

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      '01tAA0000000001MAA',
      null
    );
    Test.stopTest();

    System.assertEquals(false, result.hasVariations);
    System.assert(
      result.variations.isEmpty() || result.variations.size() == 1,
      'Non-existent product should return empty or single null-price entry'
    );
  }
}
