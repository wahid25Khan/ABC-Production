import { LightningElement, api } from 'lwc';
import registerBuyer from '@salesforce/apex/BuyerSelfRegistrationService.registerBuyer';
import {
    openAuthPopup,
    stopAuthPopupMonitor,
    resolveAbsoluteUrl,
    normalizeInternalUrl,
    appendHiddenInput,
    isPopupLoginErrorUrl
} from 'c/utils';

const DEFAULT_GOOGLE_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';
const DEFAULT_MICROSOFT_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Microsoft_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';
const DEFAULT_LOGIN_ACTION_URL = '/AmericanBookCompany/login';
const DEFAULT_START_URL = '/myprofile';

export default class CreateAccountRegistration extends LightningElement {
    @api googleAuthUrl = DEFAULT_GOOGLE_AUTH_URL;
    @api microsoftAuthUrl = DEFAULT_MICROSOFT_AUTH_URL;
    @api loginActionUrl = DEFAULT_LOGIN_ACTION_URL;
    @api defaultStartUrl = DEFAULT_START_URL;

    firstName = '';
    lastName = '';
    email = '';
    confirmEmail = '';
    organizationName = '';
    password = '';
    confirmPassword = '';
    marketingConsent = false;
    errorMessage = '';
    isSubmitting = false;
    authPopup = null;
    authPopupMonitorId = null;

    disconnectedCallback() {
        stopAuthPopupMonitor(this);
    }

    get submitButtonLabel() {
        return this.isSubmitting ? 'Creating Account\u2026' : 'Create Account';
    }

    handleInput(event) {
        const fieldName = event.target.dataset.field;
        this[fieldName] = event.target.value;
        this.errorMessage = '';
    }

    handleConsentChange(event) {
        this.marketingConsent = event.target.checked;
    }

    handleGoogleClick() {
        this.doOpenAuthPopup(this.googleAuthUrl, 'google-sign-in');
    }

    handleMicrosoftClick() {
        this.doOpenAuthPopup(this.microsoftAuthUrl, 'microsoft-sign-in');
    }

    async handleSubmit() {
        if (this.isSubmitting) {
            return;
        }

        this.errorMessage = '';

        const validationError = this.validateForm();
        if (validationError) {
            this.errorMessage = validationError;
            return;
        }

        this.isSubmitting = true;
        let registrationSucceeded = false;

        try {
            const req = {
                firstName: this.firstName.trim(),
                lastName: this.lastName.trim(),
                email: this.email.trim(),
                confirmEmail: this.confirmEmail.trim(),
                organizationName: this.organizationName.trim(),
                password: this.password,
                confirmPassword: this.confirmPassword,
                marketingConsent: this.marketingConsent
            };

            const result = await registerBuyer({ req });

            if (!result?.success) {
                throw new Error(result?.message || 'We could not create your account right now. Please try again.');
            }

            registrationSucceeded = true;
            this.submitLoginForm(result.redirectUrl || this.defaultStartUrl);
        } catch (error) {
            this.errorMessage = registrationSucceeded
                ? 'Your account was created, but we could not sign you in automatically. Please use the login form.'
                : error?.body?.message || error?.message || 'We could not submit your registration right now. Please try again.';
        } finally {
            this.isSubmitting = false;
        }
    }

    validateForm() {
        if (!this.firstName.trim()) {
            return 'Please enter your first name.';
        }

        if (!this.lastName.trim()) {
            return 'Please enter your last name.';
        }

        if (!this.email.trim()) {
            return 'Please enter your email address.';
        }

        if (!this.isValidEmail(this.email)) {
            return 'Please enter a valid email address.';
        }

        if (!this.confirmEmail.trim()) {
            return 'Please confirm your email address.';
        }

        if (this.email.trim().toLowerCase() !== this.confirmEmail.trim().toLowerCase()) {
            return 'Email and Confirm Email must match.';
        }

        if (!this.organizationName.trim()) {
            return 'Please enter your organization name.';
        }

        if (!this.password) {
            return 'Please enter a password.';
        }

        if (!this.isValidPassword(this.password)) {
            return 'Please use a password that meets all listed requirements.';
        }

        if (!this.confirmPassword) {
            return 'Please confirm your password.';
        }

        if (this.password !== this.confirmPassword) {
            return 'Password and Confirm Password must match.';
        }

        return '';
    }

    isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    }

    isValidPassword(value) {
        return (
            value.length >= 8 &&
            /[A-Z]/.test(value) &&
            /[a-z]/.test(value) &&
            /\d/.test(value) &&
            /[^A-Za-z0-9]/.test(value)
        );
    }

    submitLoginForm(startUrl) {
        const ownerDocument = this.template.host.ownerDocument;
        const form = ownerDocument.createElement('form');
        form.method = 'POST';
        form.action = this.getResolvedLoginActionUrl();

        appendHiddenInput(ownerDocument, form, 'username', this.email.trim());
        appendHiddenInput(ownerDocument, form, 'password', this.password);
        appendHiddenInput(ownerDocument, form, 'startURL', this.resolveRelativeUrl(startUrl, this.defaultStartUrl));

        ownerDocument.body.appendChild(form);
        form.submit();
    }

    getResolvedLoginActionUrl() {
        return this.resolveRelativeUrl(this.loginActionUrl, DEFAULT_LOGIN_ACTION_URL);
    }

    resolveRelativeUrl(url, fallback) {
        if (!url) {
            return fallback;
        }

        return normalizeInternalUrl(url) || normalizeInternalUrl(fallback) || fallback;
    }

    doOpenAuthPopup(url, popupName) {
        openAuthPopup(this, url, popupName, {
            buildAuthUrl: (rawUrl) => {
                const resolvedUrl = resolveAbsoluteUrl(rawUrl);
                if (!resolvedUrl) return '';
                try {
                    const authUrl = new URL(resolvedUrl);
                    authUrl.searchParams.set('startURL', this.resolveRelativeUrl(this.defaultStartUrl, DEFAULT_START_URL));
                    return authUrl.toString();
                } catch {
                    return resolvedUrl;
                }
            },
            onCompletion: (nextUrl) => {
                const expectedUrl = this.resolveRelativeUrl(this.defaultStartUrl, DEFAULT_START_URL);
                const normalized = normalizeInternalUrl(nextUrl);
                if (normalized === expectedUrl || isPopupLoginErrorUrl(new URL(nextUrl, globalThis.location.origin), this.getResolvedLoginActionUrl())) {
                    globalThis.location.assign(nextUrl);
                }
            }
        });
    }
}
