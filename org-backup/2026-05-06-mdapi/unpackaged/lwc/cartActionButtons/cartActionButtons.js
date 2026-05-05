import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import isGuest from '@salesforce/user/isGuest';
import generateQuotePdf from '@salesforce/apex/CartQuotePdfController.generateQuotePdf';
import QuoteDownloadModal from 'c/quoteDownloadModal';

const CHECKOUT_FORM_KEY = 'abc_checkout_flow_form';
const QUOTE_FORM_KEY = 'abc_quote_download_form';
const CART_PAGE_CACHE_KEY = 'abc_custom_cart_page_cache_v1';
const LEGACY_CART_PAGE_CACHE_KEY = 'abc_cart_page_cache';

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function readSessionJson(key) {
    try {
        const raw = globalThis.sessionStorage?.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function createDefaultQuoteForm() {
    return {
        contactName: '',
        organization: '',
        address: '',
        city: '',
        stateCode: '',
        postalCode: '',
        phone: '',
        email: '',
        taxExempt: false
    };
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function resolveCommunityBasePath() {
    const pathname = globalThis.location?.pathname || '';

    if (!pathname.startsWith('/')) {
        return '';
    }

    const siteSeparatorIndex = pathname.indexOf('/s/');
    if (siteSeparatorIndex > 0) {
        return pathname.slice(0, siteSeparatorIndex);
    }

    const pathSegments = pathname.split('/').filter(Boolean);
    return pathSegments.length > 0 ? `/${pathSegments[0]}` : '';
}

function resolveDirectDownloadUrl(downloadUrl) {
    if (!downloadUrl) {
        return downloadUrl;
    }

    const trimmedUrl = downloadUrl.trim();
    if (!trimmedUrl.startsWith('/')) {
        return trimmedUrl;
    }

    const communityBasePath = resolveCommunityBasePath();
    if (trimmedUrl.startsWith('/apex/')) {
        return `${communityBasePath}${trimmedUrl}`;
    }

    return trimmedUrl;
}

export default class CartActionButtons extends NavigationMixin(LightningElement) {
    @api checkoutUrl = '/checkout';
    @api poSubmissionUrl = '/submit-a-po';
    @api loginUrl = '/AmericanBookCompany/login';

    static US_STATES = [
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

    deprecatedRouteMap = {
        '/checkout-login': '/checkout',
        '/submit-po': '/submit-a-po'
    };

    isDownloading = false;
    errorMessage = '';
    downloadSuccess = false;
    quoteForm = createDefaultQuoteForm();

    get normalizedCheckoutUrl() {
        return this.normalizeRoute(this.checkoutUrl, '/checkout');
    }

    get normalizedPoSubmissionUrl() {
        return this.normalizeRoute(this.poSubmissionUrl, '/submit-a-po');
    }

    get showInlineErrorBanner() {
        return Boolean(this.errorMessage);
    }

    /* ---- Download a Quote ---- */

    async handleDownloadQuote() {
        if (this.isDownloading) {
            return;
        }

        if (isGuest) {
            const startUrl = `${globalThis.location?.pathname || ''}${globalThis.location?.search || ''}${globalThis.location?.hash || ''}`;
            globalThis.location.assign(
                `${this.loginUrl}?startURL=${encodeURIComponent(startUrl)}`
            );
            return;
        }

        this.errorMessage = '';
        const preparedQuoteForm = this.prepareQuoteForm();
        const modalResult = await QuoteDownloadModal.open({
            label: 'Download a Quote',
            size: 'small',
            description: 'Download a quote',
            formData: preparedQuoteForm,
            states: CartActionButtons.US_STATES
        });

        if (!modalResult || modalResult.action !== 'download') {
            return;
        }

        this.quoteForm = {
            ...preparedQuoteForm,
            ...modalResult.form
        };

        await this.handleQuoteDownloadConfirm();
    }

    prepareQuoteForm() {
        const savedQuoteForm = readSessionJson(QUOTE_FORM_KEY) || {};
        const checkoutForm = readSessionJson(CHECKOUT_FORM_KEY) || {};

        this.quoteForm = {
            contactName: normalizeText(
                savedQuoteForm.contactName || checkoutForm.contactName || checkoutForm.shipName
            ),
            organization: normalizeText(
                savedQuoteForm.organization || checkoutForm.orgName
            ),
            address: normalizeText(
                savedQuoteForm.address || checkoutForm.street
            ),
            city: normalizeText(
                savedQuoteForm.city || checkoutForm.city
            ),
            stateCode: normalizeText(
                savedQuoteForm.stateCode || checkoutForm.stateCode
            ),
            postalCode: normalizeText(
                savedQuoteForm.postalCode || checkoutForm.postalCode
            ),
            phone: normalizeText(savedQuoteForm.phone || checkoutForm.contactPhone),
            email: normalizeText(savedQuoteForm.email || checkoutForm.contactEmail),
            taxExempt: savedQuoteForm.taxExempt === true
        };
        this.persistQuoteForm();
        return { ...this.quoteForm };
    }

    persistQuoteForm() {
        try {
            globalThis.sessionStorage?.setItem(QUOTE_FORM_KEY, JSON.stringify(this.quoteForm));
        } catch {
            // Ignore storage failures.
        }
    }

    readCartSummary() {
        const cachedCart =
            readSessionJson(CART_PAGE_CACHE_KEY) || readSessionJson(LEGACY_CART_PAGE_CACHE_KEY) || {};
        const summary = cachedCart?.summary || {};

        return {
            subtotal: toNumber(summary.subtotal),
            shipping: toNumber(summary.shipping) ?? 0,
            salesTax: toNumber(summary.salesTax) ?? 0,
            total: toNumber(summary.total)
        };
    }

    buildQuoteRequest() {
        const cartSummary = this.readCartSummary();
        const subtotal = cartSummary.subtotal;
        const shippingAmount = cartSummary.shipping ?? 0;
        const salesTaxAmount = this.quoteForm.taxExempt ? 0 : cartSummary.salesTax ?? 0;
        const grandTotal =
            subtotal === null ? cartSummary.total : Number((subtotal + shippingAmount + salesTaxAmount).toFixed(2));

        const stateEntry = CartActionButtons.US_STATES.find(s => s.value === this.quoteForm.stateCode);

        return {
            contactName: normalizeText(this.quoteForm.contactName),
            organizationName: normalizeText(this.quoteForm.organization),
            streetAddress: normalizeText(this.quoteForm.address),
            city: normalizeText(this.quoteForm.city),
            stateCode: normalizeText(this.quoteForm.stateCode),
            stateLabel: stateEntry ? stateEntry.label : normalizeText(this.quoteForm.stateCode),
            postalCode: normalizeText(this.quoteForm.postalCode),
            contactPhone: normalizeText(this.quoteForm.phone),
            contactEmail: normalizeText(this.quoteForm.email),
            taxExempt: this.quoteForm.taxExempt === true,
            subtotal,
            shippingAmount,
            salesTaxAmount,
            grandTotal
        };
    }

    async handleQuoteDownloadConfirm() {
        if (this.isDownloading) {
            return;
        }

        this.isDownloading = true;
        this.errorMessage = '';
        this.downloadSuccess = false;
        this.persistQuoteForm();

        try {
            const result = await generateQuotePdf({
                requestJson: JSON.stringify(this.buildQuoteRequest())
            });

            if (!result?.success) {
                throw new Error(result?.message || 'Failed to generate quote.');
            }

            if (result?.downloadUrl) {
                const directDownloadUrl = resolveDirectDownloadUrl(result.downloadUrl);
                globalThis.open(directDownloadUrl, '_blank', 'noopener');
                this.downloadSuccess = true;
                globalThis.setTimeout(() => {
                    this.downloadSuccess = false;
                }, 4000);
                return;
            }

            if (!result?.pdfBase64) {
                throw new Error(result?.message || 'Failed to generate quote.');
            }

            // Decode base64 to binary and trigger browser download
            const byteCharacters = globalThis.atob(result.pdfBase64);
            const byteNumbers = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.codePointAt(i);
            }
            const blob = new Blob([byteNumbers], { type: 'application/pdf' });

            const url = globalThis.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ABC-Quote-${result.quoteNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            globalThis.URL.revokeObjectURL(url);

            this.downloadSuccess = true;
            globalThis.setTimeout(() => {
                this.downloadSuccess = false;
            }, 4000);
        } catch (error) {
            this.errorMessage =
                error?.body?.message || error?.message || 'Unable to generate quote.';
        } finally {
            this.isDownloading = false;
        }
    }

    /* ---- Proceed to Checkout ---- */

    handleProceedToCheckout() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: this.normalizedCheckoutUrl }
        });
    }

    /* ---- Submit a PO ---- */

    handleSubmitPO() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url: this.normalizedPoSubmissionUrl }
        });
    }

    normalizeRoute(route, fallbackRoute) {
        const normalizedRoute = typeof route === 'string' ? route.trim() : '';
        if (!normalizedRoute) {
            return fallbackRoute;
        }

        return this.deprecatedRouteMap[normalizedRoute] || normalizedRoute;
    }
}