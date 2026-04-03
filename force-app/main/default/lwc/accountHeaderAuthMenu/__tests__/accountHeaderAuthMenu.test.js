import { createElement } from 'lwc';
import AccountHeaderAuthMenu from 'c/accountHeaderAuthMenu';

jest.mock('@salesforce/user/isGuest', () => ({ default: false }), { virtual: true });

describe('c-account-header-auth-menu', () => {
    beforeEach(() => {
        delete globalThis.location;
        globalThis.location = {
            assign: jest.fn(),
            origin: 'https://americanbookcompany.my.site.com'
        };
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.firstChild.remove();
        }
        jest.clearAllMocks();
    });

    it('navigates to my account when the account menu item is selected', () => {
        const element = createElement('c-account-header-auth-menu', {
            is: AccountHeaderAuthMenu
        });
        document.body.appendChild(element);

        const menu = element.shadowRoot.querySelector('lightning-button-menu');
        menu.dispatchEvent(
            new CustomEvent('select', {
                detail: { value: 'account' }
            })
        );

        expect(globalThis.location.assign).toHaveBeenCalledWith('/AmericanBookCompany/myprofile');
    });

    it('navigates to logout with the home page as retUrl', () => {
        const element = createElement('c-account-header-auth-menu', {
            is: AccountHeaderAuthMenu
        });
        document.body.appendChild(element);

        const menu = element.shadowRoot.querySelector('lightning-button-menu');
        menu.dispatchEvent(
            new CustomEvent('select', {
                detail: { value: 'logout' }
            })
        );

        expect(globalThis.location.assign).toHaveBeenCalledWith(
            '/AmericanBookCompany/secur/logout.jsp?retUrl=%2FAmericanBookCompany%2F'
        );
    });
});