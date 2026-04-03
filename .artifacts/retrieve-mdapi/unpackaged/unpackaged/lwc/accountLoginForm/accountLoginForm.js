import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

const DEFAULT_GOOGLE_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';
const DEFAULT_MICROSOFT_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Microsoft_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';

export default class AccountLoginForm extends LightningElement {
    @api forgotPasswordLabel = 'Forgot your password?'; // NOSONAR — UI label text, not a credential
    @api forgotPasswordUrl = '/ForgotPassword'; // NOSONAR — site URL path, not a credential
    @api googleAuthUrl = DEFAULT_GOOGLE_AUTH_URL;
    @api loginButtonLabel = 'Sign In';
    @api loginActionUrl = '/AmericanBookCompany/login';
    @api microsoftAuthUrl = DEFAULT_MICROSOFT_AUTH_URL;
    @api passwordLabel = 'Password'; // NOSONAR — UI label text, not a credential
    @api selfRegisterLabel = 'Not a member?';
    @api selfRegisterUrl = '/create-account';
    @api usernameLabel = 'Username';
    @api defaultStartUrl = '/myprofile';

    username = '';
    password = '';
    errorMessage = '';
    isSubmitting = false;
    hasClientHydrated = false;

    connectedCallback() {
        this.hydrateErrorMessageFromUrl();

        if (!isGuest) {
            this.redirectToResolvedStartUrl();
        }
    }

    renderedCallback() {
        if (this.hasClientHydrated) {
            return;
        }

        this.hasClientHydrated = true;

        if (!this.hasLoginErrorParam()) {
            this.errorMessage = '';
        }
    }

    get buttonLabel() {
        return this.isSubmitting ? 'Signing In...' : this.loginButtonLabel;
    }

    get hasSocialOptions() {
        return Boolean(this.googleAuthUrl || this.microsoftAuthUrl);
    }

    handleUsernameChange(event) {
        this.username = event.target.value;
        this.errorMessage = '';
    }

    handlePasswordChange(event) {
        this.password = event.target.value;
        this.errorMessage = '';
    }

    handlePasswordKeydown(event) {
        if (event.key === 'Enter') {
            this.handleLogin();
        }
    }

    handleLogin() {
        if (!this.username.trim()) {
            this.errorMessage = 'Please enter your email address.';
            return;
        }

        if (!this.password) {
            this.errorMessage = 'Please enter your password.';
            return;
        }

        this.isSubmitting = true;
        this.errorMessage = '';

        try {
            const ownerDocument = this.template.host.ownerDocument;
            const form = ownerDocument.createElement('form');
            form.method = 'POST';
            form.action = this.getResolvedLoginActionUrl();

            this.appendHiddenInput(ownerDocument, form, 'username', this.username.trim());
            this.appendHiddenInput(ownerDocument, form, 'password', this.password);
            this.appendHiddenInput(ownerDocument, form, 'startURL', this.getResolvedStartUrl());

            ownerDocument.body.appendChild(form);
            form.submit();
        } catch (error) {
            console.warn('Login submission failed.', error);
            this.errorMessage = 'Unable to sign in right now. Please try again.';
            this.isSubmitting = false;
        }
    }

    hydrateErrorMessageFromUrl() {
        if (this.hasLoginErrorParam()) {
            const params = new URLSearchParams(globalThis.location.search);
            const startUrl = params.get('startURL') || params.get('startUrl') || '';
            this.errorMessage = startUrl.includes('OauthFlowCallbackPage')
                ? 'Google sign-in could not be completed. Please try again. If this is your first time, contact support if the issue continues.'
                : 'Unable to sign in. Please check your credentials and try again.';
        }
    }

    hasLoginErrorParam() {
        const params = new URLSearchParams(globalThis.location.search);
        return params.has('error') || params.has('loginError') || params.has('ec');
    }

    appendHiddenInput(ownerDocument, form, name, value) {
        const input = ownerDocument.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }

    getResolvedStartUrl() {
        const params = new URLSearchParams(globalThis.location.search);
        const startUrl = params.get('startURL') || params.get('startUrl') || this.defaultStartUrl;

        if (!startUrl) {
            return '/';
        }

        if (startUrl.startsWith('/')) {
            return startUrl;
        }

        try {
            const parsed = new URL(startUrl, globalThis.location.origin);
            return parsed.origin === globalThis.location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : this.defaultStartUrl;
        } catch {
            return this.defaultStartUrl;
        }
    }

    getResolvedLoginActionUrl() {
        if (!this.loginActionUrl) {
            return '/';
        }

        if (this.loginActionUrl.startsWith('/')) {
            return this.loginActionUrl;
        }

        try {
            const parsed = new URL(this.loginActionUrl, globalThis.location.origin);
            return parsed.origin === globalThis.location.origin
                ? `${parsed.pathname}${parsed.search}${parsed.hash}`
                : '/';
        } catch {
            return '/';
        }
    }

    redirectToResolvedStartUrl() {
        globalThis.location.assign(this.getResolvedStartUrl());
    }
}