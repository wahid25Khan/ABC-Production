import { LightningElement, api } from 'lwc';

const DEFAULT_LOGOUT_URL = '/AmericanBookCompany/secur/logout.jsp?retUrl=%2FAmericanBookCompany%2F';

export default class PortalLogoutRedirect extends LightningElement {
    @api logoutUrl = DEFAULT_LOGOUT_URL;

    connectedCallback() {
        globalThis.setTimeout(() => {
            globalThis.location.replace(this.logoutUrl || DEFAULT_LOGOUT_URL);
        }, 0);
    }
}