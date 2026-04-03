import { createElement } from 'lwc';
import AccountLoginFormPopup from 'c/accountLoginFormPopup';

jest.mock('@salesforce/user/isGuest', () => ({ default: true }), { virtual: true });

describe('c-account-login-form-popup', () => {
    let popupHandle;

    beforeEach(() => {
        jest.useFakeTimers();
        popupHandle = {
            closed: false,
            close: jest.fn(),
            focus: jest.fn(),
            location: {
                href: 'https://americanbookcompany.my.site.com/AmericanBookCompany/services/auth/sso/Google_Login'
            }
        };

        delete globalThis.location;
        globalThis.location = {
            assign: jest.fn(),
            origin: 'https://americanbookcompany.my.site.com',
            search: '?startURL=%252FAmericanBookCompany%252Fmylists'
        };
        globalThis.open = jest.fn(() => popupHandle);
        globalThis.screenLeft = 0;
        globalThis.screenTop = 0;
        globalThis.outerWidth = 1440;
        globalThis.outerHeight = 900;
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.firstChild.remove();
        }
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('uses the login page startURL for Google auth', () => {
        const element = createElement('c-account-login-form-popup', {
            is: AccountLoginFormPopup
        });
        document.body.appendChild(element);

        element.shadowRoot.querySelector('.social-button').click();

        expect(globalThis.open).toHaveBeenCalledWith(
            'https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmylists',
            'google-sign-in',
            expect.stringContaining('popup=yes')
        );
    });

    it('opens Microsoft sign-in with the same startURL handling', () => {
        const element = createElement('c-account-login-form-popup', {
            is: AccountLoginFormPopup
        });
        document.body.appendChild(element);

        const buttons = element.shadowRoot.querySelectorAll('.social-button');
        buttons[1].click();

        expect(globalThis.open).toHaveBeenCalledWith(
            'https://americanbookcompany.my.site.com/services/auth/sso/Microsoft_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmylists',
            'microsoft-sign-in',
            expect.stringContaining('popup=yes')
        );
    });

    it('closes the popup and redirects the opener when auth returns to the target page', () => {
        const element = createElement('c-account-login-form-popup', {
            is: AccountLoginFormPopup
        });
        document.body.appendChild(element);

        element.shadowRoot.querySelector('.social-button').click();
        popupHandle.location.href = 'https://americanbookcompany.my.site.com/AmericanBookCompany/mylists';

        jest.advanceTimersByTime(500);

        expect(popupHandle.close).toHaveBeenCalled();
        expect(globalThis.location.assign).toHaveBeenCalledWith('/AmericanBookCompany/mylists');
    });

    it('shows a provider-neutral OAuth error message', () => {
        globalThis.location.search = '?error=access_denied&startURL=%2FOauthFlowCallbackPage';

        const element = createElement('c-account-login-form-popup', {
            is: AccountLoginFormPopup
        });
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('.login-alert').textContent).toContain(
            'Social sign-in could not be completed.'
        );
    });
});