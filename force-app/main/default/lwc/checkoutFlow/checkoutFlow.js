import { LightningElement, api, track, wire } from 'lwc';
import isGuestUser from '@salesforce/user/isGuest';
import getShippingRatePercent from '@salesforce/apex/ABCShippingCalculator.getShippingRatePercent';
import getHostedPaymentToken from '@salesforce/apex/AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken';
import { splitCartItemName } from 'c/utils';
import CC_VISA from '@salesforce/resourceUrl/ccVisa';
import CC_MASTERCARD from '@salesforce/resourceUrl/ccMastercard';
import CC_AMEX from '@salesforce/resourceUrl/ccAmex';
import CC_DISCOVER from '@salesforce/resourceUrl/ccDiscover';

const FORM_KEY = 'abc_checkout_flow_form';
const CHECKOUT_SESSION_KEY = 'abc_checkout_session';
const API_VERSION = 'v66.0';
const WEBSTORE_ID = '0ZEam000004dJDNGA2';
const PAYMENT_FORM_SANDBOX = 'https://test.authorize.net/payment/payment';
const PAYMENT_FORM_PROD = 'https://accept.authorize.net/payment/payment';

const US_STATES = [
    { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
    { value: 'DC', label: 'District of Columbia' }
];

export default class CheckoutFlow extends LightningElement {
    @api cartUrl = '/cart';
    @api signInUrl = '/login';

    @track form = {
        contactName: '',
        contactEmail: '',
        contactEmailConfirm: '',
        contactPhone: '',
        shipName: '',
        orgName: '',
        street: '',
        city: '',
        stateCode: '',
        postalCode: '',
        useToCreateAccount: false,
        paymentType: '',
        cardNumber: '',
        cardholderName: '',
        cardExpMonth: '',
        cardExpYear: '',
        cardCvv: '',
        billingUseShipping: true,
        billingStreet: '',
        billingCity: '',
        billingStateCode: '',
        billingZip: '',
        saveCard: false,
        setDefaultPayment: false,
        achAccountHolder: '',
        achRoutingNumber: '',
        achAccountNumber: '',
        achAccountNumberConfirm: '',
        achAccountType: '',
        achBankName: '',
        saveAch: false,
        setDefaultAchPayment: false,
        poNumber: '',
        poContact: '',
        poEmail: ''
    };

    @track stepError = '';
    @track contactEmailError = '';
    @track isPlacingOrder = false;
    @track isLoadingShipping = false;
    @track summaryLoading = false;
    @track summaryItems = [];
    @track subtotal = 0;
    @track shippingCost = 0;
    @track tax = 0;
    @track showShippingHelp = false;
    @track showShippingModal = false;
    @track showErrorModal = false;
    @track placeOrderErrorMsg = '';

    currentStep = 1;
    completedStep1 = false;
    completedStep2 = false;
    shippingRatePercent = 0;

    // ── Lifecycle ────────────────────────────────────────────────
    connectedCallback() {
        this.currentStep = this._readStepFromUrl();
        this._restoreForm();
        this._loadSummaryFromCart();
        this._handlePaymentReturn();
    }

    @wire(getShippingRatePercent)
    wiredShippingRate({ data }) {
        if (data != null) {
            this.shippingRatePercent = data;
            this._recalcShipping();
        }
    }

    // ── URL helpers ──────────────────────────────────────────────
    _readStepFromUrl() {
        try {
            const match = globalThis.location?.pathname?.match(/\/checkout\/step\/(\d+)/);
            const n = match ? parseInt(match[1], 10) : 1;
            return n >= 1 && n <= 3 ? n : 1;
        } catch {
            return 1;
        }
    }

    _navigateToStep(step) {
        try {
            const base = globalThis.location?.pathname?.replace(/\/checkout\/step\/\d+/, '') ?? '';
            globalThis.history?.pushState({}, '', `${base}/checkout/step/${step}`);
        } catch {
            /* non-browser context */
        }
        this.currentStep = step;
        this.stepError = '';
        this.contactEmailError = '';
        this._scrollToTop();
    }

    _scrollToTop() {
        try {
            globalThis.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            /* noop */
        }
    }

    // ── Form persistence ─────────────────────────────────────────
    _persistForm() {
        try {
            // SECURITY: Never persist sensitive payment data to sessionStorage.
            // CVV, PANs, ACH account/routing numbers must not be stored outside
            // the component's reactive state. Only safe, non-payment fields are saved.
            const {
                cardNumber,      // PAN — never store
                cardCvv,         // CVV — PCI DSS violation to store anywhere
                achRoutingNumber,
                achAccountNumber,
                achAccountNumberConfirm,
                ...safeToPersist
            } = this.form;
            globalThis.sessionStorage?.setItem(FORM_KEY, JSON.stringify(safeToPersist));
        } catch {
            /* noop */
        }
    }

    _restoreForm() {
        try {
            const raw = globalThis.sessionStorage?.getItem(FORM_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                this.form = { ...this.form, ...saved };
                if (saved._completedStep1) {
                    this.completedStep1 = true;
                }
                if (saved._completedStep2) {
                    this.completedStep2 = true;
                }
            }
        } catch {
            /* noop */
        }
    }

    // ── Cart summary ─────────────────────────────────────────────
    _loadSummaryFromCart() {
        try {
            const CART_KEY = 'abc_custom_cart_page_cache_v1';
            let raw = globalThis.sessionStorage?.getItem(CART_KEY);

            if (!raw) {
                const legacyKey = 'abc_cart_page_cache';
                raw = globalThis.sessionStorage?.getItem(legacyKey);
            }
            if (!raw) return;

            const cached = JSON.parse(raw);
            const items = cached?.items ?? [];
            const summary = cached?.summary ?? {};

            this.summaryItems = items.map((item) => {
                const nameInfo = splitCartItemName(item.productName ?? item.name ?? 'Product');
                const formatLabel = (item.formatLabel ?? nameInfo.formatLabel ?? '').toLowerCase();
                const hasDigital = formatLabel.includes('digital') || formatLabel.includes('ebook') || formatLabel.includes('coursewave');
                const hasColorPrint = formatLabel.includes('color');
                const hasBwPrint = formatLabel.includes('b&w') || formatLabel.includes('black');

                return {
                    id: item.id,
                    name: nameInfo.baseName || (item.productName ?? item.name ?? 'Product'),
                    imageUrl: item.imageUrl ?? '',
                    detailUrl: item.detailPath ?? '#',
                    quantity: item.quantity ?? 1,
                    totalLabel: this._formatCurrency((item.unitPrice ?? 0) * (item.quantity ?? 1)),
                    hasDigital,
                    hasColorPrint,
                    hasBwPrint
                };
            });

            this.subtotal = summary?.subtotal ?? 0;
            this._recalcShipping();
        } catch {
            /* summary is display-only */
        }
    }

    _recalcShipping() {
        if (this.subtotal > 0 && this.shippingRatePercent > 0) {
            this.shippingCost = (this.subtotal * this.shippingRatePercent) / 100;
        }
    }

    // ── Getters: step visibility ─────────────────────────────────
    get isGuest() {
        return isGuestUser;
    }

    get hasItems() {
        return this.summaryItems.length > 0;
    }

    get itemCount() {
        return this.summaryItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
    }

    get isStep1() {
        return this.currentStep === 1;
    }

    get isStep2() {
        return this.currentStep === 2;
    }

    get isStep3() {
        return this.currentStep === 3;
    }

    get showStep1SignIn() {
        return this.currentStep === 1 && this.isGuest;
    }

    get showStep1Edit() {
        return this.currentStep !== 1 && this.completedStep1;
    }

    get showStep1Summary() {
        return this.currentStep !== 1 && this.completedStep1;
    }

    get showStep2Edit() {
        return this.currentStep !== 2 && this.completedStep2;
    }

    get showStep2Summary() {
        return this.currentStep !== 2 && this.completedStep2;
    }

    get showStep3Edit() {
        return this.currentStep !== 3 && this.form.paymentType;
    }

    get showStep3Summary() {
        return this.currentStep !== 3 && this.form.paymentType;
    }

    get showPlaceOrderInline() {
        return this.isStep3 && !!this.form.paymentType;
    }

    get cityStateZip() {
        return `${this.form.city}, ${this.form.stateCode} ${this.form.postalCode}`;
    }

    // ── Getters: payment type ────────────────────────────────────
    get isCreditCard() {
        return this.form.paymentType === 'cc';
    }

    get isACH() {
        return this.form.paymentType === 'ach';
    }

    get isPurchaseOrder() {
        return this.form.paymentType === 'po';
    }

    get isAnyPaymentTypeSelected() {
        return !!this.form.paymentType;
    }

    get visaIcon() { return CC_VISA; }
    get mastercardIcon() { return CC_MASTERCARD; }
    get amexIcon() { return CC_AMEX; }
    get discoverIcon() { return CC_DISCOVER; }

    get cardLastFour() {
        const digits = (this.form.cardNumber || '').replace(/\D/g, '');
        return digits.length >= 4 ? digits.slice(-4) : '****';
    }

    get expirationMonths() {
        return Array.from({ length: 12 }, (_, i) => {
            const val = String(i + 1);
            return { value: val, label: val, selected: val === this.form.cardExpMonth };
        });
    }

    get expirationYears() {
        const startYear = new Date().getFullYear() - 1;
        return Array.from({ length: 20 }, (_, i) => {
            const val = String(startYear + i);
            return { value: val, label: val, selected: val === this.form.cardExpYear };
        });
    }

    get showBillingForm() {
        return !this.form.billingUseShipping;
    }

    get billingUseShippingChecked() {
        return this.form.billingUseShipping === true;
    }

    get billingUseDifferentChecked() {
        return this.form.billingUseShipping === false;
    }

    get shippingAddressDisplay() {
        const { street, city, stateCode, postalCode } = this.form;
        if (!street) return '';
        return `${street}, ${city}, ${stateCode} ${postalCode}`;
    }

    get billingStates() {
        return US_STATES.map(st => ({ ...st, selected: st.value === this.form.billingStateCode }));
    }

    get placeOrderDisabled() {
        return !this.form.paymentType || !this.completedStep1 || !this.completedStep2 || this.isPlacingOrder;
    }

    // ── Getters: summary ─────────────────────────────────────────
    get subtotalLabel() {
        return this._formatCurrency(this.subtotal);
    }

    get shippingLabel() {
        return this._formatCurrency(this.shippingCost);
    }

    get taxLabel() {
        return this._formatCurrency(this.tax);
    }

    get totalLabel() {
        return this._formatCurrency(this.subtotal + this.shippingCost + this.tax);
    }

    get usStates() {
        return US_STATES.map(st => ({ ...st, selected: st.value === this.form.stateCode }));
    }

    // ── Handlers: generic input ──────────────────────────────────
    handleInput(e) {
        const field = e.target.dataset.field;
        if (field) {
            this.form = { ...this.form, [field]: e.target.value };
            this._persistForm();
        }
    }

    handleStateChange(e) {
        this.form = { ...this.form, stateCode: e.target.value };
        this._persistForm();
    }

    handleZipChange() {
        this._persistForm();
    }

    handleCreateAccountToggle(e) {
        this.form = { ...this.form, useToCreateAccount: e.target.checked };
        this._persistForm();
    }

    handleBillingRadioChange(e) {
        this.form = { ...this.form, billingUseShipping: e.target.value === 'true' };
        this._persistForm();
    }

    handleSaveCardToggle(e) {
        this.form = { ...this.form, saveCard: e.target.checked };
        this._persistForm();
    }

    handleDefaultPaymentToggle(e) {
        this.form = { ...this.form, setDefaultPayment: e.target.checked };
        this._persistForm();
    }

    handleSaveAchToggle(e) {
        this.form = { ...this.form, saveAch: e.target.checked };
        this._persistForm();
    }

    handleDefaultAchPaymentToggle(e) {
        this.form = { ...this.form, setDefaultAchPayment: e.target.checked };
        this._persistForm();
    }

    handlePaymentTypeChange(e) {
        this.form = { ...this.form, paymentType: e.target.value };
        this.stepError = '';
        this._persistForm();
    }

    handleCardNumber(e) {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
        const formatted = raw.match(/.{1,4}/g)?.join(' ') ?? raw;
        this.form = { ...this.form, cardNumber: formatted };
        e.target.value = formatted;
        this._persistForm();
    }

    handleExpMonthChange(e) {
        this.form = { ...this.form, cardExpMonth: e.target.value };
        this._persistForm();
    }

    handleExpYearChange(e) {
        this.form = { ...this.form, cardExpYear: e.target.value };
        this._persistForm();
    }

    // ── Handlers: step navigation ────────────────────────────────
    editStep1() {
        this._navigateToStep(1);
    }

    editStep2() {
        this._navigateToStep(2);
    }

    editStep3() {
        this._navigateToStep(3);
    }

    handleStep1Submit(e) {
        e.preventDefault();
        const error = this._validateStep1();
        if (error) {
            this.stepError = error;
            return;
        }
        this.completedStep1 = true;
        this.form = { ...this.form, _completedStep1: true };
        this._persistForm();
        this._navigateToStep(2);
    }

    handleStep2Submit(e) {
        e.preventDefault();
        if (!this.completedStep1) {
            this._navigateToStep(1);
            return;
        }
        const error = this._validateStep2();
        if (error) {
            this.stepError = error;
            return;
        }
        this.completedStep2 = true;
        // Clear payment type so nothing is pre-selected on first visit to step 3
        this.form = { ...this.form, _completedStep2: true, paymentType: '' };
        this._persistForm();
        this._navigateToStep(3);
    }

    handlePlaceOrder(e) {
        if (e) e.preventDefault();

        if (!this.completedStep1 || !this.completedStep2) {
            this.stepError = 'Please complete all steps before placing your order.';
            return;
        }

        const error = this._validateStep3();
        if (error) {
            this.stepError = error;
            return;
        }

        if (this.form.paymentType === 'po') {
            // PO path — navigate to the dedicated PO submission page
            try {
                const poUrl = globalThis.location.pathname.replace(/\/checkout.*$/, '/submit-a-po') || '/AmericanBookCompany/submit-a-po';
                globalThis.location.assign(poUrl);
            } catch {
                globalThis.location.assign('/AmericanBookCompany/submit-a-po');
            }
            return;
        }

        // Credit-card / Authorize.Net Accept Hosted path
        this.isPlacingOrder = true;
        this.stepError = '';
        this._startAuthorizeNetCheckout();
    }

    async _startAuthorizeNetCheckout() {
        try {
            // 1 — Fetch the active cart to get the grand total
            const cartData = await this._fetchJson(
                `/AmericanBookCompany/webruntime/api/services/data/${API_VERSION}/commerce/webstores/${WEBSTORE_ID}/carts/current`,
                { method: 'GET' }
            );

            const amount = this._extractCartTotal(cartData);
            if (!amount || amount <= 0) {
                throw new Error('Could not determine cart total. Please refresh and try again.');
            }

            const currencyCode = cartData?.currencyIsoCode || 'USD';
            const cartId = cartData?.cartId || cartData?.id || 'current';

            // 2 — Clear any stale checkout session, then start a new one
            await this._clearCheckoutIfPresent();
            const checkoutData = await this._fetchJson(
                `/AmericanBookCompany/webruntime/api/services/data/${API_VERSION}/commerce/webstores/${WEBSTORE_ID}/checkouts`,
                {
                    method: 'POST',
                    body: JSON.stringify({ cartId })
                }
            );
            const checkoutId = checkoutData?.cartCheckoutSessionId || checkoutData?.id;
            if (!checkoutId) {
                throw new Error('Failed to start checkout session.');
            }

            // 3 — Build return URL: the current page URL + ?paymentReturn=1
            const origin = globalThis.location.origin;
            const pathname = globalThis.location.pathname;
            const returnUrl = `${origin}${pathname}?paymentReturn=1`;
            const cancelUrl = `${origin}${pathname}?paymentCancel=1`;

            // 4 — Get Authorize.Net Accept Hosted token
            const tokenResponse = await getHostedPaymentToken({
                req: {
                    amount,
                    currencyIsoCode: currencyCode,
                    returnUrl,
                    cancelUrl,
                    showReceipt: false,
                    transactionType: 'authCaptureTransaction',
                    referenceId: cartId
                }
            });

            if (!tokenResponse?.success || !tokenResponse?.token) {
                throw new Error(tokenResponse?.message || 'Payment token generation failed.');
            }

            // 5 — Persist checkout context so the return handler can place the order
            try {
                globalThis.sessionStorage?.setItem(
                    CHECKOUT_SESSION_KEY,
                    JSON.stringify({ checkoutId, cartId, amount })
                );
            } catch { /* noop */ }

            // 6 — Redirect to Accept Hosted (sandbox vs production)
            const isSandboxToken = tokenResponse.token.length < 200; // sandbox tokens are shorter
            const formAction = isSandboxToken ? PAYMENT_FORM_SANDBOX : PAYMENT_FORM_PROD;
            this._submitPaymentForm(tokenResponse.token, formAction);

        } catch (error) {
            this.isPlacingOrder = false;
            this.stepError = error?.message || 'Payment could not be started. Please try again.';
        }
    }

    /** Called on page load when Authorize.Net redirects back with ?paymentReturn=1 */
    async _handlePaymentReturn() {
        try {
            const params = new URLSearchParams(globalThis.location?.search || '');
            if (params.get('paymentReturn') !== '1') return;

            // Clean the URL so a refresh doesn't re-trigger this
            try {
                globalThis.history?.replaceState({}, '', globalThis.location.pathname);
            } catch { /* noop */ }

            const raw = globalThis.sessionStorage?.getItem(CHECKOUT_SESSION_KEY);
            if (!raw) return;

            const { checkoutId } = JSON.parse(raw);
            globalThis.sessionStorage?.removeItem(CHECKOUT_SESSION_KEY);

            if (!checkoutId) return;

            this.isPlacingOrder = true;
            this.currentStep = 3;

            // Place the order — converts the Cart to Order + OrderSummary in Salesforce
            const placeOrderResponse = await this._fetchJson(
                `/AmericanBookCompany/webruntime/api/services/data/${API_VERSION}/commerce/webstores/${WEBSTORE_ID}/checkouts/${checkoutId}/actions/placeOrder`,
                { method: 'POST', body: '{}' }
            );

            const orderRef =
                placeOrderResponse?.orderReferenceNumber ||
                placeOrderResponse?.orderId ||
                placeOrderResponse?.orderSummaryId ||
                'created';

            // Clear the form from sessionStorage, order is done
            try { globalThis.sessionStorage?.removeItem(FORM_KEY); } catch { /* noop */ }

            // Navigate to the order confirmation page
            const orderConfirmUrl = `/AmericanBookCompany/order?orderSummaryId=${placeOrderResponse?.orderSummaryId || ''}`;
            globalThis.location.assign(orderConfirmUrl);

        } catch (error) {
            this.isPlacingOrder = false;
            this.showErrorModal = true;
            this.placeOrderErrorMsg = error?.message || 'Order placement failed after payment. Please contact support.';
        }
    }

    /** Called on page load when Authorize.Net redirects back with ?paymentCancel=1 */
    _handlePaymentCancel() {
        const params = new URLSearchParams(globalThis.location?.search || '');
        if (params.get('paymentCancel') !== '1') return;
        try {
            globalThis.history?.replaceState({}, '', globalThis.location.pathname);
            globalThis.sessionStorage?.removeItem(CHECKOUT_SESSION_KEY);
        } catch { /* noop */ }
        this.stepError = 'Payment was cancelled. Please try again.';
        this.currentStep = 3;
    }

    /** Build the Authorize.Net POST form and submit */
    _submitPaymentForm(token, formAction) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = formAction;
        form.target = '_top';
        form.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'token';
        input.value = token;
        form.appendChild(input);

        document.body.appendChild(form);
        form.submit();
    }

    async _clearCheckoutIfPresent() {
        try {
            const r = await fetch(
                `/AmericanBookCompany/webruntime/api/services/data/${API_VERSION}/commerce/webstores/${WEBSTORE_ID}/checkouts/active`,
                { method: 'GET', headers: { Accept: 'application/json' } }
            );
            if (!r.ok) return;
            await fetch(
                `/AmericanBookCompany/webruntime/api/services/data/${API_VERSION}/commerce/webstores/${WEBSTORE_ID}/checkouts/active`,
                { method: 'DELETE', headers: { Accept: 'application/json' } }
            );
        } catch { /* non-fatal */ }
    }

    async _fetchJson(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const text = await response.text();
        let parsed;
        try { parsed = text ? JSON.parse(text) : {}; } catch { throw new Error('Invalid response from server.'); }
        if (!response.ok) {
            const msg = parsed?.message || parsed?.[0]?.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }
        return parsed;
    }

    _extractCartTotal(cartData) {
        const candidates = [
            cartData?.totalAmount, cartData?.grandTotalAmount,
            cartData?.amount, cartData?.cartSummary?.totalAmount,
            cartData?.cartSummary?.grandTotalAmount
        ];
        for (const v of candidates) {
            const n = Number(v);
            if (!Number.isNaN(n) && n > 0) return n;
        }
        return null;
    }

    // ── Handlers: shipping help ──────────────────────────────────
    toggleShippingHelp() {
        this.showShippingModal = true;
    }

    closeShippingModal() {
        this.showShippingModal = false;
    }

    closeErrorModal() {
        this.showErrorModal = false;
    }

    stopPropagation(e) {
        e.stopPropagation();
    }

    // ── Validation ───────────────────────────────────────────────
    _validateStep1() {
        const { contactName, contactEmail, contactEmailConfirm, contactPhone } = this.form;
        if (!contactName.trim()) return 'Name is required.';
        if (!contactEmail.trim()) return 'Email address is required.';
        if (!this._isValidEmail(contactEmail.trim())) return 'Please enter a valid email address.';
        if (contactEmail.trim() !== contactEmailConfirm.trim()) {
            this.contactEmailError = 'Email does not match!';
            return 'Email does not match!';
        }
        this.contactEmailError = '';
        if (!contactPhone.trim()) return 'Phone number is required.';
        return '';
    }

    _validateStep2() {
        const { shipName, orgName, street, city, stateCode, postalCode } = this.form;
        if (!shipName.trim()) return 'Ship To name is required.';
        if (!orgName.trim()) return 'Organization name is required.';
        if (!street.trim()) return 'Street address is required.';
        if (!city.trim()) return 'City is required.';
        if (!stateCode) return 'Please select a state.';
        if (!postalCode.trim()) return 'ZIP code is required.';
        return '';
    }

    _validateStep3() {
        const { paymentType } = this.form;
        if (!paymentType) return 'Please select a payment method.';
        // Card and ACH data are collected on Authorize.Net's secure hosted page — no local field validation needed here.
        return '';
    }

    // ── Utilities ────────────────────────────────────────────────
    _isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    _formatCurrency(amount) {
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);
        } catch {
            return `$${(amount ?? 0).toFixed(2)}`;
        }
    }
}