# ABC-Production — Copilot Context

> Read this file at the start of every session to avoid repeating discovery work.

---

## Org & Authentication

| Detail | Value |
|---|---|
| Org alias | `ABC-Production` |
| Username | `wahid@americanbook.com` |
| Org ID | `00Dam00001aloiTEAQ` |
| Instance | `americanbookcompany.my.salesforce.com` |
| API Version | `66.0` |
| SF CLI command | `sf` (v2+) |

**Verify auth:** `sf org display --target-org ABC-Production`

---

## B2B Commerce Configuration

| Detail | Value |
|---|---|
| WebStore Name | `AmericanBookCompany` |
| WebStore ID | `0ZEam000004dJDNGA2` |
| Community Path | `/AmericanBookCompany` |
| Active Pricebook | `American Book Company Price Book` |
| Pricebook ID | `01sam0000041Az8AAE` |
| BuyerGroup | `American Book Company Buyer Group` |
| BuyerGroup ID | `0ZIam000000djN3GAI` |
| PriceAdjustmentSchedule | `ABC - English I Foundations - Qty Pricing` |
| PriceAdjustmentSchedule ID | `84XWj000001LkFNMA0` |

**Existing data:**
- 499 `PricebookEntry` records — all at **$41.00**
- `PriceAdjustmentSchedule` has 2 tiers: qty 10–24 = $41, qty 25+ = $25.25 (33 products assigned via `PricebookEntryAdjustment`)

---

## OOB Quantity Rules (PurchaseQuantityRule)

These are **Salesforce OOB objects** — NOT custom metadata. Do not recreate as CMT.

| Rule Name | ID | Min | Max | Increment | Assigned To |
|---|---|---|---|---|---|
| Demo Bulk Order Rule | `0lKWj00000000hZMAQ` | 10 | 50 | 10 | English I Foundations, Economics Foundations, NC Math 3 EOC |
| Demo Limited Rule | `0lKWj00000000jBMAQ` | 1 | 5 | 1 | Georgia K-12 Grade 6 ELA |
| ABC - English I Foundations - Min 10 | `0lKWj00000000cjMAA` | 10 | 1,000,000,000 | 1 | (existing, pre-demo) |

**Junction object:** `ProductQuantityRule` links `Product2` → `PurchaseQuantityRule`

**Sentinel value:** Salesforce uses `100,000,000` for "no maximum". The LWC guards with `ruleMax <= 9999` and falls back to default 50.

**Default fallback (no rule assigned):** min=10, max=50, inc=1

---

## Demo Products

| Product Name | Product ID | Quantity Rule |
|---|---|---|
| English I Foundations | `01tam00000BCBatAAH` | Bulk (min=10, max=50, inc=10) |
| Economics Foundations | `01tam00000BCBauAAH` | Bulk (min=10, max=50, inc=10) |
| NC Math 3 EOC | `01tam00000BCCn4AAH` | Bulk (min=10, max=50, inc=10) |
| Georgia K-12 Grade 6 ELA | `01tWj00000BRfaDIAT` | Limited (min=1, max=5, inc=1) |
| All other products | — | Default (min=10, max=50, inc=1) |

---

## Architecture — Key Decisions

### Pricing
- Unit price is always **$41** (set in `Create_Pricebook_Entry` flow)
- **Order Total formula:** `unitPrice × (qty / increment)`
  - e.g. $41 unit price, increment=10, qty=20 → 41 × (20/10) = **$82**
- UI shows: unit price once (static) + live order total (reactive to qty input)

### Quantity Rules — OOB First
- Uses native `PurchaseQuantityRule` + `ProductQuantityRule` objects (NOT custom metadata)
- Commerce Products API automatically embeds `purchaseQuantityRule` in product response when a rule is assigned
- Field must be explicitly requested: `purchaseQuantityRule` in the `fields=` parameter

### What Was Removed (Do NOT Re-add)
- ~~`Product_Quantity_Rule__mdt`~~ — replaced by OOB `PurchaseQuantityRule`
- ~~`ProductQuantityRuleController.cls`~~ — Apex wire not needed; data comes from Commerce API
- ~~`customMetadata/` records~~ — replaced by OOB data in org

---

## LWC Components

### `customResults` (search/listing page)
- File: `force-app/main/default/lwc/customResults/customResults.js`
- Fetches products in batch; `'purchaseQuantityRule'` must be in `PRODUCT_DETAIL_FIELDS`
- Passes `modalMinimumQuantity`, `modalMaximumQuantity`, `modalIncrementQuantity` to `quickShopModal`

### `quickShopModal` (quick-add popup from listing)
- File: `force-app/main/default/lwc/quickShopModal/quickShopModal.js`
- Receives qty rule values as `@api` props from `customResults`
- `totalPrice` getter: `unitPrice × (qty / increment)`
- No Apex, no wire — pure prop-driven

### `productDetailComponent` (full product detail page)
- File: `force-app/main/default/lwc/productDetailComponent/productDetailComponent.js`
- Fetches single product from Commerce API; reads `product.purchaseQuantityRule` directly
- `totalPrice` getter: same formula as above
- `formattedUnitPrice` getter: formats the unit price for display

### `customResults` (HTML)
- File: `force-app/main/default/lwc/customResults/customResults.html`
- `<c-quick-shop-modal>` receives: `minimum-quantity`, `maximum-quantity`, `increment-quantity`

---

## Flow

### `Create_Pricebook_Entry`
- **Trigger:** Product2 AfterSave (Create + Update)
- **Purpose:** Creates PricebookEntry in all active pricebooks for new products
- **Status:** Active ✅
- **Unit Price:** `41.0` (fixed)
- **Note:** Only fires for new/updated products. All 499 existing entries are already at $41.
- **Known issue:** If a PricebookEntry already exists, the flow throws a duplicate error. Consider adding a fault path or a `Get Records` check before creating.

---

## Common Commands

```bash
# Deploy LWC only (fastest)
sf project deploy start \
  --source-dir force-app/main/default/lwc/productDetailComponent \
  --source-dir force-app/main/default/lwc/quickShopModal \
  --source-dir force-app/main/default/lwc/customResults \
  --target-org ABC-Production --wait 10

# Deploy everything
sf project deploy start --manifest manifest/package.xml --target-org ABC-Production --wait 10

# Query quantity rules
sf data query --query "SELECT Id, Name, Minimum, Maximum, Increment FROM PurchaseQuantityRule" --target-org ABC-Production

# Query product-rule assignments
sf data query --query "SELECT ProductId, PurchaseQuantityRule.Name, Minimum, Maximum, Increment FROM ProductQuantityRule" --target-org ABC-Production

# Assign a product to a quantity rule
sf data create record --sobject ProductQuantityRule \
  --values "Product2Id='<ProductId>' PurchaseQuantityRuleId='<RuleId>'" \
  --target-org ABC-Production

# Check pricebook entries
sf data query --query "SELECT COUNT() FROM PricebookEntry WHERE Pricebook2Id = '01sam0000041Az8AAE' AND UnitPrice = 41" --target-org ABC-Production

# Open org
sf org open --target-org ABC-Production

# Open flows setup
sf org open --path "/lightning/setup/Flows/home" --target-org ABC-Production
```

---

## Known Remaining Issues / Next Steps

1. **Flow fault path** — `Create_Pricebook_Entry` has no fault connector; duplicate PricebookEntry on existing products causes unhandled error. Add a `Get Records` check or fault path.
2. **More demo products** — To add more products to a quantity rule, create `ProductQuantityRule` junction records (see command above).
3. **PriceAdjustmentSchedule** — Volume pricing schedule exists (10–24=$41, 25+=$25.25) but only 33 products are linked via `PricebookEntryAdjustment`. Can be extended.
4. **Git workflow** — Repo is `wahid25Khan/ABC-Production` (private). Always commit + push after deploying changes.
