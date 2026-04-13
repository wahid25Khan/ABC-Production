import { LightningElement, api } from 'lwc';

const DEFAULT_PAGE_PATH_FRAGMENT = '/myprofile';

/**
 * Legacy placeholder kept only for backwards compatibility with any published
 * Experience Builder references that have not yet been republished.
 *
 * The account details page is now rendered by c:accountDetailsPage directly,
 * so this component intentionally renders nothing and performs no DOM mutation.
 */
export default class AccountProfilePageEnhancer extends LightningElement {
    @api pagePathFragment = DEFAULT_PAGE_PATH_FRAGMENT;
    @api heroTitle = 'My Account';
    @api heroDescription =
        'Manage your contact information, jump to key account tasks, and keep ordering details current for your school or district.';
    @api ordersUrl = '/AmericanBookCompany/my-orders';
    @api submitPoUrl = '/AmericanBookCompany/submit-a-po';
    @api wishlistUrl = 'https://americanbookcompany.com/account/my-wishlist';
}