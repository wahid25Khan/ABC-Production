import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import isGuest from '@salesforce/user/isGuest';
import generateQuotePdf from '@salesforce/apex/CartQuotePdfController.generateQuotePdf';

export default class CartActionButtons extends NavigationMixin(LightningElement) {
    @api checkoutUrl = '/checkout';
    @api poSubmissionUrl = '/submit-a-po';

    deprecatedRouteMap = {
        '/checkout-login': '/checkout',
        '/submit-po': '/submit-a-po'
    };

    isDownloading = false;
    errorMessage = '';
    downloadSuccess = false;

    get normalizedCheckoutUrl() {
        return this.normalizeRoute(this.checkoutUrl, '/checkout');
    }

    get normalizedPoSubmissionUrl() {
        return this.normalizeRoute(this.poSubmissionUrl, '/submit-a-po');
    }

    /* ---- Download a Quote ---- */

    async handleDownloadQuote() {
        if (this.isDownloading) return;

        if (isGuest) {
            this.errorMessage = 'Please sign in to download a quote.';
            return;
        }

        this.isDownloading = true;
        this.errorMessage = '';
        this.downloadSuccess = false;

        try {
            const result = await generateQuotePdf();

            if (!result?.success || !result?.pdfBase64) {
                throw new Error(result?.message || 'Failed to generate quote.');
            }

            // Decode base64 to binary and trigger browser download
            const byteCharacters = atob(result.pdfBase64);
            const byteNumbers = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.codePointAt(i);
            }
            const blob = new Blob([byteNumbers], { type: 'application/pdf' });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ABC-Quote-${result.quoteNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            this.downloadSuccess = true;
            setTimeout(() => {
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
