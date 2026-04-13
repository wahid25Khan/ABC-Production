@IsTest
private class ProductVariationControllerTest {
  @IsTest(SeeAllData=true)
  static void testProductWithFormatPricing() {
    // Find a Georgia product that has ProductFormatPricing__c records
    List<ProductFormatPricing__c> pfps = [
      SELECT Product__c, Product__r.Name
      FROM ProductFormatPricing__c
      WHERE Is_Active__c = TRUE
      LIMIT 1
    ];

    if (pfps.isEmpty()) {
      return; // No format pricing records exist yet
    }

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      pfps[0].Product__c,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result, 'Result should not be null');
    System.assert(
      !result.variations.isEmpty(),
      'Should return at least 1 format tab'
    );
  }

  @IsTest(SeeAllData=true)
  static void testMultiFormatTabs() {
    // Find a product with multiple format pricings
    List<AggregateResult> multi = [
      SELECT Product__c pid, COUNT(Id) cnt
      FROM ProductFormatPricing__c
      WHERE Is_Active__c = TRUE
      GROUP BY Product__c
      HAVING COUNT(Id) > 1
      LIMIT 1
    ];

    if (multi.isEmpty()) {
      return;
    }

    Id productId = (Id) multi[0].get('pid');

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      productId,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result);
    System.assertEquals(
      true,
      result.hasVariations,
      'Should have multiple format tabs'
    );
    System.assert(
      result.variations.size() > 1,
      'Should return more than 1 variation'
    );

    for (ProductVariationController.VariationPricing vp : result.variations) {
      System.assertEquals(
        productId,
        vp.productId,
        'All tabs should use the same product ID'
      );
      System.assertNotEquals(null, vp.format, 'Format name should not be null');
      System.assertNotEquals(
        null,
        vp.unitPrice,
        'Unit price should not be null'
      );
    }
  }

  @IsTest(SeeAllData=true)
  static void testTierPricingFromBulkFields() {
    // Find a format pricing with bulk price/threshold
    List<ProductFormatPricing__c> pfps = [
      SELECT Product__c
      FROM ProductFormatPricing__c
      WHERE
        Is_Active__c = TRUE
        AND Bulk_Price__c != NULL
        AND Bulk_Threshold__c != NULL
      LIMIT 1
    ];

    if (pfps.isEmpty()) {
      return;
    }

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      pfps[0].Product__c,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result);
    Boolean foundTiers = false;
    for (ProductVariationController.VariationPricing vp : result.variations) {
      if (!vp.tiers.isEmpty()) {
        foundTiers = true;
        System.assertEquals(
          2,
          vp.tiers.size(),
          'Should have 2 tiers (unit + bulk)'
        );
        System.assert(
          vp.tiers[1].price < vp.tiers[0].price,
          'Bulk tier price should be less than unit tier price'
        );
      }
    }
    System.assert(
      foundTiers,
      'Should have found at least one format with tiers'
    );
  }

  @IsTest(SeeAllData=true)
  static void testQuantityRulesFromFormat() {
    List<ProductFormatPricing__c> pfps = [
      SELECT Product__c
      FROM ProductFormatPricing__c
      WHERE Is_Active__c = TRUE AND Min_Quantity__c != NULL
      LIMIT 1
    ];

    if (pfps.isEmpty()) {
      return;
    }

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      pfps[0].Product__c,
      null
    );
    Test.stopTest();

    System.assertNotEquals(null, result);
    if (!result.variations.isEmpty()) {
      ProductVariationController.VariationPricing vp = result.variations[0];
      System.assertNotEquals(
        null,
        vp.minimumQuantity,
        'Should have min quantity'
      );
    }
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
    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      '01tAA0000000001MAA',
      null
    );
    Test.stopTest();

    System.assertEquals(false, result.hasVariations);
    System.assertEquals(0, result.variations.size());
  }

  @IsTest(SeeAllData=true)
  static void testWebStoreIdPassedButIgnored() {
    // webStoreId is accepted but no longer used — verify it doesn't break
    List<ProductFormatPricing__c> pfps = [
      SELECT Product__c
      FROM ProductFormatPricing__c
      WHERE Is_Active__c = TRUE
      LIMIT 1
    ];

    if (pfps.isEmpty()) {
      return;
    }

    WebStore ws = [
      SELECT Id
      FROM WebStore
      WHERE Name = 'American Book Company'
      LIMIT 1
    ];

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      pfps[0].Product__c,
      ws.Id
    );
    Test.stopTest();

    System.assertNotEquals(null, result);
    System.assert(!result.variations.isEmpty(), 'Should return format tabs');
  }

  @IsTest(SeeAllData=true)
  static void testNoFormatPricingReturnsEmpty() {
    // Find a product that does NOT have any ProductFormatPricing__c records
    List<Product2> prods = [
      SELECT Id
      FROM Product2
      WHERE
        IsActive = TRUE
        AND Id NOT IN (
          SELECT Product__c
          FROM ProductFormatPricing__c
          WHERE Is_Active__c = TRUE
        )
      LIMIT 1
    ];

    if (prods.isEmpty()) {
      return;
    }

    Test.startTest();
    ProductVariationController.VariationResult result = ProductVariationController.getVariationPricing(
      prods[0].Id,
      null
    );
    Test.stopTest();

    System.assertEquals(false, result.hasVariations);
    System.assertEquals(0, result.variations.size());
  }
}