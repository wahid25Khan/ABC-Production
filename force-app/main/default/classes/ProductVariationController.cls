public with sharing class ProductVariationController {
  @TestVisible
  private static Id testPricebookId;

  public class TierInfo {
    @AuraEnabled
    public Decimal lowerBound;
    @AuraEnabled
    public Decimal upperBound;
    @AuraEnabled
    public Decimal price;
  }

  public class VariationPricing {
    @AuraEnabled
    public String format;
    @AuraEnabled
    public String productId;
    @AuraEnabled
    public Decimal unitPrice;
    @AuraEnabled
    public List<TierInfo> tiers;
  }

  public class VariationResult {
    @AuraEnabled
    public List<VariationPricing> variations;
    @AuraEnabled
    public Boolean hasVariations;
  }

  @AuraEnabled(cacheable=true)
  public static VariationResult getVariationPricing(
    String productId,
    String webStoreId
  ) {
    VariationResult result = new VariationResult();
    result.variations = new List<VariationPricing>();
    result.hasVariations = false;

    if (String.isBlank(productId)) {
      return result;
    }

    Id pricebookId = resolvePricebookId(webStoreId);

    // Detect parent/child relationship via ProductAttribute records
    // instead of ProductClass (which is system-managed and not writable via Apex)
    Id parentId;

    // Check if this product is a variation parent (has children)
    List<ProductAttribute> childAttrs = [
      SELECT ProductId
      FROM ProductAttribute
      WHERE VariantParentId = :productId
      LIMIT 1
    ];
    if (!childAttrs.isEmpty()) {
      parentId = productId;
    } else {
      // Check if this product is a variation child
      List<ProductAttribute> selfAttr = [
        SELECT VariantParentId
        FROM ProductAttribute
        WHERE ProductId = :productId
        LIMIT 1
      ];
      if (!selfAttr.isEmpty()) {
        parentId = selfAttr[0].VariantParentId;
      }
    }

    if (parentId != null) {
      List<ProductAttribute> attrs = [
        SELECT ProductId, Format__c
        FROM ProductAttribute
        WHERE VariantParentId = :parentId AND Format__c != NULL
        ORDER BY Format__c
      ];

      if (!attrs.isEmpty()) {
        result.hasVariations = true;

        Set<Id> childIds = new Set<Id>();
        Map<Id, String> childFormats = new Map<Id, String>();
        for (ProductAttribute attr : attrs) {
          childIds.add(attr.ProductId);
          childFormats.put(attr.ProductId, attr.Format__c);
        }

        Map<Id, VariationPricing> pricingMap = buildPricingMap(
          childIds,
          childFormats,
          pricebookId
        );

        for (ProductAttribute attr : attrs) {
          VariationPricing vp = pricingMap.get(attr.ProductId);
          if (vp != null) {
            result.variations.add(vp);
          }
        }
      }
    }

    if (result.variations.isEmpty()) {
      result.hasVariations = false;
      Set<Id> singleSet = new Set<Id>{ productId };
      Map<Id, String> singleFormats = new Map<Id, String>{ productId => null };
      Map<Id, VariationPricing> pricingMap = buildPricingMap(
        singleSet,
        singleFormats,
        pricebookId
      );
      VariationPricing vp = pricingMap.get(productId);
      if (vp != null) {
        result.variations.add(vp);
      }
    }

    return result;
  }

  private static Id resolvePricebookId(String webStoreId) {
    if (Test.isRunningTest() && testPricebookId != null) {
      return testPricebookId;
    }

    if (String.isBlank(webStoreId)) {
      return null;
    }

    List<WebStorePricebook> wsPbs = [
      SELECT Pricebook2Id
      FROM WebStorePricebook
      WHERE WebStoreId = :webStoreId AND IsActive = TRUE
      LIMIT 1
    ];

    return wsPbs.isEmpty() ? null : wsPbs[0].Pricebook2Id;
  }

  private static Map<Id, VariationPricing> buildPricingMap(
    Set<Id> productIds,
    Map<Id, String> formatMap,
    Id pricebookId
  ) {
    Map<Id, VariationPricing> result = new Map<Id, VariationPricing>();

    List<PricebookEntry> pbes;
    if (pricebookId != null) {
      pbes = [
        SELECT Id, Product2Id, UnitPrice
        FROM PricebookEntry
        WHERE
          Product2Id IN :productIds
          AND Pricebook2Id = :pricebookId
          AND IsActive = TRUE
      ];
    } else {
      pbes = [
        SELECT Id, Product2Id, UnitPrice
        FROM PricebookEntry
        WHERE Product2Id IN :productIds AND IsActive = TRUE
      ];
    }

    Map<Id, PricebookEntry> productToPbe = new Map<Id, PricebookEntry>();
    Set<Id> pbeIds = new Set<Id>();
    for (PricebookEntry pbe : pbes) {
      if (!productToPbe.containsKey(pbe.Product2Id)) {
        productToPbe.put(pbe.Product2Id, pbe);
        pbeIds.add(pbe.Id);
      }
    }

    Map<Id, Id> pbeToSchedule = new Map<Id, Id>();
    if (!pbeIds.isEmpty()) {
      for (PricebookEntryAdjustment adj : [
        SELECT PricebookEntryId, PriceAdjustmentScheduleId
        FROM PricebookEntryAdjustment
        WHERE PricebookEntryId IN :pbeIds
      ]) {
        pbeToSchedule.put(adj.PricebookEntryId, adj.PriceAdjustmentScheduleId);
      }
    }

    Set<Id> scheduleIds = new Set<Id>(pbeToSchedule.values());
    Map<Id, List<TierInfo>> scheduleTierMap = new Map<Id, List<TierInfo>>();
    if (!scheduleIds.isEmpty()) {
      for (PriceAdjustmentTier tier : [
        SELECT PriceAdjustmentScheduleId, LowerBound, UpperBound, TierValue
        FROM PriceAdjustmentTier
        WHERE PriceAdjustmentScheduleId IN :scheduleIds
        ORDER BY LowerBound ASC
      ]) {
        if (!scheduleTierMap.containsKey(tier.PriceAdjustmentScheduleId)) {
          scheduleTierMap.put(
            tier.PriceAdjustmentScheduleId,
            new List<TierInfo>()
          );
        }
        TierInfo ti = new TierInfo();
        ti.lowerBound = tier.LowerBound;
        ti.upperBound = tier.UpperBound;
        ti.price = tier.TierValue;
        scheduleTierMap.get(tier.PriceAdjustmentScheduleId).add(ti);
      }
    }

    for (Id prodId : productIds) {
      VariationPricing vp = new VariationPricing();
      vp.productId = prodId;
      vp.format = formatMap.get(prodId);
      vp.tiers = new List<TierInfo>();

      PricebookEntry pbe = productToPbe.get(prodId);
      if (pbe != null) {
        vp.unitPrice = pbe.UnitPrice;
        Id schedId = pbeToSchedule.get(pbe.Id);
        if (schedId != null && scheduleTierMap.containsKey(schedId)) {
          vp.tiers = scheduleTierMap.get(schedId);
        }
      }

      result.put(prodId, vp);
    }

    return result;
  }
}
