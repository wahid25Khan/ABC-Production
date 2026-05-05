import { LightningElement, api, track, wire } from 'lwc';
import isGuestUser from '@salesforce/user/isGuest';
import getShippingRatePercent from '@salesforce/apex/ABCShippingCalculator.getShippingRatePercent';
import getAccountDetails from '@salesforce/apex/AccountDetailsController.getAccountDetails';
import getHostedPaymentToken from '@salesforce/apex/AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken';
import ensureCheckoutSession from '@salesforce/apex/AuthenticatedBuyerCheckoutService.ensureCheckoutSession';
import ensureDeliveryMethod from '@salesforce/apex/AuthenticatedBuyerCheckoutService.ensureDeliveryMethod';
import registerExternalPayment from '@salesforce/apex/AuthenticatedBuyerCheckoutService.registerExternalPayment';
import findLatestAuthorizedTransactionId from '@salesforce/apex/AuthenticatedBuyerCheckoutService.findLatestAuthorizedTransactionId';
import placeOrder from '@salesforce/apex/AuthenticatedBuyerCheckoutService.placeOrder';
import clearCart from '@salesforce/apex/AuthenticatedBuyerCheckoutService.clearCart';
import {
    DEFAULT_WEBSTORE_ID,
    splitCartItemName
} from 'c/utils';
import CC_VISA from '@salesforce/resourceUrl/ccVisa';
import CC_MASTERCARD from '@salesforce/resourceUrl/ccMastercard';
import CC_AMEX from '@salesforce/resourceUrl/ccAmex';
import CC_DISCOVER from '@salesforce/resourceUrl/ccDiscover';

const FORM_KEY = 'abc_checkout_flow_form';
const API_VERSION = 'v66.0';
const PAYMENT_FORM_SANDBOX = 'https://test.authorize.net/payment/payment';
const PAYMENT_FORM_PROD = 'https://accept.authorize.net/payment/payment';
const AN_ORIGIN_SANDBOX = 'https://test.authorize.net';
const AN_ORIGIN_PROD = 'https://accept.authorize.net';
const AUTHORIZED_PAYMENT_RESPONSE_CODE = '1';

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

function isPhysicalShippableSummaryItem(item) {
    if (item?.isDigitalProduct === true) {
        return false;
    }

    const normalizedFormatLabel = String(item?.formatLabel || '').trim().toLowerCase();
    const hasColorPrint = normalizedFormatLabel.includes('color');
    const hasBwPrint =
        normalizedFormatLabel.includes('b&w') ||
        normalizedFormatLabel.includes('black and white') ||
        normalizedFormatLabel.includes('black/white') ||
        normalizedFormatLabel.includes('black & white') ||
        normalizedFormatLabel.includes('black');
    const hasPrint = hasColorPrint || hasBwPrint || normalizedFormatLabel.includes('print');
    const hasDigital =
        normalizedFormatLabel.includes('digital') ||
        normalizedFormatLabel.includes('ebook') ||
        normalizedFormatLabel.includes('e-book') ||
        normalizedFormatLabel.includes('coursewave') ||
        normalizedFormatLabel.includes('online testing');

    if (hasPrint) {
        return true;
    }

    if (hasDigital) {
        return false;
    }

    return true;
}

function calculateShippableSummarySubtotal(items) {
    return (items || []).reduce((runningTotal, item) => {
        if (!isPhysicalShippableSummaryItem(item)) {
            return runningTotal;
        }

        const quantity = Number(item?.quantity ?? 0) || 0;
        const lineTotal =
            Number(item?.lineTotal) ||
            ((Number(item?.unitPrice ?? 0) || 0) * quantity);

        if (!Number.isFinite(lineTotal) || lineTotal <= 0) {
            return runningTotal;
        }

        return runningTotal + lineTotal;
    }, 0);
}

export function extractAuthorizeNetResponseCode(msg) {
    const candidates = [
        msg?.responseCode,
        msg?.transactionResponse?.responseCode,
        msg?.transactionData?.responseCode,
        msg?.response?.responseCode,
        msg?.payload?.responseCode,
        msg?.dataValue?.responseCode
    ];

    for (const candidate of candidates) {
        if (candidate != null && String(candidate).trim()) {
            return String(candidate).trim();
        }
    }

    return null;
}

export function isApprovedAuthorizeNetMessage(msg) {
    return extractAuthorizeNetResponseCode(msg) === AUTHORIZED_PAYMENT_RESPONSE_CODE;
}

export function extractAuthorizeNetFailureMessage(msg) {
    const responseCode = extractAuthorizeNetResponseCode(msg);
    const candidates = [
        msg?.messages?.message?.[0]?.text,
        msg?.transactionResponse?.errors?.[0]?.errorText,
        msg?.transactionResponse?.messages?.[0]?.description,
        msg?.response?.message,
        msg?.message,
        msg?.payload?.message
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    if (responseCode != null) {
        return `Payment was not authorized (response code ${responseCode}).`;
    }

    return 'Payment was not authorized. Please try again or use a different payment method.';
}

export function buildCheckoutStorefrontParams({ asGuest }) {
    return new URLSearchParams({
        language: 'en-US',
        asGuest: asGuest ? 'true' : 'false',
        htmlEncode: 'false'
    });
}

function firstNonBlank(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return '';
}

function buildDetailsFullName(details = {}) {
    return firstNonBlank(
        details.fullName,
        [details.firstName, details.lastName].filter((value) => typeof value === 'string' && value.trim()).join(' ')
    );
}

export function buildProfileBackedCheckoutDefaults(details = {}, existingForm = {}) {
    const fullName = buildDetailsFullName(details);
    const email = firstNonBlank(existingForm.contactEmail, details.email);

    return {
        ...existingForm,
        contactName: firstNonBlank(existingForm.contactName, fullName),
        contactEmail: email,
        contactEmailConfirm: firstNonBlank(existingForm.contactEmailConfirm, email, details.email),
        contactPhone: firstNonBlank(existingForm.contactPhone, details.phone),
        shipName: firstNonBlank(existingForm.shipName, fullName),
        orgName: firstNonBlank(existingForm.orgName, details.organizationName),
        street: firstNonBlank(existingForm.street, details.shippingStreet, details.billingStreet),
        city: firstNonBlank(existingForm.city, details.shippingCity, details.billingCity),
        stateCode: firstNonBlank(existingForm.stateCode, details.shippingState, details.billingState),
        postalCode: firstNonBlank(existingForm.postalCode, details.shippingPostalCode, details.billingPostalCode),
        cardholderName: firstNonBlank(existingForm.cardholderName, fullName),
        billingStreet: firstNonBlank(existingForm.billingStreet, details.billingStreet, details.shippingStreet),
        billingCity: firstNonBlank(existingForm.billingCity, details.billingCity, details.shippingCity),
        billingStateCode: firstNonBlank(existingForm.billingStateCode, details.billingState, details.shippingState),
        billingZip: firstNonBlank(existingForm.billingZip, details.billingPostalCode, details.shippingPostalCode),
        poContact: firstNonBlank(existingForm.poContact, fullName),
        poEmail: firstNonBlank(existingForm.poEmail, details.email)
    };
}

export function validateCheckoutContactForm(form = {}) {
    const contactName = String(form.contactName || '').trim();
    const contactEmail = String(form.contactEmail || '').trim();
    const contactEmailConfirm = String(form.contactEmailConfirm || '').trim();
    const contactPhone = String(form.contactPhone || '').trim();

    if (!contactName) return 'Name is required.';
    if (!contactEmail) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return 'Please enter a valid email address.';
    if (contactEmail !== contactEmailConfirm) return 'Email does not match!';
    if (!contactPhone) return 'Phone number is required.';
    return '';
}

export function validateCheckoutShippingForm(form = {}) {
    const shipName = String(form.shipName || '').trim();
    const orgName = String(form.orgName || '').trim();
    const street = String(form.street || '').trim();
    const city = String(form.city || '').trim();
    const stateCode = String(form.stateCode || '').trim();
    const postalCode = String(form.postalCode || '').trim();

    if (!shipName) return 'Ship To name is required.';
    if (!orgName) return 'Organization name is required.';
    if (!street) return 'Street address is required.';
    if (!city) return 'City is required.';
    if (!stateCode) return 'Please select a state.';
    if (!postalCode) return 'ZIP code is required.';
    return '';
}

export function deriveCheckoutStepCompletion(form = {}) {
    return {
        step1Complete: !validateCheckoutContactForm(form),
        step2Complete: !validateCheckoutShippingForm(form)
    };
}

export function determineHydratedCheckoutStep(currentStep, completion = {}) {
    if (currentStep !== 1) {
        return currentStep;
    }

    if (completion.step1Complete && completion.step2Complete) {
        return 3;
    }

    if (completion.step1Complete) {
        return 2;
    }

    return 1;
}

export default class CheckoutFlow extends LightningElement {
    @api cartUrl = '/cart';
    @api signInUrl = '/login';
    @api webStoreId = DEFAULT_WEBSTORE_ID;

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

    // Payment modal state
    @track showPaymentModal = false;
    @track paymentIframeSrc = '';
    @track isPlacingOrderAfterPayment = false;
    @track isPaymentExpanded = false;
    @track paymentSandboxMode = false;
    @track orderPlaced = false;
    @track orderNumber = '';
    @track orderSummaryId = '';

    // Internal checkout context (not persisted across page loads)
    _pendingCheckoutId = null;
    _lastCartAmount = null;       // cart subtotal (ex. shipping) — passed to registerExternalPayment
    _lastAnChargeAmount = null;   // total including shipping — what AN actually charges the customer
    _lastPaymentReferenceId = null; // checkoutSessionId used as AN invoiceNumber — unique per checkout attempt
    _messageHandler = null;

    currentStep = 1;
    completedStep1 = false;
    completedStep2 = false;
    shippingRatePercent = 0;

    // ── Lifecycle ────────────────────────────────────────────────
    connectedCallback() {
        this.currentStep = this._readStepFromUrl();
        this._restoreForm();
        this._loadSummaryFromCart();

        if (!this.isGuest) {
            this._hydrateFormFromAccountDetails();
        }
    }

    disconnectedCallback() {
        this._removeMessageListener();
        this._removeIframeLoadListener();
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
            const match = /\/step\/(\d+)$/.exec(globalThis.location?.pathname || '');
            const n = match ? Number.parseInt(match[1], 10) : 1;
            return n >= 1 && n <= 3 ? n : 1;
        } catch {
            return 1;
        }
    }

    _navigateToStep(step) {
        try {
            const pathname = String(globalThis.location?.pathname || '');
            if (/\/step\/\d+$/i.test(pathname)) {
                const base = pathname.replace(/\/step\/\d+$/i, '');
                globalThis.history?.pushState({}, '', `${base}/step/${step}`);
            }
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
            const safeToPersist = { ...this.form };
            delete safeToPersist.cardNumber;
            delete safeToPersist.cardCvv;
            delete safeToPersist.achRoutingNumber;
            delete safeToPersist.achAccountNumber;
            delete safeToPersist.achAccountNumberConfirm;
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

    async _hydrateFormFromAccountDetails() {
        try {
            const details = await getAccountDetails();
            this._applyAccountDetailsToForm(details);
        } catch {
            /* profile hydration is best-effort */
        }
    }

    _applyAccountDetailsToForm(details) {
        const hydratedForm = buildProfileBackedCheckoutDefaults(details, this.form);
        const completion = deriveCheckoutStepCompletion(hydratedForm);

        this.completedStep1 = this.completedStep1 || completion.step1Complete;
        this.completedStep2 = this.completedStep2 || completion.step2Complete;

        this.form = {
            ...hydratedForm,
            _completedStep1: this.completedStep1,
            _completedStep2: this.completedStep2
        };

        const nextStep = determineHydratedCheckoutStep(this.currentStep, {
            step1Complete: this.completedStep1,
            step2Complete: this.completedStep2
        });

        if (nextStep !== this.currentStep) {
            this._navigateToStep(nextStep);
        }

        this._persistForm();
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
                const formatLabel = item.formatLabel ?? nameInfo.formatLabel ?? '';
                const normalizedFormatLabel = formatLabel.toLowerCase();
                const hasDigital =
                    normalizedFormatLabel.includes('digital') ||
                    normalizedFormatLabel.includes('ebook') ||
                    normalizedFormatLabel.includes('coursewave');
                const hasColorPrint = normalizedFormatLabel.includes('color');
                const hasBwPrint = normalizedFormatLabel.includes('b&w') || normalizedFormatLabel.includes('black');
                const quantity = Number(item.quantity ?? 1) || 1;
                const lineTotal =
                    Number(item.lineTotal) ||
                    ((Number(item.unitPrice ?? 0) || 0) * quantity);

                return {
                    id: item.id,
                    name: nameInfo.baseName || (item.productName ?? item.name ?? 'Product'),
                    imageUrl: item.imageUrl ?? '',
                    detailUrl: item.detailPath ?? '#',
                    quantity,
                    unitPrice: Number(item.unitPrice ?? 0) || 0,
                    lineTotal,
                    formatLabel,
                    isDigitalProduct: item.isDigitalProduct,
                    totalLabel: this._formatCurrency(lineTotal),
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
        const shippableSubtotal = calculateShippableSummarySubtotal(this.summaryItems);
        if (shippableSubtotal > 0 && this.shippingRatePercent > 0) {
            this.shippingCost = Number(((shippableSubtotal * this.shippingRatePercent) / 100).toFixed(2));
            return;
        }

        this.shippingCost = 0;
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
            const webStoreId = this._resolveWebStoreId();

            // 1 — Fetch the active cart to get the grand total
            const cartData = await this._fetchJson(
                this._buildStorefrontApiUrl(`/commerce/webstores/${webStoreId}/carts/current`),
                { method: 'GET' }
            );

            const amount = this._extractCartTotal(cartData);
            if (!amount || amount <= 0) {
                throw new Error('Could not determine cart total. Please refresh and try again.');
            }
            // AN charges the full amount (products + shipping)
            const totalWithShipping = Number((amount + (this.shippingCost ?? 0)).toFixed(2));
            // Commerce payment registration must match its internal due amount (products only — shipping is tracked via CartDeliveryGroup)
            this._lastCartAmount = amount; // cache for registerExternalPayment
            this._lastAnChargeAmount = totalWithShipping; // actual amount charged to customer via AN

            const currencyCode = cartData?.currencyIsoCode || 'USD';
            const cartId = cartData?.cartId || cartData?.id || 'current';

            // 2 — Start or refresh the checkout session via Apex so the buyer
            // session auth context reaches the Commerce APIs server-side.
            const checkoutData = await ensureCheckoutSession({
                webStoreId,
                cartId
            });
            const checkoutId = this._extractCheckoutSessionId(checkoutData);
            if (!checkoutId) {
                throw new Error('Failed to start checkout session.');
            }
            // Use checkoutSessionId (not cartId) as the AN referenceId/invoiceNumber.
            // Each checkout attempt gets a unique session — prevents webhook records from one
            // attempt being matched against a different attempt on the same cart.
            this._lastPaymentReferenceId = checkoutId;

            // 2.5 — The B2B Commerce placeOrder endpoint requires a delivery
            //       method to be explicitly selected on each delivery group.
            //       Because this custom checkout skips the standard delivery-
            //       selection step, auto-select the first available method now.
            //       This must run server-side (Apex) because buyer profiles
            //       do not have the API Enabled permission.
            try {
                await ensureDeliveryMethod({ webStoreId, checkoutSessionId: checkoutId, shippingAmount: this.shippingCost ?? 0 });
            } catch (dmErr) {
                console.warn('[checkoutFlow] ensureDeliveryMethod', dmErr);
                // Non-fatal: placeOrder will surface the actual error
            }

            // 3 — Build return / cancel URLs with distinct query params so the
            //     iframe load-event handler can tell an approved redirect apart
            //     from a user cancellation.  We intentionally omit the
            //     iFrameCommunicatorUrl because Salesforce Experience Cloud
            //     serves static resources with X-Frame-Options: SAMEORIGIN,
            //     which prevents Authorize.Net from framing the communicator
            //     page.  Without a communicator, AN redirects the iframe to
            //     the return URL after an approved transaction, and the LWC
            //     detects the redirect via the iframe load event.
            const baseUrl = `${globalThis.location.origin}${globalThis.location.pathname}`;

            // 4 — Get Authorize.Net Accept Hosted token (iFrame mode)
            const tokenResponse = await getHostedPaymentToken({
                req: {
                    amount: totalWithShipping, // full charge including shipping
                    currencyIsoCode: currencyCode,
                    returnUrl: `${baseUrl}?an_result=approved`,
                    cancelUrl: `${baseUrl}?an_result=cancelled`,
                    showReceipt: false,
                    transactionType: 'authCaptureTransaction',
                    referenceId: checkoutId
                }
            });

            if (!tokenResponse?.success || !tokenResponse?.token) {
                throw new Error(tokenResponse?.message || 'Payment token generation failed.');
            }

            // 5 — Store checkoutId in memory (no page reload in iframe mode)
            this._pendingCheckoutId = checkoutId;

            // 6 — Build the iframe src by POST-ing the token to AN via a hidden form
            //     then opening the result in the modal iframe
            const isSandbox = tokenResponse.useSandbox === true;
            this.paymentSandboxMode = isSandbox;
            const formAction = isSandbox ? PAYMENT_FORM_SANDBOX : PAYMENT_FORM_PROD;

            this._openPaymentModal(tokenResponse.token, formAction);

        } catch (error) {
            this.isPlacingOrder = false;
            this.stepError = error?.message || 'Payment could not be started. Please try again.';
        }
    }

    /** Open the payment modal and submit the token form targeting the modal iframe */
    _openPaymentModal(token, formAction) {
        // Show the modal first (iframe is already rendered in DOM)
        this.showPaymentModal = true;
        this.isPlacingOrder = false;

        // Register the postMessage listener (secondary / future-proofing)
        this._addMessageListener();

        // After render, create a hidden form that targets the modal iframe and submit it
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const iframe = this.template.querySelector('.an-payment-iframe');
            if (!iframe) return;

            iframe.name = 'an-payment-iframe';

            // ── Primary detection: iframe redirect after AN approval ────
            // Without a communicator, AN redirects the iframe to the return
            // URL after an approved transaction (showReceipt=false).  We
            // detect this by listening for load events: when the iframe
            // navigates to our origin we know the payment finished.
            this._addIframeLoadListener(iframe);

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = formAction;
            form.target = 'an-payment-iframe';
            form.style.display = 'none';

            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'token';
            input.value = token;
            form.appendChild(input);

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        }, 100);
    }

    /**
     * Listen for load events on the payment iframe.  After the initial
     * cross-origin load (the AN hosted form), a subsequent load on our own
     * origin means AN has redirected — either after an approved transaction
     * (return URL with ?an_result=approved) or after the user cancelled
     * (cancel URL with ?an_result=cancelled).
     */
    _addIframeLoadListener(iframe) {
        this._removeIframeLoadListener();

        this._iframeLoadHandler = () => {
            // Guard: if the modal was already closed (e.g. by the postMessage
            // listener), do nothing.
            if (!this.showPaymentModal) return;

            let iframeHref;
            try {
                // Same-origin iframes allow location access; cross-origin throws.
                iframeHref = iframe.contentWindow.location.href;
            } catch {
                // Still on the AN domain — ignore.
                return;
            }

            if (iframeHref?.includes('an_result=approved')) {
                // Approved transaction — close modal and place the order.
                // The iframe redirect carries no transaction data, so we pass null
                // and rely on the cart amount alone for payment registration.
                this._removeIframeLoadListener();
                this._removeMessageListener();
                this.showPaymentModal = false;
                this._completeOrder(null);
            } else if (iframeHref?.includes('an_result=cancelled')) {
                // User cancelled inside the hosted form.
                this._removeIframeLoadListener();
                this._removeMessageListener();
                this.showPaymentModal = false;
                this.isPlacingOrder = false;
                this.stepError = 'Payment was cancelled. You can try again when ready.';
            }
            // Any other same-origin load (e.g. about:blank) is ignored.
        };

        iframe.addEventListener('load', this._iframeLoadHandler);
    }

    _removeIframeLoadListener() {
        if (this._iframeLoadHandler) {
            const iframe = this.template.querySelector('.an-payment-iframe');
            if (iframe) {
                iframe.removeEventListener('load', this._iframeLoadHandler);
            }
            this._iframeLoadHandler = null;
        }
    }

    /** Listen for postMessage events from the Authorize.Net communicator page */
    _addMessageListener() {
        this._removeMessageListener(); // ensure no duplicates
        this._messageHandler = (event) => this._handleAnMessage(event);
        globalThis.addEventListener('message', this._messageHandler);
    }

    _removeMessageListener() {
        if (this._messageHandler) {
            globalThis.removeEventListener('message', this._messageHandler);
            this._messageHandler = null;
        }
    }

    _handleAnMessage(event) {
        // Only accept messages from AN origins OR from our own origin (via communicator relay)
        const allowed = [AN_ORIGIN_SANDBOX, AN_ORIGIN_PROD, globalThis.location.origin];
        if (!allowed.includes(event.origin)) return;

        let msg;
        try {
            msg = (typeof event.data === 'string') ? JSON.parse(event.data) : event.data;
        } catch {
            return;
        }

        if (!msg) return;

        // Determine the action: AN Accept Hosted may send {action:'transactResponse'}
        // or a flat object with {resultCode, transactionData} and no action field.
        let action = msg.action;
        if (!action && msg.transactionData && msg.resultCode) {
            action = 'transactResponse';
        }
        if (!action) return;

        switch (action) {
            case 'transactResponse': {
                if (!isApprovedAuthorizeNetMessage(msg)) {
                    this._removeMessageListener();
                    this.showPaymentModal = false;
                    this.isPlacingOrder = false;
                    this.isPlacingOrderAfterPayment = false;
                    this.placeOrderErrorMsg = extractAuthorizeNetFailureMessage(msg);
                    this.showErrorModal = true;
                    return;
                }

                // Payment was authorised/captured — extract the AN transaction ID so we can
                // register the payment on the Commerce checkout session before placing the order.
                const anTransactionId =
                    msg?.transactionData?.transId ||
                    msg?.transactionResponse?.transId ||
                    msg?.transactionData?.transactionId ||
                    null;

                // Close modal and place the order
                this._removeMessageListener();
                this.showPaymentModal = false;
                this._completeOrder(anTransactionId);
                break;
            }
            case 'successfulSave':
                // Accept Hosted can emit successfulSave before the final transaction
                // payload arrives. Do not place the order until we have an approved
                // transactResponse from Authorize.Net.
                break;
            case 'cancel':
            case 'cancelTransaction':
                // User cancelled inside the hosted form
                this._removeMessageListener();
                this.showPaymentModal = false;
                this.isPlacingOrder = false;
                this.stepError = 'Payment was cancelled. You can try again when ready.';
                break;
            case 'resizeWindow':
                // AN requests iframe resize — update height if needed
                break;
            default:
                break;
        }
    }

    /** Close the payment modal when user clicks the X button */
    handleClosePaymentModal() {
        this._removeMessageListener();
        this._removeIframeLoadListener();
        this.showPaymentModal = false;
        this.isPlacingOrder = false;
        this.isPaymentExpanded = false;
        this._pendingCheckoutId = null;
        this.stepError = 'Payment was cancelled. You can try again or create an account.';
    }

    /** Toggle expanded / collapsed state of the payment modal */
    handleTogglePaymentExpand() {
        this.isPaymentExpanded = !this.isPaymentExpanded;
    }

    /** Label for the expand/collapse button (accessibility) */
    get paymentExpandLabel() {
        return this.isPaymentExpanded ? 'Collapse window' : 'Expand window';
    }

    /** Dynamic CSS class for the payment modal container */
    get paymentModalContainerClass() {
        let cls = 'an-modal-container';
        if (this.paymentSandboxMode) cls += ' an-modal-sandbox';
        if (this.isPaymentExpanded)  cls += ' an-modal-expanded';
        return cls;
    }

    /** Called after AN confirms payment — registers payment and places the order */
    async _completeOrder(anTransactionId = null) {
        const checkoutId = this._pendingCheckoutId;
        this._pendingCheckoutId = null;

        if (!checkoutId) {
            this.stepError = 'Session expired. Please refresh and try again.';
            return;
        }

        this.isPlacingOrderAfterPayment = true;

        try {
            const webStoreId = this._resolveWebStoreId();

            // 1 — Re-ensure delivery method (cart recalculation can reset SelectedDeliveryMethodId)
            // This is required before placeOrder — let it throw if it fails
            await ensureDeliveryMethod({
                webStoreId,
                checkoutSessionId: checkoutId,
                shippingAmount: this.shippingCost ?? 0
            });

            // 2 — Resolve the Authorize.Net transaction ID.
            // The iframe redirect path provides null — AN delivers the transaction ID via webhook
            // which inserts an AuthorizeNet_Transaction__c record. Poll briefly for it.
            let resolvedTransactionId = anTransactionId;
            if (!resolvedTransactionId) {
                resolvedTransactionId = await this._waitForAuthorizeNetTransactionId(checkoutId, 12, 2500);
            }

            // 3 — Register the payment with Commerce so placeOrder sees an authorised payment.
            // Requires AuthorizeNetPassthroughAdapter + PaymentGateway to be configured in the org.
            // The adapter is a passthrough — it records the AN transaction ID and returns Success.
            console.log('[checkoutFlow] resolvedTransactionId:', resolvedTransactionId, 'lastCartAmount:', this._lastCartAmount);
            if (resolvedTransactionId) {
                await registerExternalPayment({
                    webStoreId,
                    checkoutSessionId: checkoutId,
                    amount: this._lastCartAmount ?? 0,
                    transactionId: resolvedTransactionId
                });
                console.log('[checkoutFlow] registerExternalPayment succeeded');
            } else {
                throw new Error('No Authorize.Net transaction ID found — cannot register payment. Check webhook delivery.');
            }

            // 4 — Place the order (creates the Salesforce Order record)
            const orderResult = await placeOrder({ checkoutSessionId: checkoutId });

            await this._onOrderSuccess(orderResult);

        } catch (error) {
            const msg = error?.body?.message || error?.message || '';
            console.error('[checkoutFlow] _completeOrder failed', JSON.stringify(error));
            this.isPlacingOrderAfterPayment = false;
            this.showErrorModal = true;
            this.placeOrderErrorMsg = msg || 'Payment was received but could not complete. Please contact support.';
        }
    }

    /**
     * Polls AuthorizeNet_Transaction__c (via Apex) for a successful transaction ID
     * matching the given referenceId (= checkoutSessionId = AN invoiceNumber).
     * Returns the transaction ID string, or null if not found within the timeout.
     * Uses recursive setTimeout via globalThis to avoid LWC eslint restrictions.
     */
    _waitForAuthorizeNetTransactionId(referenceId, maxAttempts = 12, delayMs = 2500) {
        return new Promise((resolve) => {
            let attempt = 0;
            const tryOnce = () => {
                findLatestAuthorizedTransactionId({ referenceId })
                    .then((transId) => {
                        if (transId) {
                            console.log(`[checkoutFlow] Found AN transactionId after ${attempt + 1} poll(s):`, transId);
                            resolve(transId);
                            return;
                        }
                        attempt += 1;
                        if (attempt >= maxAttempts) {
                            console.warn('[checkoutFlow] AN transaction ID not found after', maxAttempts, 'polls');
                            resolve(null);
                            return;
                        }
                        globalThis.setTimeout(tryOnce, delayMs);
                    })
                    .catch((err) => {
                        console.warn('[checkoutFlow] _waitForAuthorizeNetTransactionId poll error:', err?.body?.message || err?.message);
                        attempt += 1;
                        if (attempt >= maxAttempts) {
                            resolve(null);
                            return;
                        }
                        globalThis.setTimeout(tryOnce, delayMs);
                    });
            };
            tryOnce();
        });
    }

    /** Clears form/cart then redirects to the home page after a successful payment */
    async _onOrderSuccess(orderResult) {
        try { globalThis.sessionStorage?.removeItem(FORM_KEY); } catch { /* noop */ }

        // Clear the cart — payment is confirmed even if the Salesforce order hasn't been placed yet.
        try {
            const cartId = await this._resolveCurrentCartId();
            if (cartId) {
                await clearCart({ cartId });
                globalThis.sessionStorage?.removeItem('abc_custom_cart_page_cache_v1');
                globalThis.sessionStorage?.removeItem('abc_cart_page_cache');
            }
        } catch (clearErr) {
            console.warn('[checkoutFlow] clearCart (non-fatal):', clearErr?.body?.message || clearErr?.message);
        }

        this.isPlacingOrderAfterPayment = false;
        this.orderPlaced = true;
        this.orderNumber = orderResult?.orderReferenceNumber || orderResult?.orderId || '';
        this.orderSummaryId = orderResult?.orderSummaryId || '';
        // Redirect happens when the user closes the success modal (handleOrderSuccessClose)
    }

    /** Redirects to the storefront home — called when the user closes the order success overlay */
    handleOrderSuccessClose() {
        globalThis.location.assign('/AmericanBookCompany/');
    }

    /** Navigate to the order confirmation page from the success screen */
    handleViewOrder() {
        globalThis.location.assign('/AmericanBookCompany/my-orders');
    }


    _resolveWebStoreId() {
        const resolved = String(this.webStoreId || DEFAULT_WEBSTORE_ID || '').trim();
        if (!resolved) {
            throw new Error('Checkout configuration is missing webStoreId.');
        }
        return resolved;
    }

    async _resolveCurrentCartId() {
        try {
            const cartUrl = this._buildStorefrontApiUrl(`/commerce/webstores/${this._resolveWebStoreId()}/carts/current`);
            const cartData = await this._fetchJson(cartUrl, { method: 'GET' });
            return cartData?.cartId || cartData?.id || null;
        } catch {
            return null;
        }
    }

    // TODO: re-enable _waitForAuthorizeNetTransactionId when order creation is re-enabled.
    // async _waitForAuthorizeNetTransactionId() { ... }

    _extractCheckoutSessionId(checkoutData) {
        return checkoutData?.cartCheckoutSessionId || checkoutData?.id || null;
    }

    _buildStorefrontApiUrl(path) {
        const params = buildCheckoutStorefrontParams({ asGuest: this.isGuest });
        const suffix = params.toString();
        return `/AmericanBookCompany/webruntime/api/services/data/${API_VERSION}${path}${suffix ? `?${suffix}` : ''}`;
    }

    async _fetchJson(url, options = {}) {
        const { data } = await this._fetchJsonWithResponse(url, options);
        return data;
    }

    async _fetchJsonWithResponse(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'include',
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
        return { response, data: parsed };
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
        const error = validateCheckoutContactForm(this.form);
        this.contactEmailError = error === 'Email does not match!' ? error : '';
        return error;
    }

    _validateStep2() {
        return validateCheckoutShippingForm(this.form);
    }

    _validateStep3() {
        const { paymentType } = this.form;
        if (!paymentType) return 'Please select a payment method.';
        // Card and ACH data are collected on Authorize.Net's secure hosted page — no local field validation needed here.
        return '';
    }

    // ── Utilities ────────────────────────────────────────────────
    _formatCurrency(amount) {
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);
        } catch {
            return `$${(amount ?? 0).toFixed(2)}`;
        }
    }
}