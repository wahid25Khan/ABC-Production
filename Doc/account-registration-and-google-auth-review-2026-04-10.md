# Account Registration And Google Auth Review

Date: 2026-04-10

## Scope

This note documents the current account creation flow for:

1. Email and password self-registration
2. Google social sign-up and sign-in

The goal is to stop treating all "sign up" issues as one feature. The codebase currently has two separate provisioning paths with overlapping but different behavior.

## Live site review: americanbookcompany.com

The customer-facing live domain is not serving the Salesforce Experience Cloud LWC directly.

The live site is a Nuxt frontend that talks to a separate backend stack.

### What the live site is running

1. The live pages at `/create-account/` and `/login/` are Nuxt-rendered pages on `https://americanbookcompany.com`.
2. Runtime config exposed on the live login page points to:
   - `APP_URL=https://americanbookcompany.com`
   - `STATAMIC_HOST=https://cms.americanbookcompany.com`
   - `STATAMIC_API=https://cms.americanbookcompany.com/api`
3. The create-account page also loads Cloudflare Turnstile.

### Live create-account process

The live create-account page renders:

- Google button
- Microsoft button
- first name
- last name
- email
- confirm email
- organization name
- password
- confirm password
- marketing consent checkbox
- captcha token handling through Turnstile

The frontend bundle for the live create-account page shows this process:

1. Manual form submit posts to `STATAMIC_API + "/create-user"`.
2. The form payload includes:
   - `org_name`
   - `first_name`
   - `last_name`
   - `phone`
   - `email`
   - `email_confirmation`
   - `password`
   - `password_confirmation`
   - `consent_to_receive_email`
   - `token`
3. If the request succeeds, the frontend redirects to `/account`.

### Live social signup/login process

The frontend bundle for the live create-account page shows:

1. Clicking Google calls `GET https://cms.americanbookcompany.com/oauth/google/redirect-frontend`.
2. Clicking Microsoft calls `GET https://cms.americanbookcompany.com/oauth/microsoft/redirect-frontend`.
3. The browser is then redirected to `redirectURL` returned by that backend.

The live login bundle shows:

1. Email/password login posts to `STATAMIC_API + "/login"` with `email` and `password`.
2. Social login posts to `STATAMIC_HOST + "/oauth/{provider}/login"` with a `pid` value.
3. On success, the frontend updates its user store and redirects to `/account/details` or a provided return path.

### What this means for our Salesforce code review

This is the important conclusion:

The public live site process is not the same runtime as the Salesforce Experience Cloud registration code in this repo.

So if we are reviewing "what the customer live site is running related to AccountRegistrationService", the answer is:

1. The live public site is using a Nuxt frontend.
2. Registration and login are going through `cms.americanbookcompany.com` endpoints.
3. The Salesforce `BuyerSelfRegistrationService` and related LWCs appear to represent a separate Salesforce-based account system, not the current public-site runtime on `americanbookcompany.com`.

That does not mean the Salesforce code is unused everywhere. It means it is not what the public production domain is obviously executing for create-account and login today.

## Experience-domain runtime review: americanbookcompany.my.site.com/AmericanBookCompany

The Salesforce Experience domain does render the registration and login flow from this repo.

### What is live on the Experience domain

The following pages are live and match the Experience bundle:

1. `/AmericanBookCompany/create-account`
2. `/AmericanBookCompany/login`
3. `/AmericanBookCompany/myprofile`

The fetched page content confirms:

- `create-account` shows the custom registration form with Google and Microsoft buttons.
- `login` shows the custom login form with Google and Microsoft buttons.
- `myprofile` shows the login form when the user is not authenticated.

### Confirmed registration navigation on the Experience domain

The intended path from the registration form is:

1. User opens `/AmericanBookCompany/create-account`.
2. User submits the custom registration form.
3. `createAccountRegistration` posts credentials to `/AmericanBookCompany/login`.
4. The hidden form sends `startURL=/AmericanBookCompany/myprofile`.
5. Successful login should land the user on `/AmericanBookCompany/myprofile`.

### Confirmed social navigation on the Experience domain

The intended social path is:

1. User opens `/AmericanBookCompany/create-account`.
2. User clicks Google or Microsoft.
3. The auth request uses `/services/auth/sso/{Provider}` with:
   - `site=https://americanbookcompany.my.site.com/AmericanBookCompanyvforcesite`
   - `startURL=/AmericanBookCompany/myprofile`
4. Successful social auth should also land the user on `/AmericanBookCompany/myprofile`.

### Concrete issue found on the live Experience login flow

There is a real routing bug in the login form component.

`accountLoginFormPopupFlow.html` renders these links directly:

- `href={forgotPasswordUrl}`
- `href={selfRegisterUrl}`

The configured values are:

- `forgotPasswordUrl = /ForgotPassword`
- `selfRegisterUrl = /create-account`

Because those are rendered directly as root-relative links, the live page currently points users to:

- `https://americanbookcompany.my.site.com/ForgotPassword`
- `https://americanbookcompany.my.site.com/create-account`

instead of the Experience-base-path versions:

- `https://americanbookcompany.my.site.com/AmericanBookCompany/ForgotPassword`
- `https://americanbookcompany.my.site.com/AmericanBookCompany/create-account`

This explains why unauthenticated users on `/AmericanBookCompany/myprofile` or `/AmericanBookCompany/login` can be pushed to the wrong path when they click `Create Account` or `Forgot your password?`.

### What this means for issue closure

For the Salesforce Experience site, the process itself is consistent:

1. Create account page
2. Login endpoint
3. Redirect to `myprofile`

But the login page's fallback navigation links are not base-path-safe, which is a real bug and a plausible cause of the account-registration navigation issue.

## Primary entry points

### Email and password registration

- LWC: `force-app/main/default/lwc/createAccountRegistration/createAccountRegistration.js`
- Apex service: `force-app/main/default/classes/BuyerSelfRegistrationService.cls`

### Google social sign-up

- LWC social trigger: `force-app/main/default/lwc/createAccountRegistration/createAccountRegistration.js`
- Login component social trigger: `force-app/main/default/lwc/accountLoginFormPopupFlow/accountLoginFormPopupFlow.js`
- Auth Provider metadata: `force-app/main/default/authproviders/Google_Login.authprovider-meta.xml`
- Registration handler: `force-app/main/default/classes/AutocreatedRegHandler1772220667704.cls`

## Current email/password registration flow

### Browser flow

1. The create-account page renders `createAccountRegistration`.
2. The user enters first name, last name, email, confirm email, organization name, password, confirm password, and optional marketing consent.
3. The LWC validates fields client-side.
4. The LWC calls `BuyerSelfRegistrationService.registerBuyer`.
5. If registration succeeds, the LWC auto-posts a login form to `/AmericanBookCompany/login` and sends the user to the returned redirect URL or `/myprofile`.

### Exact navigation path from `createAccountRegistration`

For the Salesforce Experience implementation in this repo, the post-registration navigation is:

1. User starts on `/AmericanBookCompany/create-account`.
2. Manual submit calls Apex registration.
3. On success, the component posts credentials to `/AmericanBookCompany/login`.
4. The hidden form includes `startURL=/AmericanBookCompany/myprofile`.
5. After successful login, the user is expected to land on `/AmericanBookCompany/myprofile`.

That target route exists in the Experience bundle:

- Route: `myprofile`
- Route type: `my-profile`
- View: `my_profile`
- Main component: `c:accountDetailsPage`

### Exact navigation path for social signup from `createAccountRegistration`

For Google or Microsoft from the same Salesforce Experience implementation:

1. User starts on `/AmericanBookCompany/create-account`.
2. Clicking a social button opens `/services/auth/sso/{Provider}`.
3. The auth URL is augmented with:
   - `site=https://americanbookcompany.my.site.com/AmericanBookCompanyvforcesite`
   - `startURL=/AmericanBookCompany/myprofile`
4. After social auth completes, the popup monitor redirects the parent page to the completion URL.
5. The intended post-auth destination is again `/AmericanBookCompany/myprofile`, unless the provider flow returns an error and falls back to the login page.

### Exact navigation path from the login page

The Experience login page is configured with:

- `selfRegisterUrl=/create-account`
- `defaultStartUrl=/myprofile`
- `loginActionUrl=/AmericanBookCompany/login`

So the intended navigation from login is:

1. Guest user opens `/AmericanBookCompany/login`.
2. Clicking `Create Account` navigates to `/AmericanBookCompany/create-account`.
3. A successful login or social login should end at `/AmericanBookCompany/myprofile`.

### Server flow

`BuyerSelfRegistrationService.registerBuyer` does the following:

1. Validates the request payload.
2. Blocks registration if any existing `User` already has the same username or email.
3. Creates a new `Account` using `organizationName` as the account name.
4. Ensures a `BuyerAccount` record exists and is active.
5. Calls `Site.createExternalUser` with the shopper profile and the submitted password.
6. Updates the created contact's `HasOptedOutOfEmail` according to `marketingConsent`.
7. Ensures membership in the default buyer group.
8. Ensures B2B buyer permission set license and permission set assignment.
9. Returns success with redirect `/myprofile`.

### Important behavior

- Manual registration uses the raw normalized email as both `Username` and `Email`.
- Manual registration requires organization name.
- Manual registration respects marketing consent.

## Current Google sign-up flow

### Browser flow

1. The create-account page offers a Google button.
2. Clicking Google opens `/services/auth/sso/Google_Login`.
3. The component appends two important query parameters:
   - `site=https://americanbookcompany.my.site.com/AmericanBookCompanyvforcesite`
   - `startURL=/AmericanBookCompany/myprofile`
4. The popup monitor waits until the auth flow returns to a same-origin page that is no longer under `/services/auth/`.
5. The parent page then redirects to the popup completion URL.

### Provider configuration

The Google Auth Provider is configured as:

- Provider type: Google
- PKCE enabled: true
- Registration handler: `AutocreatedRegHandler1772220667704`

### Server flow

`AutocreatedRegHandler1772220667704` does the following:

1. `canCreateUser` allows sign-up only when the identity has an email and there is no conflicting internal-only user.
2. `createUser` checks whether a matching active user already exists.
3. If an existing external user already exists, it reuses that user and re-applies buyer access and entitlements.
4. If no user exists, it creates a new `Account` using a derived organization name.
5. It creates the external community user with `Site.createExternalUser(..., null)` because the social provider handles authentication.
6. It ensures buyer group membership.
7. It enqueues B2B buyer entitlement assignment asynchronously.

### Important behavior

- Social sign-up does not collect organization name from the user.
- Organization name is inferred from hosted domain, then email domain, then user name.
- Social sign-up sets `HasOptedOutOfEmail = true` and does not collect marketing consent.
- Social sign-up uses a generated external username with an `+abcshop-<orgId>` suffix instead of raw email.

## Experience Cloud configuration that matters

The current network metadata shows:

- Self-registration is enabled.
- Self-registration profile is `American Book Company Shopper Profile`.
- Registration does not require auth.
- Headless user registration is disabled.
- The site/network URL path prefix used for auth-site routing is `AmericanBookCompanyvforcesite`.

This means the storefront currently operates with two related paths:

1. Experience/LWR user-facing path: `/AmericanBookCompany/...`
2. Site/auth path used in social login wiring: `/AmericanBookCompanyvforcesite`

That looks intentional in the metadata, even though it is easy to mistake for a mismatch.

## Key differences between the two signup systems

### 1. Buyer provisioning is duplicated

There are two separate buyer-provisioning implementations:

- `BuyerSelfRegistrationService`
- `AutocreatedRegHandler1772220667704`

They perform similar work, but not identically.

### 2. Consent handling is inconsistent

- Manual registration captures marketing consent.
- Google sign-up always opts the contact out of email and never asks for consent.

### 3. Existing-user behavior is inconsistent

- Manual registration blocks any matching `User` record by username or email.
- Google sign-up looks up active users and may reuse an existing external user.

### 4. Account naming is inconsistent

- Manual registration uses the submitted organization name.
- Google sign-up derives account name heuristically from domain or name.

### 5. Username strategy is inconsistent

- Manual registration uses normalized email as username.
- Google sign-up generates a suffixed username to avoid collisions.

### 6. Social UX is inconsistent across pages

- `createAccountRegistration` uses popup-based social auth.
- `accountLoginFormPopupFlow` uses full-page redirect for social auth.

## Likely review targets and risks

### Highest risk

1. Divergent business rules between manual registration and Google registration.
2. Duplicate buyer provisioning logic that can drift over time.
3. Existing-user collision handling that may produce different outcomes for the same email depending on path.

### Medium risk

1. The social sign-up path does not capture organization name or marketing consent.
2. Derived organization names may be weak or misleading for consumer-domain emails.
3. Entitlements are synchronous in one path and async in another.

### Low to medium risk

`GoogleSocialLoginRedirectController` and `GoogleSocialLoginRedirect.page` appear legacy. The current LWC flow points directly at `/services/auth/sso/Google_Login` and not at the Visualforce redirect page.

## Recommended next checks

1. Test a first-time Google signup in the org and inspect the created `Account`, `User`, `BuyerAccount`, `BuyerGroupMember`, `PermissionSetAssignment`, and `PermissionSetLicenseAssign` records.
2. Decide the intended product policy for an email that already exists on an internal Salesforce user.
3. Decide whether Google signup should collect organization name and marketing consent before or after auth.
4. Refactor both signup paths to share one buyer-provisioning service if we want consistent behavior.
5. Decide whether popup-based social auth or full-page redirect should be the single supported UX.

## Files worth opening first next time

- `force-app/main/default/lwc/createAccountRegistration/createAccountRegistration.js`
- `force-app/main/default/classes/BuyerSelfRegistrationService.cls`
- `force-app/main/default/lwc/accountLoginFormPopupFlow/accountLoginFormPopupFlow.js`
- `force-app/main/default/authproviders/Google_Login.authprovider-meta.xml`
- `force-app/main/default/classes/AutocreatedRegHandler1772220667704.cls`
- `force-app/main/default/networks/American Book Company.network-meta.xml`