import { LightningElement, api } from 'lwc';
import getWishlistPage from '@salesforce/apex/WishlistController.getWishlistPage';
import {
    DEFAULT_STORE_NAME,
    DEFAULT_WEBSTORE_ID,
    WISHLIST_UPDATED_EVENT_NAME
} from 'c/utils';

export default class AccountWishlistPage extends LightningElement {
    @api heading = 'My Wishlist';
    @api storeName = DEFAULT_STORE_NAME;
    @api webStoreId = DEFAULT_WEBSTORE_ID;

    isLoading = true;
    errorMessage = '';
    items = [];
    _copyLinkLabel = 'Copy link to share';
    _boundWishlistUpdatedHandler;
    _copyResetTimeout;

    connectedCallback() {
        if (!this._boundWishlistUpdatedHandler) {
            this._boundWishlistUpdatedHandler = this.handleWishlistUpdated.bind(this);
        }

        globalThis.addEventListener(
            WISHLIST_UPDATED_EVENT_NAME,
            this._boundWishlistUpdatedHandler
        );
        this.loadWishlist();
    }

    disconnectedCallback() {
        if (this._boundWishlistUpdatedHandler) {
            globalThis.removeEventListener(
                WISHLIST_UPDATED_EVENT_NAME,
                this._boundWishlistUpdatedHandler
            );
        }

        if (this._copyResetTimeout) {
            globalThis.clearTimeout(this._copyResetTimeout);
            this._copyResetTimeout = null;
        }
    }

    get hasItems() {
        return this.items.length > 0;
    }

    get showEmptyState() {
        return !this.isLoading && !this.errorMessage && !this.hasItems;
    }

    get shopAllUrl() {
        return `/${this.storeName}/global-search/all`;
    }

    get wishlistPageUrl() {
        return `${globalThis.location?.origin || ''}/${this.storeName}/native-mylists`;
    }

    get copyLinkLabel() {
        return this._copyLinkLabel;
    }

    /* ── Share / Copy handlers ── */

    handleShareEmail() {
        const subject = encodeURIComponent('Check out my wishlist');
        const body = encodeURIComponent(`Here's my wishlist: ${this.wishlistPageUrl}`);
        globalThis.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    }

    handleCopyLink() {
        const url = this.wishlistPageUrl;
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                this._copyLinkLabel = 'Link copied!';
                if (this._copyResetTimeout) {
                    globalThis.clearTimeout(this._copyResetTimeout);
                }

                // eslint-disable-next-line @lwc/lwc/no-async-operation
                this._copyResetTimeout = globalThis.setTimeout(() => {
                    this._copyLinkLabel = 'Copy link to share';
                    this._copyResetTimeout = null;
                }, 2000);
            });
        }
    }

    handleWishlistUpdated(event) {
        const detail = event?.detail || {};

        if (detail.webStoreId && detail.webStoreId !== this.webStoreId) {
            return;
        }

        this.loadWishlist();
    }

    async loadWishlist() {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            const result = await getWishlistPage({ webStoreId: this.webStoreId });
            if (!result?.success) {
                this.items = [];
                this.errorMessage = result?.message || 'Wishlist is currently unavailable.';
                return;
            }

            this.items = (result.items || []).filter((item) => Boolean(item?.productId));
        } catch (error) {
            this.items = [];
            this.errorMessage = this.normalizeError(error);
        } finally {
            this.isLoading = false;
        }
    }

    normalizeError(error) {
        if (error?.body?.message) {
            return error.body.message;
        }
        if (error?.message) {
            return error.message;
        }
        return 'Wishlist is currently unavailable.';
    }
}