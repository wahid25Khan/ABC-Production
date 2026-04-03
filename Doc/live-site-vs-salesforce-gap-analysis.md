# Live Site vs Salesforce Storefront — Gap Analysis

**Date:** 2026-03-30
**Live Site:** https://americanbookcompany.com
**Salesforce Site:** https://americanbookcompany.my.site.com/AmericanBookCompany/
**Purpose:** Document the current state of both platforms and identify what needs to be built, styled, or aligned.

---

## 1. Live Site Architecture

- **Framework:** Nuxt.js (Vue SSR) with Pinia state stores
- **Search:** Algolia (app ID `UAHCZSR9UB`, prefix `live_`)
- **Payments:** Authorize.Net Accept Hosted
- **CDN:** Cloudflare (email obfuscation, bot protection via Turnstile)
- **CMS:** Statamic CMS at `cms.americanbookcompany.com`, assets at `cms-assets.americanbookcompany.com`
- **Images:** Nuxt Image module (`/_ipx/`), responsive srcset (sm, 2x, lg, xl, 2xl, 3xl)
- **Analytics:** Google Analytics (G-DWPC3296QP), AppNexus/Xandr universal pixel, Sentry
- **Chat:** LiveChat/ChatSupport (project `LS-dec6d4e5`)

---

## 2. Live Site — Page-by-Page Structure

### 2.1 Header (All Pages)

**Top Navigation Bar (`#main-nav`):**
- Horizontal `<ul>` with items: My Account (dropdown), Podcast, Blog, CourseWave (external), About ABC, Get Catalog, Shop All
- Font: `0.75rem` (12px), line-height 1.333
- Hover: 4px bottom border in `#005f8e`
- Dropdown: white bg, 1px gray border, z-index 50, `16rem` wide at ≥48rem. Hover: `#005f8e` bg with white text

**Main Header Row:**
- Logo (left): `ABC_logo-mobile_112x80.png`, links to `/home/ga`
- State selector: dropdown with all 50 states + DC, chevron-down SVG, white bg
- Search icon: magnifying glass SVG, X to clear
- Cart icon: `cart-shopping-light.svg`, links to `/cart` — no visible count badge (updates via JS)
- Hamburger (mobile): bars icon open, rectangle-xmark close
- User icon: silhouette SVG, links to `/login`

**Mobile Drawer:**
- Shop All, Get Catalog, About ABC, CourseWave, Blog, Podcast, My Wishlist
- Account sub-items: Account Details, My Orders, Submit a PO, Log Out

### 2.2 Product Listing Page (`/products/state/ga/page/1/`)

**Page Title:** "Shop All"
**Subtitle:** "Need to download a quote? Add items to your cart to begin."
**Results indicator:** "Showing 1 to 20 of 73 — Page 1 of 4"

**View Modes:** Grid (default) / List toggle icons

**Product Cards (Grid — 4 columns desktop):**

| Element | Details |
|---------|---------|
| Cover image | WebP from CMS CDN, portrait orientation |
| "Look Inside" link | Opens preview eBook on CourseWave |
| Close (X) button | Dismisses quick-shop overlay |
| Loading spinner | `spinnersBlocksWave.svg` for async content |
| "Quick Shop" button | Triggers inline overlay purchase panel |
| Product title | Clickable link to PDP, truncated to 2 lines (`-webkit-line-clamp: 2`, height `2.5em`) |
| Price | "Starting at **$25.25**" (bulk/25+ price shown) |

**No visible:** badges, star ratings, or direct "Add to Cart" on card face — CTA is Quick Shop only.

**Filters (Sidebar / Mobile Slide-out):**

| Filter | Type | Options |
|--------|------|---------|
| State | Dropdown | All States + 50 states + DC |
| Grade Level | Checkbox group, collapsible (`−`) | K through Grade 12 |
| Subject | Checkbox group, collapsible (`−`) | Math, English, Reading, Social Studies, Science, Writing |
| Series | Checkbox group, collapsible (`+`) | Collapsed by default |

- "Clear All" link to reset
- Search within filters
- "See results" button at bottom
- Custom checkbox styling: white bg, gray border `#adacac`, rounded. Checked: `#007cba` bg with white box-shadows. Hover: `#757575` border. Active: `#01293a` bg.

**Sorting:** A-Z, Z-A, Price: Low to High, Price: High to Low
**Per-page:** 20 / 40 / 60 (default 20)

**Pagination:**
- Left/right chevrons (left disabled on page 1)
- "Page 1 of 4" text
- Simple prev/next, no numbered page buttons

### 2.3 Product Detail Page (`/products/{slug}`)

**Layout:** Single cover image (no gallery/carousel) + details column

**Elements:**
- Title (h1) + ISBN
- Format selector: Color Print + Digital, B&W Print + Digital, Digital Only (toggle/radio group)
- Tiered pricing table: `10-24 | $44.00` / `25+ | $28.50`
- Minimum order enforced: "Quantity (min 10)"
- Quantity input field
- **Add to Cart** button (primary, filled)
- **FREE Two-Week Trial!** button (secondary, outline) → links to `/free-trial/{slug}`
- Wishlist heart icon (outline)
- Error modal: "Failed to add item to cart" with OK / View Cart buttons

**Tabs:**
1. **Table of Contents** — chapter listing
2. **Teacher Guide** — describes what the Teacher's Guide contains (digital codes, standards chart, chapter reviews, answer key)
3. **CourseWave Online Testing** — platform features + chapter table with "View Question" links + "View Sample Questions" button

**Feature Checklist (green checkmarks):**
- Answer Key, Posttest, Pretest, eBook

**Related Product Sections:**
1. "Looking for additional books?" — carousel
2. "You might also like" — carousel
3. "Recently Viewed (0)" — carousel

### 2.4 Cart Page (`/cart`) — With Items

**Page Title:** "Your Cart" (h1)

**Cart Item Layout:**
- Product image, title, format, quantity controls, unit price, line total, remove button

**Cart Summary:**
- Subtotal, tax, total

**Three Key Action Buttons:**

| Button | Behavior |
|--------|----------|
| **Download a Quote** | Generates a PDF quote from current cart contents for download |
| **Proceed to Checkout** | Navigates to checkout / payment flow |
| **Need to submit a PO?** | Navigates to PO submission form/page |

**Wishlist Section:**
- "Items on your wishlist (not included in order)" — horizontal carousel

**Note:** Cart page is client-side rendered (Nuxt/Vue). When cart is empty, the three buttons and item layout are conditionally hidden.

### 2.5 Checkout Flow

- Authorize.Net Accept Hosted payment integration
- Authorization-only at checkout (capture happens later)
- Login/guest gate before payment

### 2.6 PO Submission Page

- Accessible via "My Account" → "Submit a PO" or from cart page "Need to submit a PO?" button
- Form for uploading purchase order documents
- Requires login (account-level feature)

### 2.7 Footer (All Pages)

**Credentials Bar:**
- USFCR Verified Vendor, Georgia Chamber, BBB, AAP, WBENC logos
- Instructure/Badgr badge

**"Need Help?" Section:**
- "Your Georgia representatives are here..."
- Email (CF-obfuscated), Phone (888) 264-5877, Fax (866) 827-3240
- 3 sales rep cards: photo, name, title/territory, phone icon, email icon

**Company Info:**
- 103 Executive Drive, Woodstock GA 30188-1383

**Link Columns:**

| GET TO KNOW ABC | ORDERING | ACCOUNT LINKS |
|-----------------|----------|---------------|
| About ABC | How to Order | My Account |
| Careers | Documents for Ordering | My Wishlist |
| Blog | Catalog | CourseWave |
| Podcast | | |

**Bottom Bar:**
- BBB logo, Copyright © 2026, Terms of Use, Privacy Policy, Accessibility, CyberGlobal certs
- Social: Facebook, Twitter/X, Instagram

### 2.8 Color Scheme & Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Brand blue/teal | `#005f8e` | Nav hover borders, dropdown hover bg, primary accents |
| Interactive blue | `#007cba` | Checkbox checked state, focus rings |
| Dark blue | `#01293a` | Active/pressed states |
| White | `#fff` | Backgrounds, dropdown bg, hover text |
| Gray border | `~#d1d5db` | Dropdown borders, dividers |
| Checkbox border | `#adacac` | Unchecked checkbox borders |
| Hover gray | `#757575` | Checkbox hover border |
| Summary bg | `#f4f7fa` | Cart summary panel background |

**Spacing:** 4px base unit (`--spacing: 0.25rem`), multiplied (×1=4px, ×2=8px, ×4=16px, etc.)
**Typography:** Nav 12px, product titles clamped to 2 lines
**Animations:** `fade-up-down` 0.3s ease (opacity + translateY 10%), `fade` 0.3s opacity
**Border radius:** `0.375rem` (6px) for tabs and interactive elements

---

## 3. Salesforce Storefront — Current State

### 3.1 Custom LWC Components Built

| Component | Status | What It Does |
|-----------|--------|-------------|
| `customResults` | **Done** | Full Shop All page: grid/list view, state filter, grade/subject/series checkbox filters, sort (A-Z, Z-A), pagination (20/40/60), product cards with Quick Shop overlay, fuzzy search |
| `quickShopModal` | **Done** | Two-column modal: cover image, format tabs (B&W/Color/Digital), tiered pricing table, feature checklist, qty stepper, order total, Add to Cart, FREE Trial, heart/favorite |
| `productDetailComponent` | **Done** | Inline PDP: same layout as modal (formats, tiers, qty, Add to Cart, Trial button, heart) — auto-resolves product ID from URL |
| `stateFilterLwc` | **Done** | Header state dropdown (pin icon + 2-letter code + chevron), persists to localStorage, CSS injection into `document.head` for cart page styling + header responsive layout |
| `authorizeNetCheckoutButton` | **Done** | Fetches cart, gets hosted payment token from Apex, starts Commerce checkout, POSTs to Authorize.Net hosted form |
| `checkoutLoginGate` | **Done** | Pre-checkout gate: if authenticated → redirect to `/checkout`; if guest → two-column (Create Account / Continue as Guest / Returning Customer login) |
| `similarProductsByState` | **Done** | State-based product carousel |
| `similarProductsBySubject` | **Done** | Subject-based product carousel |
| `productRecommendation` | **Done** | Product recommendation carousel |
| `catalogDownloader` | **Done** | PDF catalog download by state (marketing catalogs, NOT quotes) |
| `howToOrder` | **Done** | Static "How to Order" page with PO submission instructions |
| `soleSourceLetters` | **Done** | Certifications and sole-source document links |
| `stateReps` | **Done** | State sales representative cards |
| `stateCountyMapbox` | **Done** | Mapbox map integration |
| `aboutSection` | **Done** | About page content |
| `blogHero` | **Done** | Blog hero section |
| `featuredStateBooks` | **Done** | Featured books by state |
| `mapPlusTestimonial` | **Done** | Map + testimonial layout |
| `stateTestimonials` | **Done** | State testimonials |

### 3.2 Cart Page — Current Implementation

- **No custom cart LWC** — uses standard OOB `commerce_builder-b2b-cart-contents` and `commerce_builder-cart-summary`
- Only customization is via CSS injected by `stateFilterLwc` into `document.head`:
  - Cart heading: 36px bold
  - Cart item layout: 4-column grid (image 160px, details, unit price, total)
  - Product images: borders + shadows
  - Product name: 20px bold
  - Cart summary: `#f4f7fa` background
  - Checkout button: rounded corners
  - Tablet: horizontal header, constrained column widths
  - Mobile: 2-row header, 80px cart item images

### 3.3 How Add-to-Cart Works

1. User clicks "Quick Shop" on product card → `quickShopModal` opens
2. User selects format tab, adjusts quantity → order total updates live
3. User clicks "Add to Cart" → modal dispatches `addtocart` event
4. Parent (`customResults`) POSTs to Commerce cart-items REST API
5. On success → **immediate redirect to `/AmericanBookCompany/cart`** (no confirmation dialog)
6. Same flow on `productDetailComponent` (calls cart API directly, then redirects)

---

## 4. Gap Analysis — What's Missing

### 4.1 CRITICAL GAPS — NOW RESOLVED

| # | Feature | Live Site | Salesforce | Status |
|---|---------|-----------|------------|--------|
| G1 | **Download a Quote** button on cart | Generates PDF quote from cart contents | **BUILT** — `cartActionButtons` LWC + `CartQuotePdfController` Apex + `CartQuotePdf.page` VF | DONE |
| G2 | **Submit a PO** form/page | Full form for uploading PO documents | **BUILT** — `poSubmissionForm` LWC + `POSubmissionController` Apex (creates Case + file upload) | DONE |
| G3 | **Three-button layout on cart** | "Download a Quote" / "Proceed to Checkout" / "Need to submit a PO?" | **BUILT** — `cartActionButtons` LWC with 3 vertically stacked pill buttons | DONE |

### 4.2 FUNCTIONAL GAPS (Features Partially Built)

| # | Feature | Live Site | Salesforce | Priority |
|---|---------|-----------|------------|----------|
| G4 | "Look Inside" link | Opens preview eBook on CourseWave | Button exists but is **disabled/non-functional** | MEDIUM |
| G5 | Feature checklist | Driven by product data | **Hardcoded** ("Answer Key", "Posttest", "Pretest", "eBook") in both modal and PDP | LOW |
| G6 | Sort by Price | Low to High / High to Low | Only A-Z, Z-A, Most Relevant | MEDIUM |
| G7 | Add-to-cart confirmation | Error/success modal with OK / View Cart options | No confirmation — immediate redirect to cart | LOW |
| G8 | Cart item count badge | Updates dynamically in header cart icon | No visible count badge | MEDIUM |

### 4.3 STYLING/DESIGN GAPS

| # | Element | Live Site | Salesforce | Priority |
|---|---------|-----------|------------|----------|
| G9 | Product grid columns | 4 columns desktop | 5 columns desktop | LOW |
| G10 | Cart page design | Full custom layout with item grid, summary panel, 3 buttons | OOB components + CSS injection only | HIGH |
| G11 | Checkout button styling | Part of 3-button group | Standalone rounded button via CSS injection | MEDIUM |

### 4.4 PAGE GAPS — NOW RESOLVED

| # | Page | Live Site URL | Salesforce | Status |
|---|------|--------------|------------|--------|
| G12 | Quote Download | Triggered from cart | **BUILT** — `CartQuotePdfController` + `CartQuotePdfPageController` + `CartQuotePdf.page` VF | DONE |
| G13 | PO Submission | `/submit-po` (or account dropdown) | **BUILT** — `poSubmissionForm` LWC + `POSubmissionController` Apex | DONE |

---

## 5. Implementation Details — New Components

### 5.1 `cartActionButtons` LWC — Cart Action Buttons Panel

**Files:**
- `force-app/main/default/lwc/cartActionButtons/cartActionButtons.js`
- `force-app/main/default/lwc/cartActionButtons/cartActionButtons.html`
- `force-app/main/default/lwc/cartActionButtons/cartActionButtons.css`
- `force-app/main/default/lwc/cartActionButtons/cartActionButtons.js-meta.xml`

**What it does:** Three vertically stacked pill-shaped buttons in a `#f4f7fa` panel:
1. **Download a Quote** (primary blue) — calls `CartQuotePdfController.generateQuotePdf()` Apex, decodes base64 PDF, triggers browser download
2. **Proceed to Checkout** (primary blue) — navigates to `/checkout-login` (configurable in Experience Builder)
3. **Need to submit a PO?** (outline blue) — navigates to `/submit-po` (configurable)

**Configurable properties:** `checkoutUrl`, `poSubmissionUrl`
**Guest handling:** Shows "Please sign in" message for quote download

### 5.2 Quote PDF Generation System

**Apex Controller (`CartQuotePdfController.cls`):**
1. Queries active `WebCart` for current user (`OwnerId = :UserInfo.getUserId() AND Status = 'Active'`)
2. Counts `CartItem` records (validates non-empty)
3. Generates unique quote number: `ABC-YYYYMMDD-XXXXX`
4. Calls `Page.CartQuotePdf.getContentAsPDF()` to render VF page as PDF
5. Returns base64-encoded PDF to LWC

**VF Page Controller (`CartQuotePdfPageController.cls`):**
- Receives `cartId` and `quoteNumber` from URL params
- Queries `WebCart` (Account, Owner details) and `CartItem` (Product2 name, SKU, Qty, SalesPrice, TotalPrice)
- Populates `QuoteLine` list for the VF page

**VF Page (`CartQuotePdf.page`, renderAs="pdf"):**
- Branded header: "American Book Company" + address/phone + quote number + date
- Customer info: Account name, contact name, email
- Items table: #, Product, ISBN/SKU, Qty, Unit Price, Total
- Subtotal row
- Footer with 30-day validity disclaimer

### 5.3 `poSubmissionForm` LWC — PO Submission Page

**Files:**
- `force-app/main/default/lwc/poSubmissionForm/poSubmissionForm.js`
- `force-app/main/default/lwc/poSubmissionForm/poSubmissionForm.html`
- `force-app/main/default/lwc/poSubmissionForm/poSubmissionForm.css`
- `force-app/main/default/lwc/poSubmissionForm/poSubmissionForm.js-meta.xml`

**Two-step form flow:**
1. User fills: PO Number*, School/District*, Contact Name*, Email*, Phone, Notes
2. Calls `POSubmissionController.submitPurchaseOrder()` Apex → creates Case
3. Shows success with Case Number
4. Renders `lightning-file-upload` bound to Case ID for PO document attachments

**Guest handling:** Shows "Please sign in" message with login link

### 5.4 `POSubmissionController.cls` — Case Creation

- Validates required fields (PO#, School, Name, Email)
- Creates Case: `Type = 'Purchase Order'`, `Origin = 'Web'`, `Purchase_Order_Number__c` = PO#
- Maps: `SuppliedCompany`, `SuppliedName`, `SuppliedEmail`, `SuppliedPhone`, `Description`
- Returns Case ID + auto-assigned Case Number

### 5.5 Test Classes

| Test Class | Methods | Coverage |
|-----------|---------|----------|
| `CartQuotePdfControllerTest` | 4 tests | Success, empty cart, no cart, quote number format |
| `CartQuotePdfPageControllerTest` | 3 tests | Valid cart, no cart ID, invalid cart ID |
| `POSubmissionControllerTest` | 7 tests | Success, no notes, missing PO#, missing school, missing name, missing email, null request |

### 5.6 Button Styling (consistent with existing project patterns)

- **Primary (filled):** `#007cba` bg, white text, `border-radius: 999px`, 700 weight, 50px min-height
- **Outline:** 2px `#007cba` border, white bg, `#007cba` text, `border-radius: 999px`
- **Panel:** `#f4f7fa` background (matches cart summary panel)
- **Hover:** Primary darkens to `#006299`, Outline gets subtle blue tint
- **Pattern source:** `checkoutLoginGate.css` `.btn-primary` and `.btn-outline`

---

## 6. Deployment Steps

### Step 1: Deploy to Org
```bash
sf project deploy start \
  --source-dir "force-app/main/default/classes/CartQuotePdfController.cls,force-app/main/default/classes/CartQuotePdfController.cls-meta.xml,force-app/main/default/classes/CartQuotePdfControllerTest.cls,force-app/main/default/classes/CartQuotePdfControllerTest.cls-meta.xml,force-app/main/default/classes/CartQuotePdfPageController.cls,force-app/main/default/classes/CartQuotePdfPageController.cls-meta.xml,force-app/main/default/classes/CartQuotePdfPageControllerTest.cls,force-app/main/default/classes/CartQuotePdfPageControllerTest.cls-meta.xml,force-app/main/default/classes/POSubmissionController.cls,force-app/main/default/classes/POSubmissionController.cls-meta.xml,force-app/main/default/classes/POSubmissionControllerTest.cls,force-app/main/default/classes/POSubmissionControllerTest.cls-meta.xml,force-app/main/default/pages/CartQuotePdf.page,force-app/main/default/pages/CartQuotePdf.page-meta.xml,force-app/main/default/lwc/cartActionButtons,force-app/main/default/lwc/poSubmissionForm" \
  --target-org ABC-Production --wait 5
```

### Step 2: Run Apex Tests
```bash
sf apex run test \
  --class-names CartQuotePdfControllerTest CartQuotePdfPageControllerTest POSubmissionControllerTest \
  --target-org ABC-Production --wait 5 --result-format human
```

### Step 3: Experience Builder Configuration
1. **Cart page:** Drag "Cart Action Buttons" component below the cart summary panel
2. **Create `/submit-po` page:** Add "PO Submission Form" component
3. Configure URLs in component properties if defaults need changing

### Step 4: Verify Case Type Picklist
- Ensure "Purchase Order" exists as a Case `Type` picklist value in Setup → Object Manager → Case → Fields → Type

### Step 5: Publish
```bash
sf community publish --name "American Book Company" --target-org ABC-Production
```

### Step 6: End-to-End Testing
1. Add items to cart → verify cart page shows 3-button panel
2. Click "Download a Quote" → verify PDF downloads with correct items, pricing, branding
3. Click "Proceed to Checkout" → verify navigation to checkout login gate
4. Click "Need to submit a PO?" → verify PO form loads
5. Submit PO form → verify Case created with correct fields
6. Upload PO document → verify file attached to Case
7. Test as guest user → verify login prompts appear for quote + PO

---

## 7. File References

| File | Purpose |
|------|---------|
| `force-app/main/default/lwc/cartActionButtons/` | **NEW** — Cart page 3-button panel |
| `force-app/main/default/lwc/poSubmissionForm/` | **NEW** — PO submission form page |
| `force-app/main/default/classes/CartQuotePdfController.cls` | **NEW** — AuraEnabled: generates PDF from active cart |
| `force-app/main/default/classes/CartQuotePdfPageController.cls` | **NEW** — VF page controller: queries cart items |
| `force-app/main/default/pages/CartQuotePdf.page` | **NEW** — renderAs="pdf" branded quote template |
| `force-app/main/default/classes/POSubmissionController.cls` | **NEW** — Creates Case from PO form data |
| `force-app/main/default/classes/CartQuotePdfControllerTest.cls` | **NEW** — 4 test methods |
| `force-app/main/default/classes/CartQuotePdfPageControllerTest.cls` | **NEW** — 3 test methods |
| `force-app/main/default/classes/POSubmissionControllerTest.cls` | **NEW** — 7 test methods |
| `force-app/main/default/lwc/customResults/` | Shop All page component |
| `force-app/main/default/lwc/quickShopModal/` | Quick shop modal |
| `force-app/main/default/lwc/productDetailComponent/` | Product detail page |
| `force-app/main/default/lwc/stateFilterLwc/` | State filter + CSS injection |
| `force-app/main/default/lwc/authorizeNetCheckoutButton/` | Authorize.Net checkout |
| `force-app/main/default/lwc/checkoutLoginGate/` | Checkout login/guest gate |
| `force-app/main/default/lwc/howToOrder/` | How to Order page (static) |
| `force-app/main/default/lwc/catalogDownloader/` | PDF catalog download (NOT quotes) |
| `Doc/code-review-findings.md` | Bug/security/quality review |
| `Doc/data-model-review-and-cleanup-plan.md` | Data model cleanup plan |
