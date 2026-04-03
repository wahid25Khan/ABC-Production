import { createElement } from 'lwc';
import AccountLoginForm from 'c/accountLoginForm';

jest.mock('@salesforce/user/isGuest', () => ({ default: true }), { virtual: true });

describe('c-account-login-form', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        delete globalThis.location;
        globalThis.location = {
            assign: jest.fn(),
            origin: 'https://americanbookcompany.my.site.com',
            search: '?startURL=%252FAmericanBookCompany%252Fmylists'
        };
        globalThis.open = jest.fn(() => ({
            closed: false,
            close: jest.fn(),
            focus: jest.fn(),
            location: {
                href: 'https://americanbookcompany.my.site.com/AmericanBookCompany/services/auth/sso/Google_Login'
            }
        }));
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

    it('opens Google sign-in in a popup window', () => {
        const element = createElement('c-account-login-form', {
            is: AccountLoginForm
        });
        document.body.appendChild(element);

        const buttons = element.shadowRoot.querySelectorAll('.social-button');
        buttons[0].click();

        expect(globalThis.open).toHaveBeenCalledWith(
            'https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmylists',
            'google-sign-in',
            expect.stringContaining('popup=yes')
        );
        expect(globalThis.location.assign).not.toHaveBeenCalled();
    });

    it('shows a provider-neutral OAuth error message', () => {
        globalThis.location.search = '?error=access_denied&startURL=%2FOauthFlowCallbackPage';

        const element = createElement('c-account-login-form', {
            is: AccountLoginForm
        });
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('.login-alert').textContent).toContain(
            'Social sign-in could not be completed.'
        );
    });
});