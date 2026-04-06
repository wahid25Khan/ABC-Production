# Experience Page Parity Review — 2026-04-04

Base live site used for comparison: `https://americanbookcompany.my.site.com/AmericanBookCompany`

Authenticated review used the provided customer account login on 2026-04-04.

## Shop All

- Repo route/view: `global-search` via `Search` route and `global_search` view.
- Expected from repo: public search page using `c:customResults` with heading `Shop All`.
- Live page checked: `/global-search/all`
- Result: matches.

Notes:
- The live page renders the expected `Shop All` heading, search/filter controls, product grid, and product count.
- No parity issue found in the guest session review.

## Account Details

- Repo route/view: `my-profile` via `My_Profile` route and `my_profile` view.
- Expected from repo: account details page powered by `c:accountDetailsPage`; guest users are redirected to login.
- Live page checked: `/myprofile`
- Result: core page matches after sign-in, secondary issue found.

Issues:
- Guest navigation to `/myprofile` lands on the login page with an error banner: `Unable to sign in. Please check your credentials and try again.` This is a misleading failure state for a normal protected-page redirect.
- After sign-in, the page does render the expected `Account Details` experience with About You, Password & Security, Organization, Shipping, and Payment sections.
- The signed-in page still logs a `400` during load, even though the main content renders.
- The shared My Account footer/navigation is inconsistent with the rest of the storefront on signed-in account pages. It shows a different menu set and the `My Account` footer link points to `/AmericanBookCompany/login` instead of the current account page.

## My Orders

- Repo route/view: `custom-my-orders` via `My_Orders__c` route and `My_Orders` view.
- Expected from repo: orders page with `c:accountPageLoginRedirect` plus commerce order list UI; guests should be redirected to login.
- Live page checked: `/my-orders`
- Result: issue found.

Issues:
- The visible result is a login page, which is directionally correct, but the browser session also showed failed requests before redirect completed, including a `400` response and aborted commerce requests for order summaries/cart data.
- This indicates the page is starting protected commerce data work before guest redirect fully settles.
- The route also uses `pageAccess: UseParent`, so the protection model is again runtime redirect rather than hard route gating.
- After sign-in, the page still does not work correctly. Instead of showing the account's orders or the configured empty state, it shows `Something went wrong` with `Please try again, or contact us for assistance.`
- The live session shows `400` failures tied to the commerce order summaries request, so this is not just a missing-order case; the page is failing to load its data.

## My Wishlist

- Repo route/view: `custom-mylists` via `My_Wishlist__c` route and `My_Wishlist` view.
- Expected from repo: wishlist page with `c:accountPageLoginRedirect` plus wishlist commerce UI; guests should be redirected to login.
- Live page checked: `/mylists`
- Result: issue found.

Issues:
- The visible result is a login page, but the live session showed a `401 INSUFFICIENT_ACCESS` response before redirect completed.
- As with My Orders, protected wishlist data is being requested during guest access instead of being fully blocked before commerce calls fire.
- The route uses `pageAccess: UseParent`, which contributes to the page relying on client-side redirect behavior.
- After sign-in, the page still fails. It remains stuck in a loading state and logs `400 INVALID_API_INPUT` with `This feature is not currently enabled for this user.`
- This is a stronger failure than a simple empty wishlist; the feature appears unavailable for the logged-in buyer/account context.
- The signed-in My Wishlist page also uses the same inconsistent My Account footer/navigation pattern as Account Details, with mixed-domain links.

## Submit a PO

- Repo route/view: `custom-submit-a-po` via `Submitpurchaseorder__c` route and `Submit_purchase_order` view.
- Expected from repo: public page rendering `c:submitPurchaseOrderForm`.
- Live page checked: `/submit-a-po`
- Result: mostly matches, one UX issue found.

Issues:
- The Organization Details section includes an unlabeled extra text input between `Street` and `City`. This is not a live-only regression; the template includes the `street2` input without a label or placeholder, so the current live output is confusing for users.

## Summary

- No parity issue found: Shop All
- Live issues found: Account Details, My Orders, My Wishlist, Submit a PO
- Main pattern on protected account pages: guest users are redirected, but the live experience is not clean because error states or protected-data requests appear before redirect completes.
- Main authenticated findings: Account Details renders, My Orders hard-fails with a generic error, and My Wishlist hard-fails with a feature-enable error for the logged-in user.