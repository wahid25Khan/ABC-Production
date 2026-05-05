import { LightningElement } from 'lwc';

export default class CheckoutSummaryExtras extends LightningElement {
    showShippingHelp = false;
    showPlaceholderExtras = true;
    visibilityIntervalId;

    connectedCallback() {
        this.syncWithNativePlaceOrder();
        this.visibilityIntervalId = globalThis.setInterval(() => {
            this.syncWithNativePlaceOrder();
        }, 500);
    }

    disconnectedCallback() {
        globalThis.clearInterval(this.visibilityIntervalId);
        this.visibilityIntervalId = undefined;
    }

    toggleShippingHelp() {
        this.showShippingHelp = !this.showShippingHelp;
    }

    syncWithNativePlaceOrder() {
        const realPlaceOrderButton = Array.from(globalThis.document?.querySelectorAll('button') || []).find(
            (button) => button.textContent?.trim() === 'Place Order' && !this.template.contains(button)
        );

        this.showPlaceholderExtras = !this.isVisible(realPlaceOrderButton);
    }

    isVisible(element) {
        if (!element) {
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
}