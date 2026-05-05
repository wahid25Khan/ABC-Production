import { LightningElement, api } from "lwc";
import isGuestUser from "@salesforce/user/isGuest";
import getWishlistPage from "@salesforce/apex/WishlistController.getWishlistPage";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";
import {
  addProductToCart,
  buildProductDetailPath,
  DEFAULT_STORE_NAME,
  DEFAULT_WEBSTORE_ID,
  dispatchWishlistUpdated,
  enforceWebsiteMinimumQuantity,
  fetchStorefrontProductDetails,
  normalizeImageUrl,
  parsePositiveInteger,
  resolveProductImageUrl,
  WISHLIST_UPDATED_EVENT_NAME
} from "c/utils";

export default class CartWishlistShelf extends LightningElement {
  @api heading = "Items on your wishlist";
  @api subheading = "(not included in order)";
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;

  _refreshKey;
  _isConnected = false;
  _boundWishlistUpdatedHandler;

  isGuest = isGuestUser;
  isLoading = false;
  errorMessage = "";
  items = [];

  @api
  get refreshKey() {
    return this._refreshKey;
  }

  set refreshKey(value) {
    this._refreshKey = value;
    if (this._isConnected) {
      this.loadWishlist();
    }
  }

  connectedCallback() {
    this._isConnected = true;
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
    globalThis.removeEventListener(
      WISHLIST_UPDATED_EVENT_NAME,
      this._boundWishlistUpdatedHandler
    );
  }

  get hasItems() {
    return this.items.length > 0;
  }

  get showSection() {
    return !this.isGuest && (this.isLoading || this.hasItems || Boolean(this.errorMessage));
  }

  handleWishlistUpdated(event) {
    const detail = event?.detail || {};
    if (detail.webStoreId && detail.webStoreId !== this.webStoreId) {
      return;
    }

    if (this._isConnected) {
      this.loadWishlist();
    }
  }

  async loadWishlist() {
    if (this.isGuest) {
      this.items = [];
      this.errorMessage = "";
      return;
    }

    this.isLoading = true;
    this.errorMessage = "";

    try {
      const result = await getWishlistPage({ webStoreId: this.webStoreId });
      if (!result?.success) {
        this.items = [];
        this.errorMessage = result?.message || "Wishlist is currently unavailable.";
        return;
      }

      const baseItems = (result.items || []).map((item) => ({
        wishlistItemId: item.wishlistItemId,
        productId: item.productId,
        productName: item.productName || "Product",
        detailPath: buildProductDetailPath(
          { id: item.productId, name: item.productName || "detail" },
          this.storeName
        ),
        imageUrl: "",
        minimumQuantity: enforceWebsiteMinimumQuantity(null),
        isMovingToCart: false,
        isRemoving: false,
        cardClass: "wishlist-card"
      }));

      this.items = baseItems;

      const productMap = await fetchStorefrontProductDetails({
        productIds: baseItems.map((item) => item.productId),
        storeName: this.storeName,
        webStoreId: this.webStoreId
      });

      this.items = baseItems.map((item) => {
        const product = productMap.get(item.productId);
        const minimumQuantity =
          enforceWebsiteMinimumQuantity(
            product?.purchaseQuantityRule?.minimum ??
              product?.purchaseQuantityRule?.Minimum
          );

        return {
          ...item,
          // imageUrl: normalizeImageUrl(resolveProductImageUrl(product)),
          imageUrl: resolveProductImageUrl(product),
          minimumQuantity,
          cardClass: item.isRemoving ? "wishlist-card removing" : "wishlist-card"
        };
      });
    } catch (error) {
      this.items = [];
      this.errorMessage = this.normalizeError(error);
    } finally {
      this.isLoading = false;
    }
  }

  async handleMoveToCart(event) {
    const productId = event.currentTarget.dataset.productId;
    if (!productId) {
      return;
    }

    const item = this.items.find((row) => row.productId === productId);
    if (!item || item.isMovingToCart) {
      return;
    }

    this.items = this.items.map((row) =>
      row.productId === productId
        ? { ...row, isMovingToCart: true }
        : row
    );
    this.errorMessage = "";

    try {
      const addResult = await addProductToCart({
        productId,
        quantity: item.minimumQuantity,
        storeName: this.storeName,
        webStoreId: this.webStoreId
      });

      if (!addResult?.ok) {
        throw addResult?.error || new Error("Unable to move the wishlist item to cart.");
      }

      const toggleResult = await toggleFavorite({
        productId,
        webStoreId: this.webStoreId
      });

      if (toggleResult?.success === false) {
        throw new Error(toggleResult?.message || "Unable to update wishlist.");
      }

      // Fade out the card before removing it from the list
      this.items = this.items.map((row) =>
        row.productId === productId
          ? { ...row, isRemoving: true, cardClass: "wishlist-card removing" }
          : row
      );

      // eslint-disable-next-line @lwc/lwc/no-async-operation
      await new Promise((resolve) => globalThis.setTimeout(resolve, 260));

      this.items = this.items.filter((row) => row.productId !== productId);
      this.errorMessage = "";
      dispatchWishlistUpdated({
        favorite: Boolean(toggleResult?.favorite),
        productId,
        webStoreId: this.webStoreId,
        wishlistId: toggleResult?.wishlistId || null,
        wishlistItemId: toggleResult?.wishlistItemId || null
      });
    } catch (error) {
      this.items = this.items.map((row) =>
        row.productId === productId
          ? { ...row, isMovingToCart: false }
          : row
      );
      this.errorMessage = this.normalizeError(error);
    }
  }

  normalizeError(error) {
    return (
      error?.body?.message ||
      error?.message ||
      "Something went wrong while loading wishlist items."
    );
  }
}