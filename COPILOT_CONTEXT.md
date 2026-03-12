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

---

## Product Catalog & Taxonomy

| Detail | Value |
|---|---|
| Product Catalog Name | `American Book Company Catalog` |
| Product Catalog ID | `0ZSam000000jfLZGAY` |
| Total Active Products | **502** |
| Total Active PricebookEntries | **499** (main pricebook) |
| Unit Price | **$41.00 flat** (all products) |
| SKU Format | `ISBN: XXXXXXXXX` (9-digit, stored in `StockKeepingUnit`) |
| ProductCode Format | `XXXXX-XXX-X` (hyphenated ISBN variant) |
| Name Pattern | `[State] [Standard/Test Name] Grade [N] [Subject]` |

### Product2 Standard Fields Used as Taxonomy
- `Family` — US State name (e.g. `Georgia`, `Louisiana`). **34 US states** represented. Used as primary state-filter dimension in `customResults.js`.
- `StockKeepingUnit` — ISBN-format SKU (`ISBN: 123456789`)
- `ProductCode` — Alternate hyphenated ISBN code

### Product2 Custom Fields
| API Name | Label | Type | Notes |
|---|---|---|---|
| `Series__c` | Series | Picklist | Series filter in `customResults.js` (e.g. "K-12 Standards Success") |
| `Grade_Level__c` | Grade Level | Picklist (Multi-Select) | Grade level filter |
| `State__c` | State | Picklist (Multi-Select) | State filter (multi-select; separate from `Family` single-state field) |
| `Category__c` | Category | Picklist | Product category |
| `Pricing_Group__c` | Pricing Group | Picklist | Groups products for potential differential pricing |
| `Coursewave_Code__c` | Coursewave Code | Text(10) | Integration code for Coursewave digital platform |

### Product Family Breakdown (Top States by Count)
Georgia(46), Louisiana(36), Tennessee(35), South Carolina(30), Kentucky(28), Arkansas(24), North Carolina(20), Alabama(20), Oklahoma(16), Minnesota(15), New Mexico(12), Wyoming(6), Virginia(5), Texas(4) + ~20 more states with 1–3 products.

---

## All 13 LWC Components

| Component | Purpose | Key Dependencies |
|---|---|---|
| `customResults` | Main search/filter results listing | Commerce Products API, `quickShopModal`, `stateFilterLwc`, filters: Series__c, Grade_Level__c, State__c |
| `productDetailComponent` | Full product detail page (PDP) | Commerce Products API, `purchaseQuantityRule`, AuthorizeNet token service |
| `quickShopModal` | Quick-add to cart modal from listing | Prop-driven (no Apex/wire); receives qty rule values from `customResults` |
| `stateFilterLwc` | State selector / persistent state choice | localStorage key: `abc_selected_state`; fires `statechange` custom event |
| `featuredStateBooks` | Featured books section for selected state | Commerce API, `abc_selected_state` from localStorage |
| `productGrid` | Grid layout wrapper (display only) | Pure presentational wrapper |
| `productRecommendation` | AI-powered product recommendations | `ProductRecommendationsController.getRecs()` → B2B AI Recommendations API |
| `similarProductsByState` | Related products filtered by state | Commerce API, reads `abc_selected_state` |
| `similarProductsBySubject` | Related products filtered by same subject | Commerce API, reads `abc_selected_state` |
| `catalogDownloader` | PDF catalog download by state | `@track selectedStateData`; no visible Apex wires |
| `soleSourceLetters` | Sole source letter downloads | Static resources: `pdf_icon`, `doc_icon` |
| `stateReps` | State sales representatives info | Static resource: `abc_reps` (ZIP), reads `abc_selected_state` |
| `stateTestimonials` | Testimonial carousel per state | `TestimonialCarouselController.getCarouselData(stateCode)`, SwiperJS, `testimonialsLogo` |

### localStorage Pattern
All commerce components share a single key for the buyer's selected US state:
```
Key: abc_selected_state
Written by: stateFilterLwc
Read by: customResults, featuredStateBooks, similarProductsByState, similarProductsBySubject, catalogDownloader, stateReps, stateTestimonials
```

---

## All Apex Classes (31 Custom)

### Payment — AuthorizeNet Integration
| Class | API | Purpose |
|---|---|---|
| `AuthorizeNetAcceptHostedTokenService` | 65 | Returns Accept Hosted iframe token for embedded payment. Method: `getHostedPaymentToken(TokenRequest)` → `TokenResponse`. DTOs: `TokenRequest` (amount, currency, returnUrl, cancelUrl, transactionType, referenceId), `TokenResponse` (success, token, resultCode, message, rawResponse) |
| `AuthorizeNetAcceptHostedTokenServiceTest` | 65 | Test class |
| `AuthorizeNetWebhookRest` | 59 | REST endpoint (`@RestResource`) receiving AuthorizeNet webhook events. Writes to `AuthorizeNet_Transaction__c`. Validates signature. |
| `AuthorizeNetWebhookRestTest` | 59 | Test class |

### B2B Commerce Controllers
| Class | API | Purpose |
|---|---|---|
| `ProductQuantityRuleController` | 66 | `getQuantityRule(productId)` → `QuantityRuleResult` (min, max, increment). Queries `ProductQuantityRule` → `PurchaseQuantityRule`. Fallback: min=10, max=50, inc=1. WITH USER_MODE. |
| `ProductRecommendationsController` | 65 | `getRecs(recommender, anchorValues, cookie)` → JSON string. Calls B2B AI Recommendations REST API at `/commerce/webstores/0ZEam000004dJDNGA2/ai/recommendations`. |
| `StateTestimonialsController` | 59 | `getStateTestimonials(state, siteId)` → `List<Card>`. Queries Salesforce CMS content items by state. Inner class `Card` with id, type, title, mediaUrl, thumbUrl, state, sortOrder. |
| `TestimonialCarouselController` | 59 | `getCarouselData(stateCode)` → `List<Carousel_Content__c>`. Queries `Carousel_Content__c WHERE State__c = :stateCode AND Active__c = true`. |

### Community / Experience Cloud (Boilerplate — Do Not Modify)
ChangePasswordController, CommunitiesLandingController, CommunitiesLoginController, CommunitiesSelfRegController, CommunitiesSelfRegConfirmController, ForgotPasswordController, MicrobatchSelfRegController, MyProfilePageController, SiteLoginController, SiteRegisterController (all + Test classes)

### SSO / Auth
`AutocreatedRegHandler1772220667704` — Auto-generated registration handler (SSO or Social Auth login)

---

## Custom Objects Schema

### `AuthorizeNet_Transaction__c`
Payment gateway transaction/webhook record. Auto-number name field.
| Field | Type | Purpose |
|---|---|---|
| `AuthAmount__c` | Currency(14,2) | Authorized amount |
| `AuthCode__c` | Text(10) | Authorization code |
| `AvsResponse__c` | Text(5) | AVS verification response |
| `EntityName__c` | Text(40) | Salesforce entity name |
| `EventDate__c` | Date/Time | When webhook event fired |
| `EventType__c` | Text(100) | Webhook event type (e.g. `net.authorize.payment.authcapture.created`) |
| `InvoiceNumber__c` | Text(30) | Invoice/order number |
| `NotificationId__c` | Text(36) | Unique webhook notification ID (External ID, unique) |
| `Payload__c` | Long Text(32768) | Full raw webhook payload JSON |
| `Processed__c` | Checkbox | Whether record has been processed |
| `ProcessingError__c` | Long Text(32768) | Error details if processing failed |
| `ResponseCode__c` | Number(3,0) | Transaction response code |
| `SignatureValid__c` | Checkbox | Whether webhook HMAC signature passed validation |
| `SourceIp__c` | Text(45) | Originating IP address |
| `TransactionId__c` | Text(30) | AuthorizeNet transaction ID |
| `WebhookId__c` | Text(36) | Webhook subscription ID |

### `Carousel_Content__c`
Storefront testimonial/media carousel entries. Auto-number name field.
| Field | Type | Purpose |
|---|---|---|
| `Media_Type__c` | Picklist | `Image` or `Video` |
| `Video_URL__c` | URL(255) | For video entries |
| `Testimonial_Text__c` | Long Text(32768) | Quote text |
| `Author_Name__c` | Text(255) | Author of testimonial |
| `Designation__c` | Text(255) | Author's title/role |
| `School_Name__c` | Text(255) | Author's school/district |
| `Red_Display_Text__c` | Text(255) | Highlighted callout text (red in UI) |
| `State__c` | Picklist | US state — used as filter by `TestimonialCarouselController` |
| `Sort_Order__c` | Number(18,0) | Display ordering |
| `Active__c` | Checkbox | Filter: only active records are returned |

### `In_App_Checklist_Settings__c`
Custom settings object for in-app onboarding checklist feature.

### `AuthorizeNet_Config__mdt` (Custom Metadata)
API credentials for Authorize.Net payment gateway. Protected fields.
| Field | Type | Purpose |
|---|---|---|
| `APILoginId__c` | Text(255) | Authorize.Net API login ID (protected) |
| `TransactionKey__c` | Text(255) | Authorize.Net transaction key (protected) |
| `UseSandbox__c` | Checkbox | Toggle between sandbox/production endpoints |

### Order Custom Fields
| API Name | Type | Purpose |
|---|---|---|
| `Acc_Name__c` | Formula (Text) | `Account.Name` — denormalized account name |
| `Grand_Total__c` | Formula (Currency) | `(Subtotal + Tax + Shipping) × (1 - Discount)` |
| `Discount__c` | Percent(5,2) | Manual discount percentage |
| `Tax__c` | Currency(18,2) | Manual tax amount |
| `Subtotal__c` | Roll-Up Summary | Sum of OrderItem.Total_Price__c |
| `Shipping_and_Handling__c` | Currency(18,2) | Manual shipping/handling cost |
| `Preview_Copy_Details__c` | Text Area | Notes on preview/sample copies |
| `Tracking_Number__c` | Text(50) | Shipment tracking number |

---

## Retrieved Objects — 347 Folders (Categorized)

### B2B Commerce / Storefront (35 objects)
WebStore, WebStoreBuyerGroup, WebStoreCatalog, WebStoreNetwork, WebStorePricebook, WebStoreInventorySource, WebStoreSearchProdSettings, WebStoreMessageContent, WebCart, WebCartAdjustmentBasis, WebCartAdjustmentGroup, WebCartCredit, CartItem, CartCheckoutSession, CartDeliveryGroup, CartDeliveryGroupMethod, CartDeliveryGroupMethodAdj, CartItemPriceAdjustment, CartRelatedItem, CartTax, CartValidationOutput, BuyerGroup, BuyerGroupMember, BuyerGroupPricebook, BuyerGroupBuyerCriteria, BuyerGroupRelatedObject, BuyerAccount, BuyerCriteria, GuestBuyerProfile, SalesStore, SalesStoreCatalog, SalesChannel, CommerceConfigRelatedRecord, CommerceEntitlementBuyerGroup, CommerceEntitlementPolicy, CommerceEntitlementProduct

### Product & Catalog (21 objects)
Product2, ProductAttribute, ProductAttributeSetProduct, ProductCatalog, ProductCategory, ProductCategoryMedia, ProductCategoryProduct, ProductFeaturedProduct, ProductMedia, ProductQuantityRule, ProductRelatedComponent, ProductRelationshipType, ProductSellingModel, Pricebook2, PricebookEntry, PriceAdjustmentSchedule, PriceAdjustmentTier, PurchaseQuantityRule, ElectronicMediaGroup, ElectronicMediaUse, Image

### Order Management (26 objects)
Order, OrderItem, OrderAdjustmentGroup, OrderDeliveryGroup, OrderDeliveryMethod, OrderItemAdjustmentLineItem, OrderItemRelationship, OrderItemTaxLineItem, OrderSummary, OrderItemSummary, OrderItemSummaryChange, OrderItemSummaryRelationship, OrderPaymentSummary, OrderPaymentSummaryReference, OrderSummaryRelationship, OrderSummaryRoutingSchedule, OrderSummaryAdditionalInfo, OrderAdjustmentGroupSummary, OrderDeliveryGroupSummary, OrderItemAdjustmentLineSummary, OrderItemTaxLineItemSummary, OrderChgReasonCategMap, FulfillmentOrder, FulfillmentOrderLineItem, FulfillmentOrderItemAdjustment, FulfillmentOrderItemTax

### Payment (20 objects)
Payment, PaymentAuthorization, PaymentAuthAdjustment, PaymentCredit, PaymentCreditLinePayment, PaymentCreditTransaction, PaymentGateway, PaymentGroup, PaymentInitiationSource, PaymentIntent, PaymentLineInvoice, PaymentLink, PaymentMethod, AlternativePaymentMethod, CardPaymentMethod, DigitalWallet, MerchAccPaymentMethodSet, MerchAccPaymentMethodType, MerchantAccount, SavedPaymentMethod

### Return / Refund / Invoice (12 objects)
ReturnOrder, ReturnOrderLineItem, ReturnOrderItemAdjustment, ReturnOrderItemTax, Refund, RefundLinePayment, CreditMemo, CreditMemoLine, CreditMemoInvApplication, Invoice, InvoiceLine, ProcessException

### Shipping (10 objects)
Shipment, ShipmentItem, ShippingCarrier, ShippingCarrierMethod, ShippingConfigSetProduct, ShippingConfigurationSet, ShippingRateArea, ShippingRateGroup, StandardShippingRate, DeliveryEstimationSetup

### Promotions & Coupons (11 objects)
Promotion, PromotionLineItemRule, PromotionMarketSegment, PromotionQualifier, PromotionSegment, PromotionSegmentBuyerGroup, PromotionSegmentSalesStore, PromotionTarget, PromotionTier, Coupon, CouponCodeRedemption

### Standard CRM / Sales (18 objects)
Account, AccountBrand, AccountContactRelation, AccountContactRole, Contact, ContactPointAddress, ContactRequest, Lead, Opportunity, OpportunityCompetitor, OpportunityContactRole, OpportunityLineItem, Case, CaseContactRole, Campaign, CampaignMember, Contract, ContractContactRole

### Quote / CPQ (3 objects)
Quote, QuoteLineItem, SalesTransactionShape, SalesTransactionItemShape

### Wishlist (2 objects)
Wishlist, WishlistItem

### Inventory (2 objects)
InventoryReservation, InventoryItemReservation

### Tax (5 objects)
TaxEngine, TaxGeoConfig, TaxPolicy, TaxRate, TaxTreatment, TaxTreatmentItem

### Scoring / Forecasting / Goals (10 objects)
Scorecard, ScorecardAssociation, ScorecardMetric, ForecastingAdjustment, ForecastingCategoryMapping, ForecastingCustomData, ForecastingOwnerAdjustment, ForecastingQuota, ForecastingTypeToCategory, GoalAssignment, GoalAssignmentRecommendation, GoalDefinition

### AI / Data Cloud / Analytics (25+ objects)
AiGroundingFileRef, AiGroundingSourceStage, AiGroundingWebRef, AiJobRun, CalculatedInsightRangeBound, DataAction, DataActionJobSummary, DataActionTarget, DataCommCapActvTarget, DataGraph, DataKitDeploymentLog, DataKnowledgeSpace, DataKnowledgeSrcFileRef, DataLakeObjectInstance, DataLineageDefSyncLog, DataLineageNodeDefSyncLog, DataModelRelationConstraint, DataPackageKit, DataQueryWorkspace, DataQueryWorkspaceTab, DataQuickAttribute, DataSourceBundle, DataStream, IdentityResolution, MarketSegment, MarketSegmentActivation, MarketSegmentField, MktCalculatedInsight, MktDataTransform, MktMLModel, MktMLModelPartitionRun, MktMLPredictionJob, MLModel, MLModelFactor, MLModelFactorComponent, PersonalizationRecommender

### Pardot / Account Engagement (1 custom object)
pi__AsyncRequest__c

### Org-Created Custom Objects (4 objects)
AuthorizeNet_Transaction__c, AuthorizeNet_Config__mdt, Carousel_Content__c, In_App_Checklist_Settings__c

### Other Notable Objects
Site, User, Task, Event, EmailMessage, ContentDocument, ContentVersion, Asset, Location, NetworkMember, Recommendation, WorkOrder, Territory2, etc.

---

## Payment Integration — End-to-End Flow

```
[Customer clicks Checkout]
    → authorizeNetCheckoutButton LWC
    → Fetches cart via Commerce API (/carts/{cartId})
    → Creates checkout session (Commerce API)
    → Calls AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken()
        → Reads AuthorizeNet_Config__mdt.getInstance('Default')
        → Selects Named Credential (Sandbox or Prod based on UseSandbox__c)
        → HTTP POST to callout:AuthorizeNet_*/xml/v1/request.api
        → Returns token
    → Redirects to Authorize.Net hosted payment form
    
[After payment completes]
    → Authorize.Net sends webhook POST
    → Hits REST endpoint: /services/rest/authorizenet/webhook/*
    → AuthorizeNetWebhookRest.receive() creates AuthorizeNet_Transaction__c record
```

**Named Credential:** AuthorizeNet_Sandbox
**Remote Site Settings:** Adyen, PayPal, Stripe endpoints are configured (for future use) but AuthorizeNet is the active gateway.

---

## Component Dependency Map

```
Page: Search / Listing
├── customResults (main search/filter)
│   ├── stateFilterLwc (state dropdown → localStorage)
│   ├── quickShopModal (add-to-cart popup)
│   └── Uses: Commerce Products Search API, State__c/Series__c/Grade_Level__c filters
│
Page: Product Detail
├── productDetailComponent (PDP)
│   ├── Uses: Commerce Products API, purchaseQuantityRule
│   ├── Pricing: $41 × (qty / increment)
│   └── Format tabs: Color Print + Digital / B&W Print + Digital
├── similarProductsByState (related by state)
├── similarProductsBySubject (related by subject)
└── productRecommendation (AI recommendations via ProductRecommendationsController)
│
Page: Home / Landing
├── featuredStateBooks → quickShopModal
├── stateTestimonials → TestimonialCarouselController → Carousel_Content__c
├── catalogDownloader (PDF catalogs by state)
├── soleSourceLetters (sole source letter PDFs)
└── stateReps (sales rep directory by state)
│
Checkout
└── authorizeNetCheckoutButton → AuthorizeNetAcceptHostedTokenService
```

---

## Flows Inventory (Active Only)

| Flow Label | Type | Category | Notes |
|---|---|---|---|
| `Create Pricebook Entry` | AutoLaunchedFlow | Custom | Trigger: Product2 AfterSave. Creates PricebookEntry at $41 in all active pricebooks. Has no fault path — duplicate on existing products causes unhandled error. |
| `Submit a PO` | Flow (Screen) | Custom | B2B Purchase Order checkout flow. Multiple obsolete versions; current Active version is the most recent. |
| `SendOrderConfirmationFlow_AmericanBookCompany` | Journey | Custom | Marketing Cloud order confirmation journey. Status: Draft. |
| `Cancel All Eligible Items` | Flow | OOB Commerce | Cancel order items in bulk |
| `Cancel Item` | Flow | OOB Commerce | Cancel single order item |
| `Return Item` | Flow | OOB Commerce | Initiate item return (RMA) |
| `RMA Create Credit Memo and Ensure Refunds` | AutoLaunchedFlow | OOB Commerce | Credit memo + refund processing |
| `RMA Return Items` | Flow | OOB Commerce | Process return merchandise authorization |
| `Create Process Exception` | AutoLaunchedFlow | OOB Commerce | Error/exception handling for commerce processes |
| `Ensure Refunds for Excess Funds` | AutoLaunchedFlow | OOB Commerce | Excess payment refund automation |
| `Opportunity to Quote` | AutoLaunchedFlow | OOB CPQ | Converts Opportunity to Quote (Salesforce CPQ) |
| `Quote To Order` | AutoLaunchedFlow | OOB CPQ | Converts approved Quote to Order (Salesforce CPQ) |
| `Account Engagement Bulk Asset Copy Flow` | Flow | Pardot | Copies Pardot assets to production |
| `Account Engagement Sandbox-Prod Bulk Asset Copy` | Flow | Pardot | Pardot sandbox → prod asset sync |

---

## Installed Packages

| Package Name | Namespace | Version | Purpose |
|---|---|---|---|
| Pardot | `pi` | 5.9 | Marketing automation / Account Engagement |
| b2bmaIntegration | `b2bma` | 1.7 | B2B Marketing integration (connects Commerce to Account Engagement) |
| CDPAdvertising | `cdpactvstrgptnr` | 3.21 | Data Cloud Activation Partners (ad platform targeting) |
| CMS Content Type Manager | `sflabs_cms_ct` | 1.5 | CMS content type management |
| Sales Insights | `OIQ` | 1.0 | Sales activity intelligence |
| Salesforce Standard Data Model | `ssot` | 1.130 | SSOT / Data Cloud data model |
| Salesforce.com CRM Dashboards | _(none)_ | 1.0 | Standard CRM dashboards |
| GS Sales Reports Dashboards | _(none)_ | 1.0 | Additional sales reporting |

---

## Custom Permission Sets (Org-Created)

| Permission Set | Purpose |
|---|---|
| `Commerce_Buyer` | B2B buyer access |
| `Commerce_Shopper` | B2C/shopper access |
| `CommerceUsers` | General commerce user access |
| `GeneralUsers` | General internal user baseline |
| `SalesUsers` / `Sales_User` / `Sales_Edge` | Sales team variations |
| `MarketingUsers` | Marketing team |
| `ServiceUsers` | Service team |
| `Pardot` / `Pardot_Connector_User` / `Pardot_Integration_User` | Pardot / Account Engagement integration |
| `Waive2MFA` | Waives 2FA requirement for specific users |
| `UnifiedMarketingUserPermSet` | Cross-channel marketing (Data Cloud + Pardot) |
| `sfdc_ccordermanagement` | Order management platform |
| `sfdc_unified_commerce_ai` | AI-powered commerce features |
| `sfdc_a360` / `sfdc_a360_sfcrm_data_extract` | Data Cloud / Customer 360 |
| `CopilotSalesforceAdminPSG` / `CopilotSalesforceUserPSG` | Einstein Copilot (admin / user) |
| `CMS_Content_Types` | CMS content type management |
| `SalesWorkspacePSG` | Sales Workspace AI |
| `AgentforceServiceAgentUserPsg` | Agentforce Service Agent (AI chatbot) |
| `ScaleCenterUsers` | Scale Center monitoring |

---

## Static Resources

| Name | Type | Purpose |
|---|---|---|
| `abc_reps` | ZIP | State sales representative data/images. Used by `stateReps` LWC. |
| `SwiperJS` | ZIP | Swiper carousel JS library. Used by `stateTestimonials` LWC. |
| `SiteSamples` | ZIP | Sample product files |
| `ABCHeader` | PNG | Site header image |
| `ABCLogo` | PNG | American Book Company logo |
| `MyFavicon` | PNG | Site favicon |
| `AboutABC` | JPEG | Marketing image for "About" section |
| `DigitalCoursebooks` | PNG | Product type icon |
| `OnlineTesting` | PNG | Product type icon |
| `PrintedCoursebooks` | PNG | Product type icon |
| `pdf_icon` | SVG | PDF file type icon. Used by `soleSourceLetters`. |
| `doc_icon` | SVG | DOC file type icon. Used by `soleSourceLetters`. |
| `mailIcon` | PNG | Email/contact icon |
| `phoneIcon` | PNG | Phone/contact icon |
| `testimonialsLogo` | PNG | Logo displayed in testimonials section |
| `SNA_V88li_sf_default_cdn_American_Book_Company1` | ZIP | Experience Site CDN assets (main site) |
| `SNA_fM1FJ_sf_default_cdn_sfpwebhook1` | ZIP | Experience Site CDN assets (webhook handler) |

---

## Networks (Experience Sites)

| Network | Purpose |
|---|---|
| `American Book Company` | Main B2B Commerce storefront (Experience Cloud site) |
| `sfpwebhook` | Webhook handler site for external integrations |

---

## Named Credentials

| Name | Purpose |
|---|---|
| `AuthorizeNet_Sandbox` | Authorize.Net sandbox API (callout endpoint for payment token generation) |

---

## Remote Site Settings

| Name | Purpose |
|---|---|
| `AdyenAccountManagementLiveAPI` / `TestAPI` | Adyen payment gateway (configured, not active) |
| `AdyenCheckoutTestAPI` | Adyen checkout (configured, not active) |
| `AdyenOAuthLiveAPI` / `TestAPI` | Adyen OAuth (configured, not active) |
| `CMSContentTypeManager` | CMS Content Type Manager package endpoint |
| `CQuotient` | Einstein Commerce Insights / personalization |
| `PaypalProductionAPI` / `SandboxAPI` | PayPal (configured, not active) |
| `StripeAPI` / `StripeConnectAPI` | Stripe (configured, not active) |

> **Note:** AuthorizeNet is the ONLY active payment gateway. Adyen, PayPal, and Stripe are configured as remote sites but not currently in use.

---

## Auth Providers

| Provider | Purpose |
|---|---|
| `Google_Login` | Google SSO for Experience Cloud login |
| `Sandbox_Asset_Flow_Auth` | Sandbox asset flow authentication |
| `FacebookSegmentIntelligence` | Facebook/Meta segment targeting (Data Cloud) |
| `GoogleSegmentIntelligence` / `GoogleWebDataConnector` | Google Ads targeting + data connector |
| `LinkedInEmiLinkedInAds` / `LinkedInWebDataConnector` | LinkedIn Ads integration |
| `MicrosoftEmiBingAds` | Bing Ads integration |
| `SalesforceEmiTikTokAds` | TikTok Ads integration |
| `TwitterEmiXAds` | X (Twitter) Ads integration |
| `Confluence3LOConfluence3LO` | Confluence integration (internal docs) |

---

## Aura Components (Legacy)

| Component | Purpose |
|---|---|
| `StateFilterAura` | Legacy state filter (superseded by `stateFilterLwc`) |
| `Test` | Test/sandbox Aura component |

---

## Project History (Completed Work)

| Session | Date | Work Done | Commit |
|---|---|---|---|
| 1 | Previous | Fixed 169 VS Code lint/XML errors across flows and LWCs. All deployed and verified 0 errors. | (committed) |
| 2 | Previous | Created `ProductQuantityRuleController.cls` — PMD-clean, WITH USER_MODE, ApexDoc. Deployed and tested (34 tests passing). | `a345926` |
| 3 | Previous | Full org schema discovery — 502 products, 34 states, 31 Apex classes, 37 flows, 28 permission sets, 8 installed packages. Updated COPILOT_CONTEXT.md with comprehensive architecture docs (+215 lines). | `684d295` |
| 4 | Current | Verified org connection (not expired). Updated package.xml to 17 non-empty metadata types. Retrieved all 347 object folders + all other metadata from org. Reviewed and categorized all retrieved metadata. Created persistent memory documentation for agent education. | (pending commit) |

---

## Known Remaining Issues / Next Steps

1. **Flow fault path** — `Create_Pricebook_Entry` has no fault connector; duplicate PricebookEntry on existing products causes unhandled error. Add a `Get Records` check or fault path.
2. **StateTestimonialsController stub** — Only AL and GA are mapped in the hard-coded content collection lookup. Other states return empty results. May need to populate more Carousel_Content__c records or complete the CMS integration.
3. **PriceAdjustmentSchedule coverage** — Volume pricing schedule exists (10–24=$41, 25+=$25.25) but only 33 of 502 products are linked via `PricebookEntryAdjustment`. Consider extending to all products.
4. **Git workflow** — Repo is `wahid25Khan/ABC-Production` (private). Always commit + push after deploying changes.
5. **Multiple payment gateways configured** — Remote Site Settings exist for Adyen, PayPal, and Stripe but only AuthorizeNet is active. Clean up unused settings or implement additional gateways as needed.
