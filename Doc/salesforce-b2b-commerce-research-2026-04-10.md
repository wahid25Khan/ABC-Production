# Salesforce B2B Commerce Research Notes

Date: 2026-04-10

## Why this note exists

The storefront still has unresolved behavior after several rounds of implementation changes. The next useful step is to align debugging with Salesforce's current B2B Commerce documentation instead of continuing to guess at platform behavior.

## Current official documentation map

These are the current Salesforce developer guide entry points that match this storefront's architecture.

1. Get Started with B2B Commerce
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-dev-guide.html
   - Focus: overall platform model for B2B and D2C storefronts.

2. B2B Commerce Data Model
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-dev-data-model.html
   - Focus: standard Commerce objects and supported relationships.

3. Overview of B2B Commerce APIs
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-d2c-comm-storefront-apis-parent.html
   - Focus: cart, checkout, pricing, product/category, order summary, wishlist, tax, address, profile APIs.

4. Storefront APIs for custom LWCs
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-display-lwc-apis.html
   - Focus: supported Commerce APIs for LWR-based custom components.

5. Customize a Checkout Component for a B2B or B2C Store (LWR)
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-create-checkout-component.html
   - Focus: supported checkout extension points, component communication, and checkout lifecycle.

6. Commerce LWR Storefront Performance Best Practices
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-storefront-performance-best-practices.html
   - Focus: how to avoid slow or brittle storefront behavior in LWR Commerce sites.

7. Payment and integration docs that matter for this project
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-payment-integration-container.html
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-payment-integration.html
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-payment-flow-apis.html
   - https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-checkout-payment-b2b-setup.html

## What the current docs imply for this repo

### 1. The platform has distinct layers, and this repo crosses them heavily

Salesforce currently documents three different implementation layers that matter here:

1. Standard Commerce data model
2. Storefront APIs and Commerce client APIs for custom LWCs
3. Checkout/payment extension points for LWR stores

This repo uses all three, but not consistently.

### 2. We are mixing supported client APIs with direct `webruntime` REST calls

The repo already uses Commerce client APIs in some places, for example `addItemToCart` from `commerce/cartApi`. But many components also call `webruntime/api/services/data/v66.0/commerce/webstores/...` directly.

That mix is visible in:

- `force-app/main/default/lwc/utils/productHelper.js`
- `force-app/main/default/lwc/productDetailComponent/productDetailComponent.js`
- `force-app/main/default/lwc/customResults/customResults.js`
- `force-app/main/default/lwc/authorizeNetCheckoutButton/authorizeNetCheckoutButton.js`

This is the most likely source of drift when platform behavior changes for guest users, checkout state, response shape, or supported query params.

### 3. The official Commerce data model is not the same thing as this project's custom variation/pricing overlay

Salesforce documents standard product, attribute, catalog, pricing, cart, and search objects. This repo adds a custom layer:

- `ProductVariationController` reads `ProductFormatPricing__c`
- PDP format tabs and tier pricing are therefore local customization, not standard Commerce variation behavior

That means a bug in variation display, quantity rules, or tier pricing may not be a Salesforce platform bug at all. It may be a mismatch between:

1. standard Commerce product/pricing payloads
2. `purchaseQuantityRule` from Commerce APIs
3. custom `ProductFormatPricing__c` records

### 4. Checkout may be outside the standard LWR customization path

Salesforce's current docs emphasize checkout component hierarchy, checkout communication, and payment integration containers for LWR stores.

This repo currently has:

- a custom `checkoutFlow` component
- a custom `authorizeNetCheckoutButton` component
- direct checkout REST calls to `checkouts` and `checkouts/active`
- a separate hosted payment token flow through Apex

That can work, but it means checkout bugs may come from lifecycle/state assumptions that differ from the documented checkout container model.

### 5. Performance and consistency are probably being hurt by repeated client-side fetching

The storefront performs many separate fetches for products, pricing, search, and cart state in multiple custom LWCs. Even when each call is valid, this increases the chance of inconsistent state and race conditions.

The performance guide is directly relevant because this storefront does a lot of repeated network work in:

- search/listing components
- product detail components
- related product components
- cart/checkout helpers

## Most important repo-level observations

### Product detail page

The PDP reads core product data from Commerce product/pricing endpoints and quantity rules from `purchaseQuantityRule`, but variation tabs and tier prices come from Apex backed by `ProductFormatPricing__c`.

Implication: if quantity, price, or variation behavior looks inconsistent, the first question is whether the standard Commerce payload and the custom pricing overlay agree.

### Add-to-cart behavior

The shared helper first tries `commerce/cartApi` and then falls back to a manual REST call.

Implication: if add-to-cart works in one context and fails in another, verify whether the component used the supported client API path or the fallback REST path.

### Checkout and payment

The current Authorize.Net flow fetches cart details, clears `checkouts/active`, creates a new checkout, then posts to the hosted Authorize.Net form.

Implication: if checkout state keeps breaking, the first thing to validate is whether this flow matches Salesforce's expected checkout lifecycle for LWR stores.

## Recommended study order

If we want to actually get better at debugging this storefront, the study order should be:

1. Read the B2B Commerce Get Started guide.
2. Read the B2B Commerce Data Model guide with special attention to product/catalog, pricing, search, cart, and store data model sections.
3. Read the B2B Commerce APIs overview, then the cart, checkout, pricing/promotions, and product/category API sections.
4. Read the Storefront APIs guide for custom LWCs.
5. Read the LWR checkout customization guide and payment integration docs.
6. Read the storefront performance best practices guide.

## Practical debugging rules going forward

1. Treat direct `webruntime` REST usage as a compatibility risk and verify it against the current docs before changing behavior.
2. Separate standard Commerce behavior from custom ABC behavior before debugging. `ProductFormatPricing__c` is ABC behavior, not platform behavior.
3. For checkout bugs, verify documented LWR checkout lifecycle assumptions before changing token/payment code.
4. For product issues, compare the Commerce product payload, Commerce pricing payload, `purchaseQuantityRule`, and `ProductFormatPricing__c` side by side.
5. Prefer one shared abstraction per Commerce capability instead of each component building its own endpoint logic.

## Best next investigation targets

1. Audit every direct Commerce REST call and classify whether there is a supported Storefront API or Commerce client API equivalent.
2. Validate guest versus authenticated request behavior for every custom fetch that appends `asGuest=true`.
3. Review checkout state assumptions against the current LWR checkout docs before further changes to Authorize.Net flow.
4. Document the exact contract between `purchaseQuantityRule` and `ProductFormatPricing__c` so quantity bugs can be tested deterministically.