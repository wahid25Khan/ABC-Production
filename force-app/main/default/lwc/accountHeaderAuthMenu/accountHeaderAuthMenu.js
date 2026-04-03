import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

const DEFAULT_ACCOUNT_URL = '/AmericanBookCompany/myprofile';
const DEFAULT_LOGIN_URL = '/AmericanBookCompany/login';
const DEFAULT_HOME_URL = '/AmericanBookCompany/';
const DEFAULT_LOGOUT_PATH = '/AmericanBookCompany/secur/logout.jsp';

export default class AccountHeaderAuthMenu extends LightningElement {
    @api menuLabel = 'Account';
    @api loginLabel = 'Log In';
    @api accountLabel = 'My Account';
    @api logoutLabel = 'Log Out';
    @api accountUrl = DEFAULT_ACCOUNT_URL;
    @api loginUrl = DEFAULT_LOGIN_URL;
    @api logoutPath = DEFAULT_LOGOUT_PATH;
    @api logoutRedirectUrl = DEFAULT_HOME_URL;

    get isAuthenticated() {
        return !isGuest;
    }

    handleMenuSelect(event) {
        const selectedValue = event.detail?.value;

        if (selectedValue === 'account') {
            this.navigateTo(this.resolveUrl(this.accountUrl, DEFAULT_ACCOUNT_URL));
            return;
        }

        if (selectedValue === 'logout') {
            this.navigateTo(this.getLogoutUrl());
        }
    }

    handleLoginClick() {
        this.navigateTo(this.resolveUrl(this.loginUrl, DEFAULT_LOGIN_URL));
    }

    getLogoutUrl() {
        const resolvedLogoutPath = this.resolveUrl(this.logoutPath, DEFAULT_LOGOUT_PATH);
        const resolvedRedirectUrl = this.resolveUrl(this.logoutRedirectUrl, DEFAULT_HOME_URL);
        const separator = resolvedLogoutPath.includes('?') ? '&' : '?';
        const redirectParam = this.getLogoutRedirectParam(resolvedLogoutPath);

        return `${resolvedLogoutPath}${separator}${redirectParam}=${encodeURIComponent(resolvedRedirectUrl)}`;
    }

    getLogoutRedirectParam(logoutPath) {
        return String(logoutPath || '').includes('/secur/logout.jsp') ? 'retUrl' : 'startURL';
    }

    navigateTo(url) {
        globalThis.location.assign(url);
    }

    resolveUrl(url, fallbackUrl) {
        const candidate = String(url || fallbackUrl || '').trim();

        if (!candidate) {
            return '/';
        }

        if (candidate.startsWith('/')) {
            return candidate;
        }

        try {
            const parsed = new URL(candidate, globalThis.location.origin);
            return parsed.origin === globalThis.location.origin
                ? `${parsed.pathname}${parsed.search}${parsed.hash}`
                : fallbackUrl;
        } catch {
            return fallbackUrl;
        }
    }
}