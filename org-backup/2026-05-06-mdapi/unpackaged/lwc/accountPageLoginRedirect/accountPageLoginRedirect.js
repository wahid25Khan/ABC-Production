import { LightningElement, api } from 'lwc';
import isGuest from '@salesforce/user/isGuest';

const DEFAULT_LOGIN_URL = '/AmericanBookCompany/login';

export default class AccountPageLoginRedirect extends LightningElement {
    @api loginUrl = DEFAULT_LOGIN_URL;
    @api pathsToGuard = '';

    connectedCallback() {
        if (!isGuest || !this.shouldRedirectCurrentPath()) {
            return;
        }

        const currentPath = `${globalThis.location?.pathname || '/'}${globalThis.location?.search || ''}${globalThis.location?.hash || ''}`;
        const resolvedLoginUrl = this.resolveInternalUrl(this.loginUrl) || DEFAULT_LOGIN_URL;
        const separator = resolvedLoginUrl.includes('?') ? '&' : '?';

        globalThis.location.replace(
            `${resolvedLoginUrl}${separator}startURL=${encodeURIComponent(currentPath)}`
        );
    }

    shouldRedirectCurrentPath() {
        const configuredPaths = this.parseGuardedPaths();
        if (!configuredPaths.length) {
            return true;
        }

        const currentPath = this.normalizePath(globalThis.location?.pathname || '/');
        return configuredPaths.includes(currentPath);
    }

    parseGuardedPaths() {
        return String(this.pathsToGuard || '')
            .split(/[\s,]+/)
            .map((value) => this.normalizePath(this.resolveInternalUrl(value) || value))
            .filter(Boolean);
    }

    normalizePath(path) {
        const trimmedPath = String(path || '').trim();
        if (!trimmedPath) {
            return '';
        }

        if (trimmedPath === '/') {
            return '/';
        }

        return trimmedPath.endsWith('/') ? trimmedPath.slice(0, -1) : trimmedPath;
    }

    resolveInternalUrl(url) {
        const candidate = String(url || '').trim();
        if (!candidate) {
            return '';
        }

        if (candidate.startsWith('/')) {
            return candidate;
        }

        try {
            const parsed = new URL(candidate, globalThis.location.origin);
            return parsed.origin === globalThis.location.origin
                ? `${parsed.pathname}${parsed.search}${parsed.hash}`
                : '';
        } catch {
            return '';
        }
    }
}