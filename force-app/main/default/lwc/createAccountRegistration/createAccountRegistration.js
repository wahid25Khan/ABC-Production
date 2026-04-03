import { LightningElement, api } from 'lwc';
import registerBuyer from '@salesforce/apex/BuyerSelfRegistrationService.registerBuyer';

const DEFAULT_GOOGLE_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';
const DEFAULT_MICROSOFT_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Microsoft_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';
const DEFAULT_LOGIN_ACTION_URL = '/AmericanBookCompany/login';
const DEFAULT_START_URL = '/myprofile';
const AUTH_POPUP_WIDTH = 560;
const AUTH_POPUP_HEIGHT = 720;
const AUTH_POPUP_POLL_INTERVAL = 500;

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
        this.stopAuthPopupMonitor();
    }

    get submitButtonLabel() {
        return this.isSubmitting ? 'Creating Account…' : 'Create Account';
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
        this.openAuthPopup(this.googleAuthUrl, 'google-sign-in');
    }

    handleMicrosoftClick() {
        this.openAuthPopup(this.microsoftAuthUrl, 'microsoft-sign-in');
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
            console.warn('Unable to create the shopper account.', error);
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

        this.appendHiddenInput(ownerDocument, form, 'username', this.email.trim());
        this.appendHiddenInput(ownerDocument, form, 'password', this.password);
        this.appendHiddenInput(ownerDocument, form, 'startURL', this.resolveRelativeUrl(startUrl, this.defaultStartUrl));

        ownerDocument.body.appendChild(form);
        form.submit();
    }

    appendHiddenInput(ownerDocument, form, name, value) {
        const input = ownerDocument.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }

    getResolvedLoginActionUrl() {
        return this.resolveRelativeUrl(this.loginActionUrl, DEFAULT_LOGIN_ACTION_URL);
    }

    resolveRelativeUrl(url, fallback) {
        if (!url) {
            return fallback;
        }

        return this.normalizeInternalUrl(url) || this.normalizeInternalUrl(fallback) || fallback;
    }

    openAuthPopup(url, popupName) {
        const resolvedUrl = this.buildAuthUrl(url);
        if (!resolvedUrl) {
            return;
        }

        const popup = globalThis.open?.(
            resolvedUrl,
            popupName,
            this.getPopupWindowFeatures()
        );

        if (popup && typeof popup.focus === 'function') {
            this.startAuthPopupMonitor(popup);
            popup.focus();
            return;
        }

        globalThis.location.assign(resolvedUrl);
    }

    buildAuthUrl(url) {
        const resolvedUrl = this.resolveAbsoluteUrl(url);
        if (!resolvedUrl) {
            return '';
        }

        try {
            const authUrl = new URL(resolvedUrl);
            authUrl.searchParams.set('startURL', this.resolveRelativeUrl(this.defaultStartUrl, DEFAULT_START_URL));
            return authUrl.toString();
        } catch {
            return resolvedUrl;
        }
    }

    resolveAbsoluteUrl(url) {
        if (!url) {
            return '';
        }

        try {
            return new URL(url, globalThis.location.origin).toString();
        } catch {
            return '';
        }
    }

    startAuthPopupMonitor(popup) {
        this.stopAuthPopupMonitor();
        this.authPopup = popup;
        this.authPopupMonitorId = globalThis.setInterval(() => {
            const nextUrl = this.getAuthPopupCompletionUrl();
            if (nextUrl) {
                this.stopAuthPopupMonitor();
                try {
                    popup.close?.();
                } catch {
                    // ignore
                }
                globalThis.location.assign(nextUrl);
                return;
            }

            if (popup.closed) {
                this.stopAuthPopupMonitor();
            }
        }, AUTH_POPUP_POLL_INTERVAL);
    }

    stopAuthPopupMonitor() {
        if (this.authPopupMonitorId) {
            globalThis.clearInterval(this.authPopupMonitorId);
            this.authPopupMonitorId = null;
        }

        this.authPopup = null;
    }

    getAuthPopupCompletionUrl() {
        const popup = this.authPopup;
        if (!popup || popup.closed) {
            return '';
        }

        let popupUrl;
        try {
            popupUrl = new URL(popup.location.href);
        } catch {
            return '';
        }

        if (popupUrl.origin !== globalThis.location.origin) {
            return '';
        }

        if (popupUrl.pathname.includes('/services/auth/')) {
            return '';
        }

        const relativeUrl = `${popupUrl.pathname}${popupUrl.search}${popupUrl.hash}`;
        const expectedUrl = this.resolveRelativeUrl(this.defaultStartUrl, DEFAULT_START_URL);
        if (this.normalizeInternalUrl(relativeUrl) === expectedUrl) {
            return relativeUrl;
        }

        if (this.isPopupLoginErrorUrl(popupUrl)) {
            return relativeUrl;
        }

        return '';
    }

    isPopupLoginErrorUrl(popupUrl) {
        const loginUrl = this.resolveAbsoluteUrl(this.getResolvedLoginActionUrl());
        if (!loginUrl) {
            return false;
        }

        const loginPath = new URL(loginUrl).pathname;
        if (popupUrl.pathname !== loginPath) {
            return false;
        }

        const params = popupUrl.searchParams;
        return params.has('error') || params.has('loginError') || params.has('ec');
    }

    normalizeInternalUrl(value) {
        const decodedValue = this.decodeUrlValue(value);
        if (!decodedValue) {
            return '';
        }

        if (decodedValue.startsWith('/')) {
            const basePath = this.getSiteBasePath();
            if (basePath && decodedValue !== basePath && !decodedValue.startsWith(`${basePath}/`)) {
                return `${basePath}${decodedValue}`;
            }
            return decodedValue;
        }

        try {
            const parsed = new URL(decodedValue, globalThis.location.origin);
            return parsed.origin === globalThis.location.origin
                ? `${parsed.pathname}${parsed.search}${parsed.hash}`
                : '';
        } catch {
            return '';
        }
    }

    decodeUrlValue(value) {
        let decoded = String(value || '').trim();
        if (!decoded) {
            return '';
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                const nextValue = decodeURIComponent(decoded);
                if (nextValue === decoded) {
                    break;
                }
                decoded = nextValue.trim();
            } catch {
                break;
            }
        }

        return decoded;
    }

    getSiteBasePath() {
        const currentPath = String(globalThis.location?.pathname || '').trim();
        const segments = currentPath.split('/').filter(Boolean);
        return segments.length ? `/${segments[0]}` : '';
    }

    getPopupWindowFeatures() {
        const screenLeft = globalThis.screenLeft ?? globalThis.screenX ?? 0;
        const screenTop = globalThis.screenTop ?? globalThis.screenY ?? 0;
        const outerWidth = globalThis.outerWidth || globalThis.screen?.availWidth || 1280;
        const outerHeight = globalThis.outerHeight || globalThis.screen?.availHeight || 800;
        const left = Math.max(screenLeft + Math.round((outerWidth - AUTH_POPUP_WIDTH) / 2), 0);
        const top = Math.max(screenTop + Math.round((outerHeight - AUTH_POPUP_HEIGHT) / 2), 0);

        return [
            'popup=yes',
            'resizable=yes',
            'scrollbars=yes',
            `width=${AUTH_POPUP_WIDTH}`,
            `height=${AUTH_POPUP_HEIGHT}`,
            `left=${left}`,
            `top=${top}`
        ].join(',');
    }
}
