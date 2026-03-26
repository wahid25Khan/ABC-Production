# ABC-Production — Full Code Review & Recommendations

**Review Date:** March 25, 2026  
**Reviewer:** GitHub Copilot  
**Org:** wahid@americanbook.com — americanbookcompany.my.salesforce.com  
**Branch:** main  
**Scope:** All 19 custom LWC components, 7 custom Apex classes, 14 flows, named credentials, and B2B Commerce configuration

---

## Table of Contents

1. [B2B Commerce Implementation Overview](#1-b2b-commerce-implementation-overview)
2. [What Changed (Team Updates Retrieved)](#2-what-changed-team-updates-retrieved)
3. [Critical Security Issues — Fix Immediately](#3-critical-security-issues--fix-immediately)
4. [High Priority Bugs — Broken Features](#4-high-priority-bugs--broken-features)
5. [LWC Component Review — All 19 Components](#5-lwc-component-review--all-19-components)
6. [Apex Class Review — All 7 Custom Classes](#6-apex-class-review--all-7-custom-classes)
7. [Flow Review](#7-flow-review)
8. [Configuration Review](#8-configuration-review)
9. [Code Quality Issues](#9-code-quality-issues)
10. [Recommended Fix Priority & Action Plan](#10-recommended-fix-priority--action-plan)
11. [Solutions & Code Fixes](#11-solutions--code-fixes)

---

## 1. B2B Commerce Implementation Overview

This project is a **Salesforce B2B Commerce (LWR)** storefront for American Book Company, serving K-12 textbook sales to schools and districts across 34 US states.

```
Experience Cloud Site (AmericanBookCompany)
  ├── OOB B2B Commerce Pages (Search, Cart, Checkout, Order Management)
  ├── 19 Custom LWC Components
  │   ├── State Selection Layer
  │   │   └── stateFilterLwc → writes localStorage key "abc_selected_state"
  │   │       └── 7 consuming components read from localStorage
  │   ├── Product Browsing
  │   │   ├── customResults        (main search/browse listing)
  │   │   ├── productDetailComponent (PDP)
  │   │   └── productGrid          (non-functional scaffolding)
  │   ├── Recommendations
  │   │   ├── productRecommendation     (AI recently-viewed carousel)
  │   │   ├── similarProductsByState    (same-state books)
  │   │   └── similarProductsBySubject  (same-subject books)
  │   ├── Commerce Content
  │   │   ├── catalogDownloader      (PDF catalog per state)
  │   │   ├── stateTestimonials      (SwiperJS carousel)
  │   │   ├── mapPlusTestimonial     (Mapbox map + testimonials)
  │   │   └── stateCountyMapbox      (standalone Mapbox map)
  │   ├── Sales Information
  │   │   ├── stateReps             (sales rep cards per state)
  │   │   ├── soleSourceLetters     (certifications page)
  │   │   ├── aboutSection          (static company info)
  │   │   └── howToOrder            (static order instructions)
  │   └── Checkout
  │       ├── authorizeNetCheckoutButton (AuthorizeNet payment)
  │       ├── checkoutLoginGate      (login gate)
  │       └── quickShopModal         (add-to-cart modal)
  ├── 7 Custom Apex Controllers
  ├── 14 Flows (custom + OOB Commerce order management)
  ├── AuthorizeNet Accept Hosted (payment iframe integration)
  └── Mapbox GL (county-level state maps)
```

**Key Architecture Patterns:**

- All components share state via `localStorage` key `abc_selected_state` (written by `stateFilterLwc`)
- Commerce Products Search API used for product data (not Apex SOQL)
- Quantity rules use OOB `PurchaseQuantityRule` / `ProductQuantityRule` objects
- Per-format pricing stored in `ProductFormatPricing__c` custom object
- Payment: AuthorizeNet Accept Hosted iframe → webhook → `AuthorizeNet_Transaction__c`

---

## 2. What Changed (Team Updates Retrieved)

Fresh code was retrieved from the org before this review. The following components all showed as **Changed** — meaning the team made updates yesterday:

- `similarProductsByState` (JS, HTML, CSS)
- `similarProductsBySubject` (JS, HTML, CSS)
- `soleSourceLetters` (JS, HTML, CSS)
- `stateCountyMapbox` (JS, HTML, CSS)
- `stateFilterLwc` (JS, HTML, CSS)
- `stateReps` (JS, HTML, CSS)
- `stateTestimonials` (JS, HTML, CSS)

Additionally, **5 new components were added** that did not exist in the previous session:

- `aboutSection`
- `checkoutLoginGate`
- `howToOrder`
- `mapPlusTestimonial`
- `stateCountyMapbox`

---

## 3. Critical Security Issues — Fix Immediately

### C1 — No HMAC Signature Validation on Payment Webhook

**File:** `force-app/main/default/classes/AuthorizeNetWebhookRest.cls`  
**Severity:** 🔴 CRITICAL — Payment Security Vulnerability

**Problem:**  
Authorize.Net signs every webhook POST with an `X-ANET-Signature` header (HMAC-SHA512 of the body using a signing key configured in the merchant portal). Your webhook endpoint **completely ignores this header**. This means:

- Any external actor who knows your webhook URL can POST fake payment data
- The fake data is stored as a real `AuthorizeNet_Transaction__c` record
- If any downstream process treats these records as payment confirmations, orders can be marked as paid without actual payment

**Solution:**

```apex
// In AuthorizeNetWebhookRest.handlePost(), add at the top:
private static void validateHmacSignature(String body) {
    String sigHeader = RestContext.request.headers.get('X-ANET-Signature');
    if (String.isBlank(sigHeader)) {
        RestContext.response.statusCode = 401;
        throw new CalloutException('Missing X-ANET-Signature header');
    }
    // Strip "sha512=" prefix if present
    String hashFromHeader = sigHeader.startsWith('sha512=')
        ? sigHeader.substring(7)
        : sigHeader;

    // Get signing key from custom metadata
    AuthorizeNet_Config__mdt config = AuthorizeNet_Config__mdt.getInstance('Default');
    String signingKey = config.WebhookSigningKey__c; // Add this field to the mdt

    Blob sigBlob = Crypto.generateMac(
        'hmacSHA512',
        Blob.valueOf(body),
        Blob.valueOf(signingKey)
    );
    String computedHash = EncodingUtil.convertToHex(sigBlob).toUpperCase();

    if (!computedHash.equals(hashFromHeader.toUpperCase())) {
        RestContext.response.statusCode = 401;
        throw new CalloutException('Invalid webhook signature');
    }
}
```

Also add `WebhookSigningKey__c` (Text, Encrypted) to the `AuthorizeNet_Config__mdt` custom metadata type and set the value from the Authorize.Net Merchant Portal → Account → Webhooks → Manage Endpoints.

---

### C2 — HTTP Header Injection in ProductRecommendationsController

**File:** `force-app/main/default/classes/ProductRecommendationsController.cls`  
**Severity:** 🔴 CRITICAL — Server-Side Header Injection + NullPointerException

**Problem:**

```apex
req.setHeader('Cookie', cookie); // cookie comes from LWC caller with no sanitization
```

A malicious caller can embed `\r\n` in the cookie string to inject arbitrary HTTP headers (HTTP response splitting/header injection). Additionally:

- `anchorValues.length()` throws `NullPointerException` if `anchorValues` is null
- `anchorValues` is concatenated into the URL without URL-encoding
- Org domain and WebStore ID are hardcoded (`americanbookcompany.my.salesforce.com`, `0ZEam000004dJDNGA2`)
- API version hardcoded to `v55.0` (org uses v66.0)

**Solution:**

```apex
@AuraEnabled
public static String getRecommendations(String recommender, String anchorValues) {
    try {
        if (String.isBlank(recommender)) {
            throw new AuraHandledException('recommender is required');
        }

        // Use UserInfo.getSessionId() — do NOT accept cookie from caller
        String sessionId = UserInfo.getSessionId();
        String webStoreId = '0ZEam000004dJDNGA2'; // Move to Custom Metadata
        String baseUrl = URL.getSalesforceBaseUrl().toExternalForm();

        String endpoint = baseUrl
            + '/services/data/v66.0/commerce/webstores/'
            + webStoreId
            + '/ai/recommendations?recommender='
            + EncodingUtil.urlEncode(recommender, 'UTF-8');

        if (String.isNotBlank(anchorValues)) {
            endpoint += '&anchorValues=' + EncodingUtil.urlEncode(anchorValues, 'UTF-8');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('GET');
        req.setHeader('Authorization', 'OAuth ' + sessionId);
        req.setHeader('Content-Type', 'application/json');

        HttpResponse res = new Http().send(req);

        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('API error: ' + res.getStatus());
        }

        return res.getBody();
    } catch (AuraHandledException e) {
        throw e;
    } catch (Exception e) {
        throw new AuraHandledException('Recommendations unavailable: ' + e.getMessage());
    }
}
```

---

### C3 — AuthorizeNet Payment Token Logged to Console

**File:** `force-app/main/default/lwc/authorizeNetCheckoutButton/authorizeNetCheckoutButton.js`  
**Severity:** 🔴 CRITICAL — Sensitive Data Exposure

**Problem:**

```javascript
console.log("Authorize.Net token:", tokenResponse.token); // REMOVE THIS
```

Payment tokens are visible to anyone with browser DevTools open — customers, testers, or an attacker on a shared device.

**Solution:** Delete this line entirely.

---

### C4 — User Email in URL Query String

**File:** `force-app/main/default/lwc/checkoutLoginGate/checkoutLoginGate.js`  
**Severity:** 🔴 HIGH — Privacy Violation

**Problem:**

```javascript
// Email is exposed in browser history, server logs, proxy logs
pageReference: { type: 'standard__webPage', attributes: { url: `/login?un=${encodeURIComponent(email)}` }}
```

**Solution:** Salesforce Experience Cloud uses a POST-based login form. Replace the navigation with a standard HTML form POST:

```javascript
handleSignIn() {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/AmericanBookCompany/login';
    const usernameInput = document.createElement('input');
    usernameInput.type = 'hidden';
    usernameInput.name = 'username';
    usernameInput.value = this.email.trim();
    const passwordInput = document.createElement('input');
    passwordInput.type = 'hidden';
    passwordInput.name = 'password';
    passwordInput.value = this.password;
    form.appendChild(usernameInput);
    form.appendChild(passwordInput);
    document.body.appendChild(form);
    form.submit();
}
```

---

### C5 — Mapbox Access Token Hardcoded in Source Code

**Files:** `force-app/main/default/lwc/mapPlusTestimonial/mapPlusTestimonial.js`, `force-app/main/default/lwc/stateCountyMapbox/stateCountyMapbox.js`  
**Severity:** 🔴 HIGH — API Key Exposure

**Problem:** The Mapbox public token `pk.eyJ1IjoiYWthc2h0aGVsb2Rlc3RvbmVncm91cCIsImEiOiJjbW05bG5kaGMwMHQ1Mm9zM3lrM25ydTRwIn0.pSVyEJv1yK_Z8_U1tXKHTA` is embedded in two JS files and is visible in the deployed JavaScript bundle. Anyone can extract it and make billable Mapbox API calls against your account.

**Solution (Short-term):** In the Mapbox Dashboard → Tokens, restrict this token by URL (only allow `americanbookcompany.my.site.com`).

**Solution (Long-term):** Serve the token from Apex:

```apex
// Add MapboxToken__c field to a Custom Metadata Type
@AuraEnabled(cacheable=true)
public static String getMapboxToken() {
    return [SELECT MapboxToken__c FROM App_Config__mdt LIMIT 1].MapboxToken__c;
}
```

Then in LWC:

```javascript
import getMapboxToken from "@salesforce/apex/AppConfigController.getMapboxToken";
// Wire or imperatively call, then use result in mapboxgl.accessToken = token;
```

**Additional Mapbox Issue:** Both map components call `hideMapboxBranding()` which removes the Mapbox logo from the DOM. This **violates Mapbox Terms of Service** unless you are on a paid plan that explicitly allows logo removal. Check your Mapbox plan or remove the `hideMapboxBranding` calls.

---

## 4. High Priority Bugs — Broken Features

### B1 — Quantity Rules Never Load on Product Detail Page

**File:** `force-app/main/default/lwc/productDetailComponent/productDetailComponent.js`

**Problem:**

```javascript
const PRODUCT_DETAIL_FIELDS = ["StockKeepingUnit", "Name"]; // Missing purchaseQuantityRule!
```

The Commerce Products API only returns `purchaseQuantityRule` when you explicitly request it. Without it in `PRODUCT_DETAIL_FIELDS`, the PDP always falls back to hardcoded defaults: min=10, max=50, inc=1. Any quantity rules configured in the org are silently ignored.

**Solution:**

```javascript
const PRODUCT_DETAIL_FIELDS = [
  "StockKeepingUnit",
  "Name",
  "purchaseQuantityRule", // ADD THIS
  "primaryProductCategoryPath"
];
```

---

### B2 — "Shop All Books" Button Crashes the Page

**File:** `force-app/main/default/lwc/featuredStateBooks/featuredStateBooks.js`

**Problem:** The template binds `onclick={handleShopAll}` but `handleShopAll` is never defined as a method in the JS class. Clicking the button throws a runtime `TypeError` and may crash the component.

**Solution:** Add the missing method:

```javascript
handleShopAll() {
    const state = window.localStorage.getItem('abc_selected_state') || this.selectedState;
    const url = `${SHOP_ALL_URL}?refinement=${encodeURIComponent('State__c:' + state)}`;
    window.open(url, '_self');
}
```

---

### B3 — Quick Shop Modal Spinner Never Resolves (No-Variation Products)

**File:** `force-app/main/default/lwc/quickShopModal/quickShopModal.js`

**Problem:**

```javascript
get isLoading() {
    return !this.title || !this.variationPricing; // BUG: variationPricing可 be null by design
}
```

If `variationPricing` is `null` (a product with no format variants configured), the spinner shows permanently — the modal body never appears.

**Solution:**

```javascript
get isLoading() {
    return !this.title; // Only block on missing title; variationPricing can legitimately be null
}

get hasVariations() {
    return this.variationPricing && this.variationPricing.hasVariations;
}
```

---

### B4 & B5 — Catalog Downloader State Sync + Mississippi Data Error

**File:** `force-app/main/default/lwc/catalogDownloader/catalogDownloader.js`

**Problem B4:** `connectedCallback` defaults to `this.catalogData[0]` (Alabama) and never reads `localStorage`. Every user who has already selected a state will see the wrong catalog.

**Problem B5:** In the hardcoded `catalogData` array, the Mississippi (`ms`) entry has the wrong `imageUrl` and `pdfUrl` — it points to the Minnesota catalog files (`mn-catalog-thumb.jpg`, `mn-catalog-spring-022526v1-web.pdf`).

**Solution B4:**

```javascript
connectedCallback() {
    const savedState = window.localStorage.getItem('abc_selected_state');
    if (savedState) {
        const match = this.catalogData.find(
            c => c.state.toLowerCase() === savedState.toLowerCase()
        );
        this.selectedStateData = match || this.catalogData[0];
    } else {
        this.selectedStateData = this.catalogData[0];
    }
    // Also listen for state changes
    window.addEventListener('abcstatechange', this._handleStateChange.bind(this));
}

_handleStateChange(event) {
    const newState = event.detail?.state || window.localStorage.getItem('abc_selected_state');
    if (newState) {
        const match = this.catalogData.find(
            c => c.state.toLowerCase() === newState.toLowerCase()
        );
        if (match) this.selectedStateData = match;
    }
}

disconnectedCallback() {
    window.removeEventListener('abcstatechange', this._handleStateChange.bind(this));
}
```

**Solution B5:** In the `catalogData` array, fix the Mississippi entry:

```javascript
// WRONG (current):
{ state: 'Mississippi', abbr: 'ms', imageUrl: '.../mn-catalog-thumb.jpg', pdfUrl: '.../mn-catalog-spring-022526v1-web.pdf' }

// CORRECT:
{ state: 'Mississippi', abbr: 'ms', imageUrl: '.../ms-catalog-thumb.jpg', pdfUrl: '.../ms-catalog-spring-022526v1-web.pdf' }
```

---

### B6 — Search Results Page Always Shows Georgia Sales Reps

**File:** `force-app/main/default/lwc/stateReps/stateReps.js`

**Problem:** `resolveState()` has a hardcoded return of `'Georgia'` when the URL matches the `/global-search` segment. Every visitor on the `/global-search/all` page — regardless of their selected state — sees Georgia reps.

**Solution:**

```javascript
resolveState() {
    // Read from localStorage first (set by stateFilterLwc)
    const stored = window.localStorage.getItem('abc_selected_state');
    if (stored) return stored;

    // Fallback: extract from URL path
    const path = window.location.pathname;
    const segments = path.split('/');
    const stateSegment = segments.find(s => this._allStates.includes(s.toLowerCase()));
    if (stateSegment) return stateSegment;

    return this.defaultState || 'Georgia';
}
```

---

### B7 — Testimonials Default to Empty (Lowercase State Bug)

**Files:** `force-app/main/default/lwc/stateTestimonials/stateTestimonials.js`, `force-app/main/default/lwc/mapPlusTestimonial/mapPlusTestimonial.js`

**Problem:** Both components default `this.currentState = 'california'` (lowercase). The Apex controller queries `WHERE State__c = :stateCode`. If `Carousel_Content__c` records store `'California'` (titlecase), the query returns zero results on initial load.

**Solution:**

```javascript
// In connectedCallback, resolve state before first fetch:
connectedCallback() {
    const stored = window.localStorage.getItem('abc_selected_state');
    this.currentState = stored
        ? stored.charAt(0).toUpperCase() + stored.slice(1).toLowerCase()
        : 'Georgia'; // safe known-populated default
    this.fetchTestimonials();
}
```

---

### B8 — "Remember Me" is a Non-Functional UI Element

**File:** `force-app/main/default/lwc/checkoutLoginGate/checkoutLoginGate.js`

**Problem:** `this.rememberMe` is set in `handleRememberChange` but never referenced in `handleSignIn`. The checkbox does nothing.

**Solution:** Either pass `rememberMe` to the login call as a parameter, or remove the checkbox from the UI until it is implemented.

---

### B9 — Standalone Map Mode Unreachable Dead Code

**File:** `force-app/main/default/lwc/stateCountyMapbox/stateCountyMapbox.js`

**Problem:**

```javascript
get isCompact() {
    return true; // Always true — if:false={isCompact} branch in template is dead code
}
```

**Solution:** Either implement the toggle logic (read from a `@api compact` property) or remove the `if:false={isCompact}` block from the HTML template entirely.

---

### B10 — productGrid is Non-Functional Scaffolding

**File:** `force-app/main/default/lwc/productGrid/`

**Problem:** The entire business logic in `productGrid` is commented out. The HTML template is a hardcoded Georgia mock with fixed product names and image URLs. Quick Shop buttons call `openModal()` but no modal is defined. This component should not be live on any Experience Builder page.

**Solution:** Either complete the implementation or remove the component from any active Experience Builder pages and delete it from the repository until ready.

---

## 5. LWC Component Review — All 19 Components

| #   | Component                    | Status      | Key Issues                                                                                                                                             |
| --- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `aboutSection`               | ✅ Clean    | Static content, no issues                                                                                                                              |
| 2   | `authorizeNetCheckoutButton` | ⚠️ Issues   | Token in console log (C3); stale checkout blocks users; no in-component error display                                                                  |
| 3   | `catalogDownloader`          | 🔴 Bugs     | Ignores localStorage state (B4); Mississippi shows Minnesota catalog (B5); 51-entry hardcoded array                                                    |
| 4   | `checkoutLoginGate`          | 🔴 Bugs     | Email in URL (C4); Remember Me non-functional (B8)                                                                                                     |
| 5   | `customResults`              | ⚠️ Issues   | State change does not re-fetch products; silent API failure shows empty results; 250ms polling; pre-loads up to 960 products                           |
| 6   | `featuredStateBooks`         | 🔴 Bug      | `handleShopAll` undefined — runtime crash on click (B2)                                                                                                |
| 7   | `howToOrder`                 | ⚠️ Quality  | All inline styles (no CSS file); external images not on Salesforce CDN; typo "pleae contact"                                                           |
| 8   | `mapPlusTestimonial`         | 🔴 Security | Mapbox token hardcoded (C5); `currentState` defaults to lowercase 'california' (B7); hides Mapbox branding (ToS); 90% duplicate of `stateCountyMapbox` |
| 9   | `productDetailComponent`     | 🔴 Bug      | Missing `purchaseQuantityRule` in PRODUCT_DETAIL_FIELDS (B1); hardcoded feature lists                                                                  |
| 10  | `productGrid`                | 🔴 Dead     | Entire component is commented-out scaffolding with hardcoded mock data                                                                                 |
| 11  | `productRecommendation`      | ⚠️ Issues   | Silent error — component disappears on failure; URL pattern may not match org routing                                                                  |
| 12  | `quickShopModal`             | 🔴 Bug      | `isLoading` blocks on null `variationPricing` → spinner forever (B3)                                                                                   |
| 13  | `similarProductsByState`     | ⚠️ Minor    | Double-constrains query with state in both refinement and search term                                                                                  |
| 14  | `similarProductsBySubject`   | ⚠️ Issues   | Only checks 2 of 5 API response shapes; subject extraction fragile (URL slug regex); uses `window.localStorage` inconsistently                         |
| 15  | `soleSourceLetters`          | ⚠️ Issues   | Class named `UpdatedComponent` (mismatch); `target="_blank"` missing `rel="noopener noreferrer"`                                                       |
| 16  | `stateCountyMapbox`          | 🔴 Security | Mapbox token hardcoded (C5); `isCompact` always true (B9); 90% duplicate of `mapPlusTestimonial`                                                       |
| 17  | `stateFilterLwc`             | ⚠️ Issues   | Hard-coded layout component IDs in injected CSS; multiple `setInterval` polling; `document.head` CSS injection                                         |
| 18  | `stateReps`                  | 🔴 Bug      | Always shows Georgia reps on search page (B6); only 15 of 51 states have rep data; `javascript:void(0)` anti-pattern                                   |
| 19  | `stateTestimonials`          | 🔴 Bug      | Lowercase 'california' default = empty testimonials on load (B7); hash watcher misses localStorage state changes                                       |

---

## 6. Apex Class Review — All 7 Custom Classes

### AuthorizeNetAcceptHostedTokenService.cls

**API Version:** 65 | **Sharing:** `without sharing`

| Severity  | Finding                                                                | Recommendation                                                           |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 🔴 HIGH   | `without sharing` with no justification                                | Change to `with sharing`                                                 |
| 🟠 MEDIUM | `rawResponse` field exposed to LWC via `@AuraEnabled`                  | Remove `rawResponse` from DTO or strip it before returning               |
| 🟠 MEDIUM | Internal exception details (type, line number) returned to browser     | Strip to generic message only                                            |
| 🟠 MEDIUM | `returnUrl`/`cancelUrl` accepted from LWC with no domain validation    | Validate URLs are on your allowed domain                                 |
| 🟡 LOW    | `showReceipt` is validated but never read in the payload builder — bug | Fix to actually use the field in `buildHostedPaymentTokenPayload`        |
| 🟡 LOW    | Hardcoded `https://www.google.com` as fallback `continueUrl`           | Throw validation error instead                                           |
| 🟡 LOW    | `invoiceNumber` not validated against Authorize.Net's 20-char limit    | Add `if (referenceId.length() > 20) referenceId = referenceId.left(20);` |

---

### AuthorizeNetWebhookRest.cls

**API Version:** 59 | **Sharing:** `without sharing` | **Access:** `global`

| Severity    | Finding                                                                 | Recommendation                                                            |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 🔴 CRITICAL | No HMAC-SHA512 signature validation — anyone can POST fake payment data | Implement as shown in Section 3 (C1)                                      |
| 🔴 HIGH     | No authentication check — endpoint may be accessible to guests          | Verify Guest Profile has no REST access to this resource in Setup → Sites |
| 🟠 MEDIUM   | `without sharing` + `global` access unnecessarily broad                 | Change to `with sharing`; change to `public`                              |
| 🟠 MEDIUM   | `insert as system` bypasses FLS/CRUD                                    | Document intent; prefer `insert as user` if permission set covers it      |
| 🟡 LOW      | No payload size check on `Payload__c` (LongTextArea 131072)             | Add `if (body.length() > 131000) throw...`                                |
| 🟡 LOW      | `eventType`, `transactionId`, `authAmount` not parsed on insert         | Extract key fields during initial insert for easier downstream processing |

---

### ProductQuantityRuleController.cls

**API Version:** 66 | **Sharing:** `with sharing` ✅

| Severity | Finding                                                  | Recommendation                                                      |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| ✅ GOOD  | `WITH USER_MODE` in SOQL, bind variables, `with sharing` | No changes needed                                                   |
| 🟡 LOW   | `productId` typed as `String` instead of `Id`            | Change to `Id productId` for early format validation                |
| 🟡 LOW   | Hardcoded fallback defaults (10/50/1)                    | Move to Custom Metadata for easier admin changes without deployment |

---

### ProductRecommendationsController.cls

**API Version:** 65 | **Sharing:** `public with sharing`

| Severity    | Finding                                                             | Recommendation                                              |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 🔴 CRITICAL | Client-supplied `cookie` injected as HTTP header — header injection | Rewrite as shown in Section 3 (C2)                          |
| 🔴 CRITICAL | `anchorValues.length()` throws NPE if null                          | Add null check; rewrite as shown                            |
| 🔴 HIGH     | `anchorValues` URL-concatenated without encoding                    | Use `EncodingUtil.urlEncode()`                              |
| 🔴 HIGH     | Org domain and WebStore ID hardcoded in source                      | Move to Custom Metadata or use `URL.getSalesforceBaseUrl()` |
| 🟠 MEDIUM   | API version hardcoded to `v55.0` (org is on `v66.0`)                | Update to `v66.0`                                           |
| 🟠 MEDIUM   | No try/catch, no HTTP status check                                  | Add error handling as shown in Section 3                    |

---

### ProductVariationController.cls

**API Version:** 66 | **Sharing:** `without sharing`

| Severity  | Finding                                                           | Recommendation                                |
| --------- | ----------------------------------------------------------------- | --------------------------------------------- |
| 🟠 HIGH   | `without sharing`                                                 | Change to `with sharing`                      |
| 🟠 MEDIUM | No `WITH USER_MODE` in SOQL — FLS not enforced                    | Add `WITH USER_MODE`                          |
| 🟡 LOW    | Dead `webStoreId` parameter — accepted but never used             | Remove parameter                              |
| 🟡 LOW    | `testPricebookId` `@TestVisible` field declared but never used    | Remove                                        |
| ⚠️ NOTE   | `hasVariations` returns `false` when only 1 format variant exists | Verify if intentional; consider `size() >= 1` |

---

### StateTestimonialsController.cls

**API Version:** 59

| Severity  | Finding                                                                 | Recommendation                                                        |
| --------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 🟠 HIGH   | Caller-supplied `siteId` takes precedence over `Network.getNetworkId()` | Swap precedence: use `Network.getNetworkId()` first                   |
| 🟠 HIGH   | Only Alabama + Georgia have CMS keys — 48 states return empty           | Populate remaining 48 state CMS collection keys                       |
| 🟠 MEDIUM | 25 `System.debug(LoggingLevel.ERROR, ...)` calls in production          | Change to `LoggingLevel.DEBUG` — ERROR level logs appear even in prod |
| 🟡 LOW    | No test class exists                                                    | Create a test class with mocked `ConnectApi` responses                |

---

### TestimonialCarouselController.cls

**API Version:** 59 | **Sharing:** `without sharing`

| Severity  | Finding                               | Recommendation                         |
| --------- | ------------------------------------- | -------------------------------------- |
| 🟠 MEDIUM | `without sharing`                     | Change to `with sharing`               |
| 🟡 LOW    | 200+ lines of commented-out dead code | Delete the dead code                   |
| 🟡 LOW    | No `LIMIT` clause on query            | Add `LIMIT 50` or a configurable limit |

---

## 7. Flow Review

| Flow                                          | Type                  | Issues                                                                                                                 |
| --------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Create_Pricebook_Entry`                      | AutoLaunched (active) | **No fault connector** — unhandled `DmlException` on duplicate PBE crashes product saves silently                      |
| `Create_PE`                                   | AutoLaunched          | **Misleading name** — handles `ProcessException` categorization, NOT pricebook entry creation                          |
| `Submit_a_PO`                                 | Screen flow           | **All 50 states hardcoded as choice elements** — requires deployment to update the state list                          |
| `SendOrderConfirmationFlow_ABC_1771260376864` | AutoLaunched          | Uses hardcoded Pardot content ID (`MCYHRO5ES3EJBIPMU6HPPHDMW5CA`) — must be updated manually if email template changes |
| `Auto_Populate_Opportunity_Number`            | AutoLaunched          | No issues — standard CRM utility                                                                                       |
| `Quote_Before_Trigger_Flow`                   | Unknown               | Undocumented — review needed                                                                                           |
| OOB Commerce Flows (6)                        | Various               | Cancel_All, Cancel_Item, Return_Item, RMA_Return, Create_CO, Refund_XSF_OS — not customized                            |

### Fix: Create_Pricebook_Entry — Add Fault Path

In the flow builder, connect a **Fault connector** from the Create Records element to an Assignment element that either:

- Logs the error to a custom object/platform event, OR
- Checks if a PBE already exists first (add a Get Records before the Create Records to check for existing PBE, and only create if not found)

---

## 8. Configuration Review

### Named Credentials

| Credential             | Endpoint                        | Status                       |
| ---------------------- | ------------------------------- | ---------------------------- |
| `AuthorizeNet_Sandbox` | `https://apitest.authorize.net` | ✅ Retrieved locally         |
| `AuthorizeNet_Prod`    | `https://api.authorize.net`     | ⚠️ **NOT retrieved locally** |

**Action Required:** Verify in org Setup → Named Credentials whether `AuthorizeNet_Prod` exists. If your store is live and `UseSandbox__c = false` in `AuthorizeNet_Config__mdt`, but no prod named credential exists, all payment token requests will fail at runtime. Run:

```bash
sf data query --query "SELECT DeveloperName, UseSandbox__c FROM AuthorizeNet_Config__mdt" --target-org ABC-Production
```

### Custom Objects

| Object                         | Status                      | Notes                                                                                                                       |
| ------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `AuthorizeNet_Transaction__c`  | ✅ Active                   | Webhook payloads stored here                                                                                                |
| `AuthorizeNet_Config__mdt`     | ✅ Active                   | API credentials                                                                                                             |
| `Carousel_Content__c`          | ✅ Active                   | Testimonial carousel entries                                                                                                |
| `In_App_Checklist_Settings__c` | ✅ Active                   | Custom settings                                                                                                             |
| `ProductFormatPricing__c`      | ⚠️ Exists but usage unclear | Format-level pricing (Color Print vs B&W Print) — verify it is actively populated and wired to `ProductVariationController` |

### ProductFormatPricing\_\_c Fields

`Format_Name__c`, `Unit_Price__c`, `Bulk_Price__c`, `Bulk_Threshold__c`, `Min_Quantity__c`, `Max_Quantity__c`, `Increment_Quantity__c`, `Product__c` (lookup to Product2), `Sort_Order__c`, `Is_Active__c`

---

## 9. Code Quality Issues

| #   | Category          | Finding                                                                                                                                                                | Files Affected                                                                    |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Q1  | Duplication       | `enrichProductsWithPricing`, `normalizeProduct`, `buildPricingEndpoint`, `extractPricingMap` duplicated across 4+ components — no shared utility                       | customResults, featuredStateBooks, productDetailComponent, similarProductsByState |
| Q2  | Duplication       | ~90% code overlap between `mapPlusTestimonial` and `stateCountyMapbox` (FIPS tables, Mapbox setup, GeoJSON logic, color scales)                                        | Both map components                                                               |
| Q3  | Fragility         | Hard-coded LWC layout component IDs (`columns-47c9`, `columns-3835`) in injected CSS in `stateFilterLwc` — breaks silently if Experience Builder page layout is edited | stateFilterLwc                                                                    |
| Q4  | Maintenance       | All styling via inline `style=""` attributes in `howToOrder` — no CSS file                                                                                             | howToOrder                                                                        |
| Q5  | Reliability       | External images in `howToOrder` hardcoded to `americanbookcompany.com` domain (not Salesforce CDN) — breaks if external site changes                                   | howToOrder                                                                        |
| Q6  | Misleading        | Class in `soleSourceLetters` is named `UpdatedComponent` — doesn't match file/folder name                                                                              | soleSourceLetters.js                                                              |
| Q7  | Incomplete Data   | `stateReps` only covers 15 of 51 states — 36+ states show generic "ABC Sales Team"                                                                                     | stateReps.js (REPS_BY_STATE constant)                                             |
| Q8  | Anti-pattern      | `javascript:void(0)` used as fallback href for missing emails in `stateReps`                                                                                           | stateReps.html                                                                    |
| Q9  | Inconsistency     | 5 components use 250ms `setInterval` URL polling; `abcstatechange` custom event exists but is used by only 2 of 7 state-aware components                               | stateReps, stateTestimonials, stateCountyMapbox                                   |
| Q10 | Hardcoded Content | 51-entry catalog array hardcoded in `catalogDownloader` — updating a PDF requires code deployment                                                                      | catalogDownloader.js                                                              |
| Q11 | Security          | `target="_blank"` external links missing `rel="noopener noreferrer"` in `soleSourceLetters`                                                                            | soleSourceLetters.html                                                            |
| Q12 | Content Bug       | Typo in `howToOrder`: "pleae contact" (missing 's')                                                                                                                    | howToOrder.html                                                                   |
| Q13 | Version Drift     | `ProductRecommendationsController` hardcodes API `v55.0`; org uses `v66.0`                                                                                             | ProductRecommendationsController.cls                                              |
| Q14 | Dead Code         | 200+ lines commented-out code in `TestimonialCarouselController`                                                                                                       | TestimonialCarouselController.cls                                                 |
| Q15 | Hardcoded         | Feature lists in `productDetailComponent` hardcoded to `["Answer Key", "Posttest", "Pretest"]` / `["eBook"]` — not data-driven                                         | productDetailComponent.js                                                         |

---

## 10. Recommended Fix Priority & Action Plan

### Phase 1 — Security (This Week)

| Task                                                                       | Owner        | File(s)                                         |
| -------------------------------------------------------------------------- | ------------ | ----------------------------------------------- |
| Implement HMAC webhook signature validation                                | Backend Dev  | `AuthorizeNetWebhookRest.cls`                   |
| Remove cookie header injection; rewrite `ProductRecommendationsController` | Backend Dev  | `ProductRecommendationsController.cls`          |
| Remove `console.log` of payment token                                      | Frontend Dev | `authorizeNetCheckoutButton.js`                 |
| Move Mapbox token out of source; restrict by domain in Mapbox dashboard    | Frontend Dev | `mapPlusTestimonial.js`, `stateCountyMapbox.js` |
| Fix email-in-URL login flow                                                | Frontend Dev | `checkoutLoginGate.js`                          |
| Verify `AuthorizeNet_Prod` named credential exists in org                  | Admin        | Salesforce Setup                                |

### Phase 2 — Broken Features (Week 2)

| Task                                                         | Owner        | File(s)                                         |
| ------------------------------------------------------------ | ------------ | ----------------------------------------------- |
| Add `purchaseQuantityRule` to PRODUCT_DETAIL_FIELDS          | Frontend Dev | `productDetailComponent.js`                     |
| Define `handleShopAll` method                                | Frontend Dev | `featuredStateBooks.js`                         |
| Fix `quickShopModal` `isLoading` guard                       | Frontend Dev | `quickShopModal.js`                             |
| Fix `catalogDownloader` localStorage sync + Mississippi data | Frontend Dev | `catalogDownloader.js`                          |
| Fix `stateReps` `resolveState` Georgia-always bug            | Frontend Dev | `stateReps.js`                                  |
| Fix lowercase state default for testimonials                 | Frontend Dev | `stateTestimonials.js`, `mapPlusTestimonial.js` |
| Add fault path to `Create_Pricebook_Entry` flow              | Admin/Dev    | Flow Builder                                    |

### Phase 3 — Content & Data Gaps (Week 3)

| Task                                                                  | Owner              | File(s)                                    |
| --------------------------------------------------------------------- | ------------------ | ------------------------------------------ |
| Add missing `WebhookSigningKey__c` to `AuthorizeNet_Config__mdt`      | Admin              | Custom Metadata                            |
| Populate remaining 48 state CMS keys in `StateTestimonialsController` | Dev + Content Team | `StateTestimonialsController.cls`          |
| Expand `REPS_BY_STATE` to all 51 states                               | Content Team + Dev | `stateReps.js`                             |
| Fix `AuthorizeNetAcceptHostedTokenService` `showReceipt` bug          | Backend Dev        | `AuthorizeNetAcceptHostedTokenService.cls` |
| Remove `rawResponse` from AuraEnabled DTO                             | Backend Dev        | `AuthorizeNetAcceptHostedTokenService.cls` |

### Phase 4 — Code Quality & Refactoring (Ongoing)

| Task                                                                   | File(s)                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Extract shared pricing utilities into a service module                 | customResults, featuredStateBooks, productDetailComponent, similarProductsByState |
| Refactor map components to share Mapbox base logic                     | mapPlusTestimonial, stateCountyMapbox                                             |
| Replace `setInterval` polling with `abcstatechange` event consistently | stateReps, stateTestimonials, stateCountyMapbox                                   |
| Move `howToOrder` inline styles to a CSS file                          | howToOrder                                                                        |
| Delete `productGrid` or complete its implementation                    | productGrid                                                                       |
| Add `TestimonialCarouselController` `LIMIT` + delete commented code    | TestimonialCarouselController.cls                                                 |
| Fix typo "pleae contact"                                               | howToOrder.html                                                                   |

---

## 11. Solutions & Code Fixes

> Full solution code for critical and high priority issues is provided in Section 3 (C1–C5) and Section 4 (B1–B10). Below are additional quick fixes.

### Fix: soleSourceLetters — Add rel="noopener noreferrer"

```html
<!-- Before -->
<a href="https://..." target="_blank">View Document</a>

<!-- After -->
<a href="https://..." target="_blank" rel="noopener noreferrer"
  >View Document</a
>
```

### Fix: TestimonialCarouselController — Add LIMIT + Change Sharing + Remove Dead Code

```apex
@AuraEnabled(cacheable=true)
public static List<Carousel_Content__c> getCarouselData(String stateCode) {
    return [
        SELECT Id, Name, Testimonial_Text__c, Author_Name__c, Sort_Order__c, Active__c, State__c
        FROM Carousel_Content__c
        WHERE State__c = :stateCode
        AND Active__c = true
        ORDER BY Sort_Order__c ASC
        LIMIT 20  // ADD LIMIT
    ];
}
// Change class declaration from: public without sharing class
//                            to: public with sharing class
// Delete all 200+ lines of commented-out code below the active methods
```

### Fix: Create_Pricebook_Entry — Prevent Duplicate DML Error

In Flow Builder, before the "Create Pricebook Entry" element:

1. Add a **Get Records** element: query `PricebookEntry WHERE Product2Id = {recordId} AND Pricebook2Id = {pricebookId}`
2. Add a **Decision** element: if `Count > 0` → route to End; if `Count = 0` → route to Create Records
3. This prevents the duplicate key DML exception entirely

### Fix: stateFilterLwc — Replace Hardcoded Component IDs

Instead of targeting layout component IDs like `#columns-47c9`, target by semantic class or wrapper structure:

```javascript
// Before (fragile):
const HEADER_CSS = `
  [id="columns-47c9"] { ... }
  [id="columns-3835"] { ... }
`;

// After (stable): use semantic selectors agreed upon with your Experience Builder page design
const HEADER_CSS = `
  .abc-header-wrapper { ... }
  .abc-nav-wrapper { ... }
`;
// And add the corresponding CSS classes to your Experience Builder template regions
```

---

_This document was generated from a live code review against the ABC-Production org on March 25, 2026. All code was retrieved fresh from the org before analysis._
