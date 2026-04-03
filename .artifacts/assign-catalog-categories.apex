// Assign uncatalogued active Product2 records to their matching ProductCategory
// Map of Category__c value → ProductCategory.Id (American Book Company Catalog)
Map<String, String> catMap = new Map<String, String>{
    'Math'           => '0ZGam000000isBBGAY',
    'English'        => '0ZGam000000isCnGAI',
    'Reading'        => '0ZGam000000isEPGAY',
    'Social Studies' => '0ZGam000000isG1GAI',
    'Science'        => '0ZGam000000isHdGAI',
    'Writing'        => '0ZGam000000isJFGAY'
};
// Products with null Category__c go into "Shop All"
String shopAllCategoryId = '0ZGam000000itATGAY';

// Get all Product2 Ids that are already in the catalog
Set<Id> alreadyCatalogued = new Set<Id>();
for (ProductCategoryProduct pcp : [
    SELECT ProductId FROM ProductCategoryProduct
]) {
    alreadyCatalogued.add(pcp.ProductId);
}

// Query all active products NOT yet in catalog
List<Product2> products = [
    SELECT Id, Category__c
    FROM Product2
    WHERE IsActive = true
    AND Id NOT IN :alreadyCatalogued
];

List<ProductCategoryProduct> toInsert = new List<ProductCategoryProduct>();
Integer skipped = 0;

for (Product2 p : products) {
    String targetCategoryId = catMap.get(p.Category__c);
    if (targetCategoryId == null) {
        // null or unrecognised Category__c → Shop All
        targetCategoryId = shopAllCategoryId;
    }
    toInsert.add(new ProductCategoryProduct(
        ProductId          = p.Id,
        ProductCategoryId  = targetCategoryId
    ));
}

System.debug('Products to assign: ' + toInsert.size());

if (!toInsert.isEmpty()) {
    Database.SaveResult[] results = Database.insert(toInsert, false); // allOrNone=false
    Integer success = 0, failed = 0;
    for (Database.SaveResult sr : results) {
        if (sr.isSuccess()) success++;
        else {
            failed++;
            if (failed <= 5) System.debug('Error: ' + sr.getErrors());
        }
    }
    System.debug('Done. Inserted: ' + success + '  Failed: ' + failed);
} else {
    System.debug('Nothing to insert — all products are already catalogued.');
}
