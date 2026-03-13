import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import isGuest from '@salesforce/user/isGuest';

export default class CheckoutLoginGate extends NavigationMixin(LightningElement) {

    @api cartUrl = '/cart';
    @api checkoutUrl = '/checkout';
    @api createAccountUrl = '/SelfRegister';
    @api forgotPasswordUrl = '/ForgotPassword';

    email = '';
    password = '';
    rememberMe = false;
    loginError = '';
    isLoggingIn = false;

    get isAuthenticated() {
        return !isGuest;
    }

    connectedCallback() {
        if (this.isAuthenticated) {
            this.redirectToCheckout();
        }
    }

    handleEmailChange(e) {
        this.email = e.target.value;
        this.loginError = '';
    }

    handlePasswordChange(e) {
        this.password = e.target.value;
        this.loginError = '';
    }

    handleRememberChange(e) {
        this.rememberMe = e.target.checked;
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

        try {
            const startUrl = encodeURIComponent(this.checkoutUrl);
            const loginUrl = `/AmericanBookCompany/login?un=${encodeURIComponent(this.email.trim())}&startURL=${startUrl}`;

            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: loginUrl
                }
            });
        } catch (_ignored) {
            this.loginError = 'Unable to sign in. Please check your credentials and try again.';
            this.isLoggingIn = false;
        }
    }

    handleGuestCheckout() {
        this.redirectToCheckout();
    }

    redirectToCheckout() {
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: this.checkoutUrl
            }
        });
    }
}