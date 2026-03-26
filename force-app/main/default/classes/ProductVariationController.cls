public without sharing class ProductVariationController {
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
    @AuraEnabled
    public Decimal minimumQuantity;
    @AuraEnabled
    public Decimal maximumQuantity;
    @AuraEnabled
    public Decimal incrementQuantity;
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

    result = buildFormatTabs(productId);

    return result;
  }

  private static VariationResult buildFormatTabs(Id productId) {
    VariationResult result = new VariationResult();
    result.variations = new List<VariationPricing>();
    result.hasVariations = false;

    // Query per-product format pricing records from the custom object
    List<ProductFormatPricing__c> formats = [
      SELECT
        Format_Name__c,
        Unit_Price__c,
        Bulk_Price__c,
        Bulk_Threshold__c,
        Min_Quantity__c,
        Max_Quantity__c,
        Increment_Quantity__c,
        Sort_Order__c
      FROM ProductFormatPricing__c
      WHERE Product__c = :productId AND Is_Active__c = TRUE
      ORDER BY Sort_Order__c ASC NULLS LAST
    ];

    if (formats.isEmpty()) {
      return result;
    }

    for (ProductFormatPricing__c fmt : formats) {
      VariationPricing vp = new VariationPricing();
      vp.format = fmt.Format_Name__c;
      vp.productId = productId;
      vp.unitPrice = fmt.Unit_Price__c;
      vp.tiers = new List<TierInfo>();
      vp.minimumQuantity = fmt.Min_Quantity__c;
      vp.maximumQuantity = fmt.Max_Quantity__c;
      vp.incrementQuantity = fmt.Increment_Quantity__c;

      // Build tier pricing: Tier 1 = unit price up to bulk threshold,
      // Tier 2 = bulk price from threshold onward
      if (fmt.Bulk_Price__c != null && fmt.Bulk_Threshold__c != null) {
        // Tier 1: min qty to bulk threshold - 1
        TierInfo tier1 = new TierInfo();
        tier1.lowerBound = fmt.Min_Quantity__c != null
          ? fmt.Min_Quantity__c
          : 1;
        tier1.upperBound = fmt.Bulk_Threshold__c - 1;
        tier1.price = fmt.Unit_Price__c;
        vp.tiers.add(tier1);

        // Tier 2: bulk threshold onward (null upperBound = no maximum)
        TierInfo tier2 = new TierInfo();
        tier2.lowerBound = fmt.Bulk_Threshold__c;
        tier2.upperBound = fmt.Max_Quantity__c;
        tier2.price = fmt.Bulk_Price__c;
        vp.tiers.add(tier2);
      }

      result.variations.add(vp);
    }

    if (result.variations.size() > 1) {
      result.hasVariations = true;
    }

    return result;
  }
}
