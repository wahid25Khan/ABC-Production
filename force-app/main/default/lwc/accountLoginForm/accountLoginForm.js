import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

const DEFAULT_GOOGLE_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';
const DEFAULT_MICROSOFT_AUTH_URL =
    'https://americanbookcompany.my.site.com/services/auth/sso/Microsoft_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile';
const AUTH_POPUP_WIDTH = 560;
const AUTH_POPUP_HEIGHT = 720;
const AUTH_POPUP_POLL_INTERVAL = 500;
const SOCIAL_SIGN_IN_ERROR_MESSAGE =
    'Social sign-in could not be completed. Please try again. If this is your first time, contact support if the issue continues.';

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
    authPopup = null;
    authPopupMonitorId = null;

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

    disconnectedCallback() {
        this.stopAuthPopupMonitor();
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

    handleGoogleClick() {
        this.openAuthPopup(this.googleAuthUrl, 'google-sign-in');
    }

    handleMicrosoftClick() {
        this.openAuthPopup(this.microsoftAuthUrl, 'microsoft-sign-in');
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
                ? SOCIAL_SIGN_IN_ERROR_MESSAGE
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

        return this.normalizeInternalUrl(startUrl) || this.normalizeInternalUrl(this.defaultStartUrl) || '/';
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
            authUrl.searchParams.set('startURL', this.getResolvedStartUrl());
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
        if (this.normalizeInternalUrl(relativeUrl) === this.getResolvedStartUrl()) {
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
}
