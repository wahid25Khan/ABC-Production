import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

export default class CheckoutGuestStepHeader extends LightningElement {
    stageStorageKey = 'abc_checkout_stage';
    checkoutStage = 'gate';
    stageChangeHandler;

    @api heading = 'Checkout';
    @api signInUrl = '/login';

    connectedCallback() {
        this.syncCheckoutStage();
        this.stageChangeHandler = () => this.syncCheckoutStage();
        globalThis.addEventListener('abccheckoutstagechange', this.stageChangeHandler);
    }

    disconnectedCallback() {
        globalThis.removeEventListener('abccheckoutstagechange', this.stageChangeHandler);
    }

    get isDetailsStage() {
        return this.checkoutStage === 'details';
    }

    get showSignInLink() {
        return isGuest && this.isDetailsStage;
    }

    syncCheckoutStage() {
        try {
            this.checkoutStage = globalThis.sessionStorage?.getItem(this.stageStorageKey) || 'gate';
        } catch {
            this.checkoutStage = 'gate';
        }
    }
}