public without sharing class ProductVariationController {
  public class ProductSearchFieldResult {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String stockKeepingUnit;
    @AuraEnabled
    public String gradeLevel;
    @AuraEnabled
    public String category;
    @AuraEnabled
    public String series;
    @AuraEnabled
    public String state;
  }

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

  @AuraEnabled(cacheable=true)
  public static List<ProductSearchFieldResult> getProductSearchFields(
    List<String> productIds
  ) {
    List<ProductSearchFieldResult> results = new List<ProductSearchFieldResult>();
    if (productIds == null || productIds.isEmpty()) {
      return results;
    }

    Set<Id> normalizedIds = new Set<Id>();
    for (String rawId : productIds) {
      String trimmedId = String.valueOf(rawId).trim();
      if (String.isBlank(trimmedId)) {
        continue;
      }

      try {
        normalizedIds.add((Id) trimmedId);
      } catch (Exception e) {
        // Ignore malformed IDs from the client payload.
      }
    }

    if (normalizedIds.isEmpty()) {
      return results;
    }

    for (Product2 product : [
      SELECT
        Id,
        StockKeepingUnit,
        Grade_Level__c,
        Category__c,
        Series__c,
        State__c
      FROM Product2
      WHERE Id IN :normalizedIds
    ]) {
      ProductSearchFieldResult row = new ProductSearchFieldResult();
      row.id = product.Id;
      row.stockKeepingUnit = product.StockKeepingUnit;
      row.gradeLevel = product.Grade_Level__c;
      row.category = product.Category__c;
      row.series = product.Series__c;
      row.state = product.State__c;
      results.add(row);
    }

    return results;
  }

  private static VariationResult buildFormatTabs(Id productId) {
    VariationResult result = new VariationResult();
    result.variations = new List<VariationPricing>();
    result.hasVariations = false;
    List<Product2> baseProducts = [
      SELECT Id, Name
      FROM Product2
      WHERE Id = :productId
      LIMIT 1
    ];
    Product2 baseProduct = baseProducts.isEmpty() ? null : baseProducts[0];
    Map<String, Id> formatProductIdByKey = buildFormatProductIdMap(baseProduct);

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
      vp.productId = String.valueOf(
        resolveFormatProductId(
          formatProductIdByKey,
          productId,
          fmt.Format_Name__c
        )
      );
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

        // Tier 2: bulk threshold onward
        // upperBound is null (or >9999 sentinel) → no real max → send as null
        TierInfo tier2 = new TierInfo();
        tier2.lowerBound = fmt.Bulk_Threshold__c;
        tier2.upperBound = (fmt.Max_Quantity__c != null &&
          fmt.Max_Quantity__c <= 9999)
          ? fmt.Max_Quantity__c
          : null;
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

  private static Map<String, Id> buildFormatProductIdMap(Product2 baseProduct) {
    Map<String, Id> byKey = new Map<String, Id>();
    if (baseProduct == null || String.isBlank(baseProduct.Name)) {
      return byKey;
    }

    String prefix = baseProduct.Name + ' - ';
    String likeValue = String.escapeSingleQuotes(prefix) + '%';
    for (Product2 variant : [
      SELECT Id, Name
      FROM Product2
      WHERE IsActive = TRUE AND Name LIKE :likeValue
    ]) {
      String suffix = variant.Name != null && variant.Name.startsWith(prefix)
        ? variant.Name.substring(prefix.length())
        : null;
      String key = normalizeFormatKey(suffix);
      if (String.isBlank(key)) {
        continue;
      }
      if (!byKey.containsKey(key)) {
        byKey.put(key, variant.Id);
      }
    }

    return byKey;
  }

  private static Id resolveFormatProductId(
    Map<String, Id> formatProductIdByKey,
    Id fallbackProductId,
    String formatName
  ) {
    if (formatProductIdByKey == null || formatProductIdByKey.isEmpty()) {
      return fallbackProductId;
    }

    String directKey = normalizeFormatKey(formatName);
    if (!String.isBlank(directKey) && formatProductIdByKey.containsKey(directKey)) {
      return formatProductIdByKey.get(directKey);
    }

    for (String alias : formatAliases(formatName)) {
      if (formatProductIdByKey.containsKey(alias)) {
        return formatProductIdByKey.get(alias);
      }
    }

    return fallbackProductId;
  }

  private static Set<String> formatAliases(String formatName) {
    Set<String> aliases = new Set<String>();
    String key = normalizeFormatKey(formatName);
    if (String.isBlank(key)) {
      return aliases;
    }

    aliases.add(key);
    if (key == 'digital') {
      aliases.add('digital only');
      aliases.add('ebook');
      aliases.add('e-book');
    } else if (key == 'digital only') {
      aliases.add('digital');
    } else if (key == 'color print + digital') {
      aliases.add('color + digital');
      aliases.add('color print digital');
    } else if (key == 'b&w print + digital' || key == 'bw print + digital') {
      aliases.add('b&w + digital');
      aliases.add('bw + digital');
      aliases.add('black & white print + digital');
      aliases.add('black and white print + digital');
    }

    return aliases;
  }

  private static String normalizeFormatKey(String value) {
    if (String.isBlank(value)) {
      return null;
    }

    String normalized = value.trim().toLowerCase();
    normalized = normalized.replace('–', '-');
    normalized = normalized.replace('—', '-');
    normalized = normalized.replace(' and ', ' & ');
    normalized = normalized.replace('black/white', 'b&w');
    normalized = normalized.replace('black & white', 'b&w');
    normalized = normalized.replace('black and white', 'b&w');
    normalized = normalized.replace('e-book', 'ebook');
    normalized = normalized.replaceAll('\\s+', ' ');
    return normalized;
  }
}