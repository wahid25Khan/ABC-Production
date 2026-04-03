# ABC Production — Data Model Review & Cleanup Plan

**Date:** 2026-03-28
**Status:** Step 1 pending (read-only analysis) — awaiting resume

---

## 1. Session Summary — What Was Done

### Bugs Fixed & Deployed

| Issue | Root Cause | Fix | File | Status |
|---|---|---|---|---|
| `INVALID_INPUT: You've reached the limit of 200 product IDs` | `fetchPricingForProducts()` sent all product IDs (up to 960) in a single unbatched GET to the pricing API | Added `PRICING_BATCH_SIZE = 200` constant and batched the pricing calls using existing `chunkArray()` helper | `customResults.js:606-629` | Deployed + Published |
| Product images showing default SVG | `hydrateProductsWithFields()` overwrote search API's `defaultImage.url` with empty values from product-detail API | Added fallback logic to preserve search API image data when hydrated response has empty values | `customResults.js:660-668` | Deployed + Published |
| Images still not loading after code fix | **Not a code bug.** The Commerce Search API itself returns `default-product-image.svg` because products lack `ProductMedia` records | Data issue — only 543 of ~9,900 catalog products have `ProductMedia` linked | N/A — data fix needed | Identified |

### Key Discovery: Massive Product Duplication

Investigation revealed the **root cause of all data issues**: repeated data imports created duplicate Product2 records instead of using multiselect picklist fields.

---

## 2. Current Data Model State

### Record Counts

| Object | Count | Expected (after cleanup) | Notes |
|---|---|---|---|
| Product2 (active) | **8,476** | ~1,066 | **~7,400 are duplicates** |
| Product2 (inactive) | 460 | 0 | 457 abandoned VariationParent + 3 Simple |
| ProductFormatPricing__c | 9,824 | ~3,198 | Most duplicates have only 1 format vs intended 3 |
| PricebookEntry | 25,570 | ~3,198 | 3 pricebooks × product count |
| ProductCategoryProduct | 9,917 | ~2,500 | Inflated by duplicates |
| ProductMedia | 1,127 | ~1,127 | Only 543 distinct products have images |
| ProductAttribute | 0 | 0 | Abandoned variant infrastructure |
| ProductAttributeSet | 2 | 0 | "Product_Color" + "Product_Format" — never used |

### How Duplicates Were Created

| Import Date | Records | What Happened |
|---|---|---|
| Feb 18, 2026 | 324 | **Original import** — `01tam` IDs, has SKUs like `ISBN: 641170208` |
| Mar 4, 2026 | 175 | 2nd import — `01tWj` IDs, **null SKUs**, duplicates of originals |
| Mar 15, 2026 | 1,459 | 3rd import — includes `-BASE` suffix SKUs (VariationParent attempt) |
| **Mar 27, 2026** | **6,931** | **Massive duplication** — 0 new product names, all duplicates |

### Duplication Pattern

Each product was "exploded" into **one Product2 record per State × Grade combination**:

```
Example: "Biology Foundations" → 196 active Product2 records
  - 01tam00000BCKuHAAX: State=Alaska, Grade=Grade 9, SKU=ISBN: 641170208 (ORIGINAL)
  - 01tWj00000C38ofIAB: State=Alabama, Grade=Grade 10, SKU=null (DUPLICATE)
  - 01tWj00000C38pAIAR: State=Arizona, Grade=Grade 12, SKU=null (DUPLICATE)
  - ... 193 more duplicates
```

**What should have happened:** A single Product2 record with `State__c = "Alaska;Alabama;Arizona;..."` (multiselect) and `Grade_Level__c = "Grade 9;Grade 10;Grade 11;Grade 12"` (multiselect).

### ProductFormatPricing__c Breakdown

Each product should have **3 format pricing records** (Color, B&W, Digital). Currently:
- **44 products** have 3 formats (correct) — these are Mar 15 `-BASE` products
- **~9,692 products** have only 1 format (B&W only) — all the duplicates
- **~741 products** have 0 formats — no pricing data at all

### Pricebooks

| Pricebook | ID | Purpose |
|---|---|---|
| Standard Price Book | `01sam000003vfHdAAI` | Required by Salesforce |
| American Book Company Price Book | `01sam0000041Az8AAE` | Actual selling prices |
| American Book Company Strikethrough Price Book | `01sam0000041Az7AAE` | Shows crossed-out "original" price |

### Commerce Infrastructure

| Object | Count | Notes |
|---|---|---|
| WebStore | 1 | "American Book Company" (`0ZEam000004dJDNGA2`) |
| BuyerGroup | 2 | "Test Buyer Group" + "American Book Company Buyer Group" |
| WebCart | 35 | Active shopping sessions |
| CartItem | 28 | Items in carts |
| Order | 1 | Single completed order |
| OrderItem | 2 | Two items in that order |
| Account | 2 | Commerce buyer accounts — **keep** |
| Contact | 1 | Commerce contact — **keep** |
| Opportunity | 1 | **Keep** (user confirmed) |
| Case | 3 | **Keep** (user confirmed) |

---

## 3. Data Model Architecture (How it SHOULD Work)

### Product2 Record (1 per unique book title)

| Field | Type | Purpose |
|---|---|---|
| `Name` | Text | Book title, e.g. "Biology Foundations" |
| `StockKeepingUnit` | Text | ISBN, e.g. "ISBN: 641170208" |
| `ProductCode` | Text | Internal code, e.g. "62800-147-1" |
| `State__c` | Multiselect Picklist | ALL applicable states: "Alaska;Alabama;Arizona;..." |
| `Grade_Level__c` | Multiselect Picklist | ALL applicable grades: "Grade 9;Grade 10;Grade 11;Grade 12" |
| `Category__c` | Picklist | Subject: Math, English, Science, etc. |
| `Series__c` | Picklist | Series: Foundations, Common Core, LEAP 2025, etc. |
| `ProductClass` | Standard | "Simple" |
| `IsActive` | Boolean | true |

### ProductFormatPricing__c (3 per product)

| Record | Format_Name__c | Unit_Price__c | Bulk_Price__c | Bulk_Threshold__c | Min_Quantity__c | Sort_Order__c |
|---|---|---|---|---|---|---|
| 1 | Color Print + Digital | $41.00 | $25.50 | 25 | 10 | 1 |
| 2 | B&W Print + Digital | $41.00 | $25.25 | 25 | 10 | 2 |
| 3 | Digital Only | $41.00 | — | — | 50 | 3 |

### How Pricing Flows in the LWC Components

```
Product Detail Page / Quick Shop Modal:
  1. LWC calls ProductVariationController.getVariationPricing(productId)
  2. Apex queries ProductFormatPricing__c WHERE Product__c = :productId
  3. Returns format tabs: Color / B&W / Digital
  4. Each tab shows tier pricing: 10-24 @ $41, 25+ @ $25.50
  5. Add to Cart sends: { productId, quantity, type: "Product" }
     (same Product2 ID regardless of selected format)
```

**Important:** The cart payload does NOT include format (Color/B&W/Digital). The Commerce platform's checkout uses the PricebookEntry price, not the ProductFormatPricing__c price. This is a known gap — the modal shows tier pricing but the actual charge comes from the pricebook.

---

## 4. Cleanup Plan

### Step 1: Read-Only Analysis (NEXT ACTION)

Create `.artifacts/analyze-duplicates.mjs` — Node script that queries the org and generates CSVs.

**Keeper selection logic (priority order):**
1. Has `ProductMedia` records (images linked)
2. Has `PricebookEntry` in store pricebook (`01sam0000041Az8AAE`)
3. Has `ProductFormatPricing__c` records (most formats wins)
4. Has `StockKeepingUnit` (SKU/ISBN)
5. Oldest `CreatedDate`

**Output files:**

| File | Content |
|---|---|
| `.artifacts/duplicate-product-analysis.csv` | Every unique product name with: KeeperID, KeeperSKU, HasMedia, HasStorePrice, FormatCount, CombinedStates, CombinedGrades, TotalRecords, DuplicateCount, DuplicateIDs |
| `.artifacts/orphan-products.csv` | Products with no store pricebook entry, no category, no format pricing |
| `.artifacts/cleanup-summary.txt` | Aggregate counts before/after |

### Step 2: Merge State/Grade Values into Keepers

For each keeper, update `State__c` and `Grade_Level__c` to hold the union of all values from its duplicates.

### Step 3: Consolidate ProductFormatPricing__c

- Ensure each keeper has 3 formats (Color, B&W, Digital)
- If keeper has <3: check if any duplicate has the missing format, copy it pointing to keeper
- Delete all ProductFormatPricing__c records pointing to non-keeper products

### Step 4: Consolidate ProductMedia

- Re-parent ProductMedia records from duplicates to their keepers
- Delete orphaned ProductMedia

### Step 5: Consolidate ProductCategoryProduct

- Preserve union of category assignments across duplicates
- Delete assignments pointing to non-keeper products

### Step 6: Delete Duplicate PricebookEntry

- Delete PricebookEntry records pointing to non-keeper products
- Verify keepers retain entries in all 3 pricebooks

### Step 7: Deactivate Duplicate Product2 Records

- Set `IsActive = false` on all non-keeper products (reversible)
- After verification, optionally hard-delete

### Step 8: Clean Up Abandoned Infrastructure

- Delete 457 inactive VariationParent Product2 records
- Delete 2 empty ProductAttributeSet records
- Leave Opportunity, Case, Account, Contact untouched

### Step 9: Verify

| Check | Expected |
|---|---|
| `SELECT COUNT(Id) FROM Product2 WHERE IsActive = true` | ~1,066 |
| `SELECT COUNT(Id) FROM ProductFormatPricing__c WHERE Is_Active__c = true` | ~3,198 |
| `SELECT COUNT(Id) FROM PricebookEntry` | ~3,198 |
| `SELECT COUNT(Id) FROM ProductCategoryProduct` | ~2,500 |
| Storefront search for "Georgia" | ~200 products (not 388+) |
| Product detail modal | 3 format tabs per product |
| 200 ID limit error | Eliminated |

---

## 5. Key Org IDs Reference

| Entity | ID |
|---|---|
| WebStore | `0ZEam000004dJDNGA2` |
| Store Pricebook (ABC) | `01sam0000041Az8AAE` |
| Strikethrough Pricebook | `01sam0000041Az7AAE` |
| Standard Price Book | `01sam000003vfHdAAI` |
| ProductCatalog | `0ZSam000000jfLZGAY` |
| BuyerGroup | `0ZIam000000djN3GAI` |
| GuestBuyerProfile | `3K0am000000d3dxCAA` |
| Network (Site) | `0DBam000001NwdpGAC` |

## 6. Key Files Reference

| File | Purpose |
|---|---|
| `force-app/main/default/lwc/customResults/customResults.js` | Shop All page — search, pricing batching, product cards |
| `force-app/main/default/lwc/productDetailComponent/productDetailComponent.js` | Product detail page — format tabs, add to cart |
| `force-app/main/default/lwc/quickShopModal/quickShopModal.js` | Quick shop popup — format tabs, qty, dispatch addtocart event |
| `force-app/main/default/classes/ProductVariationController.cls` | Apex — queries ProductFormatPricing__c, builds format/tier data |
| `force-app/main/default/objects/ProductFormatPricing__c/` | Custom object metadata — format pricing child records |
| `force-app/main/default/objects/Product2/fields/` | Product2 custom field metadata (some undeployed legacy fields) |
| `Doc/product-format-pricing-import-sample.csv` | Sample showing intended 3-format-per-product structure |

## 7. Undeployed Legacy Fields (in local metadata but NOT in org)

These fields exist in `force-app/main/default/objects/Product2/fields/` but were never deployed. They are **not referenced by any LWC component** and were superseded by `ProductFormatPricing__c`:

| Field | Type | Description |
|---|---|---|
| `BW_Price__c` | Currency | B&W unit price (10-24 qty) |
| `BW_Price_25__c` | Currency | B&W bulk price (25+ qty) |
| `Color_Price__c` | Currency | Color unit price (10-24 qty) |
| `Color_Price_25__c` | Currency | Color bulk price (25+ qty) |
| `Digital_Price__c` | Currency | Digital unit price (10-24 qty) |
| `Digital_Price_25__c` | Currency | Digital bulk price (25+ qty) |
| `Pricing_Group__c` | Picklist | BW K-8, BW 9-12, COLOR K-8, etc. |
| `Coursewave_Code__c` | Text | Coursewave integration code |

These can be deleted from the local metadata if not needed.

---

## 8. Resume Instructions

When resuming, tell Claude:

> "Resume the data model cleanup. Start with Step 1 — run the read-only analysis script to generate the duplicate product CSVs. The plan is in `Doc/data-model-review-and-cleanup-plan.md`."

Claude will:
1. Create and run `.artifacts/analyze-duplicates.mjs`
2. Generate the 3 output files (CSV + summary)
3. Present results for your review before any data changes
