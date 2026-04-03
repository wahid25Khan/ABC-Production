import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import isGuest from '@salesforce/user/isGuest';

export default class CheckoutLoginGate extends NavigationMixin(LightningElement) {
    rememberedEmailStorageKey = 'abc_checkout_remembered_email';
    checkoutStageStorageKey = 'abc_checkout_stage';
    checkoutStageStyleId = 'abc-checkout-gate-stage-style';

    @api cartUrl = '/cart';
    @api checkoutUrl = '/checkout';
    @api createAccountUrl = '/create-account';
    @api forgotPasswordUrl = '/ForgotPassword'; // NOSONAR — URL path, not a credential

    email = '';
    password = '';
    rememberMe = false;
    loginError = '';
    isLoggingIn = false;

    get isAuthenticated() {
        return !isGuest;
    }

    get isGateOnlyStage() {
        return !this.isAuthenticated && this.getCheckoutStage() !== 'details';
    }

    connectedCallback() {
        this.ensureCheckoutStageStyles();

        if (this.isAuthenticated) {
            this.setCheckoutStage('details');
            this.redirectToCheckout();
            return;
        }

        this.restoreRememberedEmail();
        this.syncCheckoutStageView();
    }

    renderedCallback() {
        this.syncCheckoutStageView();
        this.normalizeDetailsStageView();
    }

    handleEmailChange(e) {
        this.email = e.target.value;
        this.loginError = '';
    }

    handlePasswordChange(e) {
        this.password = e.target.value;
        this.loginError = '';
    }

    handleRememberMeChange(e) {
        this.rememberMe = e.target.checked;

        if (!this.rememberMe) {
            this.clearRememberedEmail();
        }
    }

    handlePasswordKeydown(e) {
        if (e.key === 'Enter') {
            this.handleSignIn();
        }
    }

    async handleSignIn() {
        if (!this.email.trim()) {
            this.loginError = 'Please enter your email address.';
            return;
        }
        if (!this.password) {
            this.loginError = 'Please enter your password.';
            return;
        }

        this.isLoggingIn = true;
        this.loginError = '';

        if (this.rememberMe) {
            this.storeRememberedEmail(this.email.trim());
        } else {
            this.clearRememberedEmail();
        }

        this.setCheckoutStage('details');
        this.dispatchCheckoutStageChange('details');

        try {
            // C4 fix: Use a POST form to submit credentials instead of putting
            // the email in the URL query string (which exposes it in browser
            // history, server logs, and proxy logs).
            const ownerDocument = this.template.host.ownerDocument;
            const form = ownerDocument.createElement('form');
            form.method = 'POST';
            form.action = '/AmericanBookCompany/login';

            const usernameInput = ownerDocument.createElement('input');
            usernameInput.type = 'hidden';
            usernameInput.name = 'username';
            usernameInput.value = this.email.trim();

            const passwordInput = ownerDocument.createElement('input');
            passwordInput.type = 'hidden'; // NOSONAR — required hidden form field for submitted credentials
            passwordInput.name = 'password'; // NOSONAR — standard backend field name, not a hard-coded credential
            passwordInput.value = this.password;

            const startUrlInput = ownerDocument.createElement('input');
            startUrlInput.type = 'hidden';
            startUrlInput.name = 'startURL';
            startUrlInput.value = this.checkoutUrl;

            form.appendChild(usernameInput);
            form.appendChild(passwordInput);
            form.appendChild(startUrlInput);
            ownerDocument.body.appendChild(form);
            form.submit();
        } catch (error) {
            // N3 fix: Remove the form from DOM on error to prevent credential leakage
            const ownerDocument = this.template.host.ownerDocument;
            const staleForms = ownerDocument.body.getElementsByTagName('form');
            for (const staleForm of staleForms) {
                if (staleForm.action?.endsWith('/AmericanBookCompany/login')) {
                    staleForm.remove();
                }
            }
            console.warn('Sign-in navigation failed.', error);
            this.loginError = 'Unable to sign in. Please check your credentials and try again.';
            this.isLoggingIn = false;
        }
    }

    handleGuestCheckout() {
        this.setCheckoutStage('details');
        this.dispatchCheckoutStageChange('details');
        this.syncCheckoutStageView();
        this.scrollToCheckoutContactSection();
    }

    redirectToCheckout() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: this.checkoutUrl
            }
        });
    }

    restoreRememberedEmail() {
        try {
            const savedEmail = globalThis.localStorage?.getItem(this.rememberedEmailStorageKey);
            if (savedEmail) {
                this.email = savedEmail;
                this.rememberMe = true;
            }
        } catch (error) {
            console.warn('Unable to restore remembered checkout email.', error);
        }
    }

    getCheckoutStage() {
        try {
            return globalThis.sessionStorage?.getItem(this.checkoutStageStorageKey) || 'gate';
        } catch (error) {
            console.warn('Unable to read checkout stage.', error);
            return 'gate';
        }
    }

    setCheckoutStage(stage) {
        try {
            globalThis.sessionStorage?.setItem(this.checkoutStageStorageKey, stage);
        } catch (error) {
            console.warn('Unable to store checkout stage.', error);
        }
    }

    dispatchCheckoutStageChange(stage) {
        globalThis.dispatchEvent(
            new CustomEvent('abccheckoutstagechange', {
                detail: { stage }
            })
        );
    }

    ensureCheckoutStageStyles() {
        const ownerDocument = this.template.host.ownerDocument;
        if (ownerDocument.getElementById(this.checkoutStageStyleId)) {
            return;
        }

        const styleTag = ownerDocument.createElement('style');
        styleTag.id = this.checkoutStageStyleId;
        styleTag.textContent = `
            .abc-checkout-gate-only {
                align-items: flex-start !important;
            }

            .abc-checkout-gate-only > community_layout-column:first-child {
                flex: 0 0 100% !important;
                max-width: 100% !important;
                width: 100% !important;
            }

            .abc-checkout-gate-only > community_layout-column:last-child {
                display: none !important;
            }

            .abc-checkout-gate-only > community_layout-column:first-child > .column-content > commerce_builder-checkout-notification,
            .abc-checkout-gate-only > community_layout-column:first-child > .column-content > commerce_builder-payment-by-express,
            .abc-checkout-gate-only > community_layout-column:first-child > .column-content > commerce_data_provider-cart-data-provider {
                display: none !important;
            }
        `;

        ownerDocument.head.appendChild(styleTag);
    }

    syncCheckoutStageView() {
        const columnsContent = this.getCheckoutColumnsContent();
        if (!columnsContent) {
            return;
        }

        this.template.host.style.display = this.isGateOnlyStage ? '' : 'none';
        columnsContent.classList.toggle('abc-checkout-gate-only', this.isGateOnlyStage);
    }

    normalizeDetailsStageView() {
        const ownerDocument = this.template.host.ownerDocument;

        this.toggleEmptyShippingMethodSection(ownerDocument);
        this.syncSummaryExtras(ownerDocument);
    }

    toggleEmptyShippingMethodSection(ownerDocument) {
        const deliverySection = ownerDocument.querySelector(
            'commerce_unified_checkout-checkout-section-delivery'
        );

        if (!(deliverySection instanceof HTMLElement)) {
            return;
        }

        const sectionText = (deliverySection.textContent || '').trim();
        const hasShippingChoices = !!deliverySection.querySelector(
            'input[type="radio"], select, [role="radio"]'
        );

        deliverySection.style.display =
            !hasShippingChoices && sectionText.includes('Enter an address to see shipping method options')
                ? 'none'
                : '';
    }

    syncSummaryExtras(ownerDocument) {
        const itemsHeading = Array.from(ownerDocument.querySelectorAll('h2')).find((heading) =>
            heading.textContent?.trim().startsWith('Items in order')
        );
        const itemsHeadingBlock = itemsHeading?.closest('dxp_base-text-block') || itemsHeading?.parentElement;
        const itemsContainer = itemsHeadingBlock?.parentElement;

        if (!(itemsContainer instanceof HTMLElement) || !(itemsHeadingBlock instanceof HTMLElement)) {
            return;
        }

        let extras = ownerDocument.getElementById('abc-checkout-summary-extras');
        if (!extras) {
            extras = this.createSummaryExtras(ownerDocument);
            itemsHeadingBlock.before(extras);
        }

        const realPlaceOrderButton = Array.from(ownerDocument.querySelectorAll('button')).find(
            (button) =>
                button.textContent?.trim() === 'Place Order' &&
                button.id !== 'abc-checkout-place-order-placeholder' &&
                this.isVisible(button)
        );

        extras.style.display = realPlaceOrderButton ? 'none' : 'block';
    }

    createSummaryExtras(ownerDocument) {
        this.ensureSummaryExtrasStyles(ownerDocument);

        const extras = ownerDocument.createElement('div');
        extras.id = 'abc-checkout-summary-extras';

        const shippingHelpButton = ownerDocument.createElement('button');
        shippingHelpButton.type = 'button';
        shippingHelpButton.className = 'abc-checkout-summary-help';
        shippingHelpButton.textContent = 'How are shipping rates calculated?';
        shippingHelpButton.setAttribute('aria-expanded', 'false');

        const shippingHelpCopy = ownerDocument.createElement('p');
        shippingHelpCopy.className = 'abc-checkout-summary-help-copy';
        shippingHelpCopy.hidden = true;
        shippingHelpCopy.textContent =
            'Shipping rates are calculated after the shipping address is entered and delivery options are returned.';

        shippingHelpButton.addEventListener('click', () => {
            shippingHelpCopy.hidden = !shippingHelpCopy.hidden;
            shippingHelpButton.setAttribute(
                'aria-expanded',
                shippingHelpCopy.hidden ? 'false' : 'true'
            );
        });

        const placeOrderButton = ownerDocument.createElement('button');
        placeOrderButton.id = 'abc-checkout-place-order-placeholder';
        placeOrderButton.type = 'button';
        placeOrderButton.className = 'abc-checkout-summary-place-order';
        placeOrderButton.textContent = 'Place Order';
        placeOrderButton.disabled = true;

        extras.appendChild(shippingHelpButton);
        extras.appendChild(shippingHelpCopy);
        extras.appendChild(placeOrderButton);

        return extras;
    }

    ensureSummaryExtrasStyles(ownerDocument) {
        if (ownerDocument.getElementById('abc-checkout-summary-extras-style')) {
            return;
        }

        const styleTag = ownerDocument.createElement('style');
        styleTag.id = 'abc-checkout-summary-extras-style';
        styleTag.textContent = `
            #abc-checkout-summary-extras {
                margin: 0.75rem 0 1.5rem;
            }

            .abc-checkout-summary-help {
                padding: 0;
                border: 0;
                background: transparent;
                color: #2e609c;
                font-size: 0.95rem;
                line-height: 1.4;
                text-decoration: underline;
                cursor: pointer;
            }

            .abc-checkout-summary-help-copy {
                margin: 0.5rem 0 1rem;
                color: #475569;
                font-size: 0.9rem;
                line-height: 1.5;
            }

            .abc-checkout-summary-place-order {
                width: 100%;
                min-height: 3rem;
                padding: 0.875rem 1.5rem;
                border: 0;
                border-radius: 9999px;
                background: #cbd5e1;
                color: #ffffff;
                font-size: 1rem;
                font-weight: 700;
                cursor: not-allowed;
                opacity: 1;
            }
        `;

        ownerDocument.head.appendChild(styleTag);
    }

    isVisible(element) {
        if (!(element instanceof HTMLElement)) {
            return false;
        }

        const rect = element.getBoundingClientRect();
        const computedStyle = globalThis.getComputedStyle(element);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            computedStyle.display !== 'none' &&
            computedStyle.visibility !== 'hidden'
        );
    }

    getCheckoutColumnsContent() {
        return this.template.host.parentElement?.parentElement?.parentElement || null;
    }

    storeRememberedEmail(emailAddress) {
        try {
            globalThis.localStorage?.setItem(this.rememberedEmailStorageKey, emailAddress);
        } catch (error) {
            console.warn('Unable to store remembered checkout email.', error);
        }
    }

    clearRememberedEmail() {
        try {
            globalThis.localStorage?.removeItem(this.rememberedEmailStorageKey);
        } catch (error) {
            console.warn('Unable to clear remembered checkout email.', error);
        }
    }

    scrollToCheckoutContactSection() {
        const host = this.template.host;
        let target = host.nextElementSibling;

        while (target && !target.tagName?.toLowerCase().includes('checkout')) {
            target = target.nextElementSibling;
        }

        if (target instanceof HTMLElement) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}