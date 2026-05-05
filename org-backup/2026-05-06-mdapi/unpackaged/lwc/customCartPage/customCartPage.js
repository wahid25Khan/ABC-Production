import { LightningElement, api, wire } from "lwc";
import isGuestUser from "@salesforce/user/isGuest";
import emptyCartBanner from "@salesforce/resourceUrl/EmptyCartBanner";
import getShippingRatePercent from "@salesforce/apex/ABCShippingCalculator.getShippingRatePercent";
import {
  CartItemsAdapter,
  CartSummaryAdapter,
  deleteItemFromCart,
  refreshCartSummary,
  updateItemInCart
} from "commerce/cartApi";
import getFavoriteState from "@salesforce/apex/WishlistController.getFavoriteState";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";
import {
  buildAddToCartEndpoint,
  buildCartIncludesLines,
  buildCartOrderSummaryLines,
  CART_UPDATED_EVENT_NAME,
  DEFAULT_STORE_NAME,
  DEFAULT_WEBSTORE_ID,
  dispatchWishlistUpdated,
  extractCartItems,
  fetchStorefrontProductDetails,
  formatCurrency,
  normalizeCartItem,
  normalizeCartSummary,
  normalizeQuantityToRule
} from "c/utils";

const LOGIN_PATH = "/login";
const CART_PAGE_CACHE_KEY = "abc_custom_cart_page_cache_v1";
const FADE_OUT_MS = 260;

function deriveCartItemClass(item) {
  return item?.isRemoving || item?.isMovingToWishlist
    ? "cart-item removing"
    : "cart-item";
}

let cartPageMemoryCache = {
  items: [],
  summary: null
};

function isProductCartLine(item) {
  return (
    String(item?.type || "Product")
      .trim()
      .toLowerCase() === "product"
  );
}

function cloneSerializable(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function restoreCartPageCache() {
  if (cartPageMemoryCache.items.length || cartPageMemoryCache.summary) {
    return {
      items: cloneSerializable(cartPageMemoryCache.items, []),
      summary: cloneSerializable(cartPageMemoryCache.summary, null)
    };
  }

  try {
    const raw = globalThis.sessionStorage?.getItem(CART_PAGE_CACHE_KEY);
    if (!raw) {
      return { items: [], summary: null };
    }

    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      summary: parsed?.summary || null
    };
  } catch {
    return { items: [], summary: null };
  }
}

function persistCartPageCache(items, summary) {
  const payload = {
    items: cloneSerializable(items, []),
    summary: cloneSerializable(summary, null)
  };

  cartPageMemoryCache = payload;

  try {
    globalThis.sessionStorage?.setItem(
      CART_PAGE_CACHE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage failures.
  }
}

function mergeCartItems(existingItems, incomingItems) {
  const existingById = new Map(
    (existingItems || []).map((item) => [item.id, item])
  );
  const incomingById = new Map(
    (incomingItems || []).map((item) => [item.id, item])
  );
  const merged = [];

  (existingItems || []).forEach((existingItem) => {
    const incomingItem = incomingById.get(existingItem.id);
    if (!incomingItem) {
      return;
    }

    const nextSnapshot = {
      ...existingItem,
      ...incomingItem,
      draftQuantity: existingItem.isUpdating
        ? existingItem.draftQuantity
        : incomingItem.draftQuantity,
      rowError: existingItem.rowError || "",
      isUpdating: existingItem.isUpdating || false,
      isRemoving: existingItem.isRemoving || false,
      isMovingToWishlist: existingItem.isMovingToWishlist || false
    };
    nextSnapshot.cartItemClass = deriveCartItemClass(nextSnapshot);

    const stableFieldsMatch =
      existingItem.productId === nextSnapshot.productId &&
      existingItem.productName === nextSnapshot.productName &&
      existingItem.formatLabel === nextSnapshot.formatLabel &&
      existingItem.quantity === nextSnapshot.quantity &&
      existingItem.draftQuantity === nextSnapshot.draftQuantity &&
      existingItem.unitPriceLabel === nextSnapshot.unitPriceLabel &&
      existingItem.lineTotalLabel === nextSnapshot.lineTotalLabel &&
      existingItem.bulkPricingLabel === nextSnapshot.bulkPricingLabel &&
      existingItem.imageUrl === nextSnapshot.imageUrl &&
      existingItem.rowError === nextSnapshot.rowError &&
      existingItem.isUpdating === nextSnapshot.isUpdating &&
      existingItem.isRemoving === nextSnapshot.isRemoving &&
      existingItem.isMovingToWishlist === nextSnapshot.isMovingToWishlist;

    merged.push(stableFieldsMatch ? existingItem : nextSnapshot);
  });

  (incomingItems || []).forEach((incomingItem) => {
    const existingItem = existingById.get(incomingItem.id);
    if (!existingItem) {
      merged.push({
        ...incomingItem,
        cartItemClass: deriveCartItemClass(incomingItem)
      });
    }
  });

  return merged;
}

export default class CustomCartPage extends LightningElement {
  @api heading = "Your Cart";
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api checkoutUrl = "/checkout";
  @api poSubmissionUrl = "/submit-a-po";

  isGuest = isGuestUser;
  isLoadingItems = true;
  isLoadingSummary = true;
  hasResolvedInitialItems = false;
  hasResolvedInitialSummary = false;
  errorMessage = "";
  cartItems = [];
  summary = normalizeCartSummary({});
  wishlistRefreshKey = 0;
  emptyCartBannerUrl = emptyCartBanner;
  shippingRatePercent = 0;
  isLoadingShipping = true;
  hasResolvedInitialShipping = false;
  _boundCartUpdatedHandler;
  _cartItemsRequestId = 0;

  connectedCallback() {
    const cached = restoreCartPageCache();
    const hasCachedItems =
      Array.isArray(cached.items) && cached.items.length > 0;
    const hasCachedSummary = Boolean(cached.summary);

    if (hasCachedItems) {
      this.cartItems = cached.items;
      this.isLoadingItems = false;
      this.hasResolvedInitialItems = true;
    }

    if (hasCachedSummary) {
      this.summary = cached.summary;
      this.isLoadingSummary = false;
      this.hasResolvedInitialSummary = true;
    }

    this.loadShippingRatePercent();

    if (!this._boundCartUpdatedHandler) {
      this._boundCartUpdatedHandler = this.handleExternalCartUpdated.bind(this);
    }

    globalThis.addEventListener(
      CART_UPDATED_EVENT_NAME,
      this._boundCartUpdatedHandler
    );
  }

  disconnectedCallback() {
    globalThis.removeEventListener(
      CART_UPDATED_EVENT_NAME,
      this._boundCartUpdatedHandler
    );
  }

  @wire(CartItemsAdapter)
  wiredCartItems({ data, error }) {
    if (!data && !error) {
      return;
    }

    this.isLoadingItems = false;
    this.hasResolvedInitialItems = true;

    if (error) {
      this.isLoadingShipping = false;
      this.hasResolvedInitialShipping = true;
      this.errorMessage = this.normalizeError(error);
      return;
    }

    this.errorMessage = "";
    this.applyCartItemsPayload(data).catch(() => {
      this.errorMessage =
        this.errorMessage || "Something went wrong while loading the cart.";
    });
  }

  @wire(CartSummaryAdapter)
  wiredCartSummary({ data, error }) {
    if (!data && !error) {
      return;
    }

    this.isLoadingSummary = false;
    this.hasResolvedInitialSummary = true;

    if (error) {
      if (!this.errorMessage) {
        this.errorMessage = this.normalizeError(error);
      }
      return;
    }

    this.summary = this.buildOptimisticSummary(
      this.cartItems,
      normalizeCartSummary(data)
    );
    persistCartPageCache(this.cartItems, this.summary);
  }

  get isLoading() {
    return (
      this.isLoadingItems || this.isLoadingSummary || this.isLoadingShipping
    );
  }

  get showInitialLoadingState() {
    return this.isLoading && !this.hasItems;
  }

  get hasItems() {
    return this.cartItems.length > 0;
  }

  get showEmptyState() {
    return (
      this.hasResolvedInitialItems &&
      this.hasResolvedInitialShipping &&
      !this.isLoading &&
      !this.errorMessage &&
      !this.hasItems
    );
  }

  get orderSummaryLines() {
    return buildCartOrderSummaryLines(this.cartItems);
  }

  get hasOrderSummaryLines() {
    return this.orderSummaryLines.length > 0;
  }

  get showShippingLine() {
    return this.summary.shipping !== null;
  }

  async handleExternalCartUpdated() {
    await this.refreshCartItemsFromServer();
    try {
      await refreshCartSummary();
    } catch {
      // Keep the optimistic summary if the wire refresh is delayed.
    }
  }

  handleQuantityInput(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const draftQuantity = event.target.value;

    this.cartItems = this.cartItems.map((item) => {
      return item.id === itemId ? { ...item, draftQuantity } : item;
    });
    persistCartPageCache(this.cartItems, this.summary);
  }

  handleQuantityBlur(event) {
    const itemId = event.currentTarget.dataset.itemId;
    this.commitQuantity(itemId);
  }

  handleQuantityChange(event) {
    const itemId = event.currentTarget.dataset.itemId;
    this.commitQuantity(itemId);
  }

  handleQuantityKeydown(event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    this.commitQuantity(itemId);
  }

  async commitQuantity(itemId) {
    const item = this.cartItems.find((row) => row.id === itemId);
    if (!item || item.isUpdating) {
      return;
    }

    const normalizedQuantity = normalizeQuantityToRule(
      item.draftQuantity,
      item.quantityRule
    );

    if (
      normalizedQuantity === item.quantity &&
      String(normalizedQuantity) === item.draftQuantity
    ) {
      return;
    }

    this.updateItemState(itemId, {
      isUpdating: true,
      draftQuantity: String(normalizedQuantity),
      rowError: ""
    });

    try {
      await updateItemInCart(itemId, normalizedQuantity);
      await refreshCartSummary();
      const refreshed = await this.refreshCartItemsFromServer();

      if (!refreshed) {
        const lineTotal = item.unitPrice * normalizedQuantity;
        this.updateItemState(itemId, {
          quantity: normalizedQuantity,
          draftQuantity: String(normalizedQuantity),
          lineTotal,
          lineTotalLabel: formatCurrency(lineTotal, item.currencyIsoCode),
          includesLines: buildCartIncludesLines(
            item.formatLabel,
            normalizedQuantity
          ),
          bulkPricingApplied: normalizedQuantity >= item.quantityRule.minimum,
          bulkPricingClass:
            normalizedQuantity >= item.quantityRule.minimum
              ? "bulk-label bulk-applied"
              : "bulk-label",
          bulkPricingLabel:
            normalizedQuantity >= item.quantityRule.minimum
              ? "Bulk Pricing Applied"
              : `+${
                  item.quantityRule.minimum - normalizedQuantity
                } copies for volume discounts`
        });
        this.summary = this.buildOptimisticSummary(this.cartItems);
        persistCartPageCache(this.cartItems, this.summary);
      }
    } catch (error) {
      this.updateItemState(itemId, {
        draftQuantity: String(item.quantity),
        rowError: this.normalizeError(error)
      });
    } finally {
      this.updateItemState(itemId, { isUpdating: false });
    }
  }

  async handleRemoveFromCart(event) {
    const itemId = event.currentTarget.dataset.itemId;
    if (!itemId) {
      return;
    }

    this.updateItemState(itemId, {
      isRemoving: true,
      rowError: ""
    });

    try {
      await deleteItemFromCart(itemId);
      await refreshCartSummary();

      await new Promise((resolve) =>
        globalThis.setTimeout(resolve, FADE_OUT_MS)
      );

      this.cartItems = this.cartItems.filter((item) => item.id !== itemId);
      this.summary = this.buildOptimisticSummary(this.cartItems);
      persistCartPageCache(this.cartItems, this.summary);
    } catch (error) {
      this.updateItemState(itemId, {
        isRemoving: false,
        rowError: this.normalizeError(error)
      });
    } finally {
      this.updateItemState(itemId, { isRemoving: false });
    }
  }

  async handleMoveToWishlist(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const productId = event.currentTarget.dataset.productId;
    if (!itemId || !productId) {
      return;
    }

    if (this.isGuest) {
      const startUrl = `${globalThis.location?.pathname || ""}${globalThis.location?.search || ""}${globalThis.location?.hash || ""}`;
      globalThis.location.assign(
        `/${this.storeName}${LOGIN_PATH}?startURL=${encodeURIComponent(startUrl)}`
      );
      return;
    }

    this.updateItemState(itemId, {
      isMovingToWishlist: true,
      rowError: ""
    });

    try {
      const favoriteState = await getFavoriteState({
        productId,
        webStoreId: this.webStoreId
      });

      if (!favoriteState?.favorite) {
        const toggleResult = await toggleFavorite({
          productId,
          webStoreId: this.webStoreId
        });

        if (toggleResult?.success === false) {
          throw new Error(
            toggleResult?.message || "Unable to update wishlist."
          );
        }

        dispatchWishlistUpdated({
          favorite: Boolean(toggleResult?.favorite),
          productId,
          webStoreId: this.webStoreId,
          wishlistId: toggleResult?.wishlistId || null,
          wishlistItemId: toggleResult?.wishlistItemId || null
        });
      }

      await deleteItemFromCart(itemId);
      await refreshCartSummary();

      await new Promise((resolve) =>
        globalThis.setTimeout(resolve, FADE_OUT_MS)
      );

      this.cartItems = this.cartItems.filter((item) => item.id !== itemId);
      this.summary = this.buildOptimisticSummary(this.cartItems);
      this.wishlistRefreshKey = Date.now();
      persistCartPageCache(this.cartItems, this.summary);
    } catch (error) {
      this.updateItemState(itemId, {
        rowError: this.normalizeError(error)
      });
    } finally {
      this.updateItemState(itemId, { isMovingToWishlist: false });
    }
  }

  updateItemState(itemId, patch) {
    this.cartItems = this.cartItems.map((item) => {
      if (item.id !== itemId) {
        return item;
      }
      const updated = { ...item, ...patch };
      updated.cartItemClass = deriveCartItemClass(updated);
      return updated;
    });
    persistCartPageCache(this.cartItems, this.summary);
  }

  buildOptimisticSummary(items, baseSummary = this.summary) {
    const currentSummary =
      baseSummary && typeof baseSummary === "object" ? baseSummary : {};
    const currencyIsoCode =
      currentSummary.currencyIsoCode || items[0]?.currencyIsoCode || "USD";
    const subtotal = (items || []).reduce((runningTotal, item) => {
      const lineTotal =
        Number.isFinite(item?.lineTotal) && item.lineTotal >= 0
          ? item.lineTotal
          : (item?.unitPrice || 0) * (item?.quantity || 0);

      return runningTotal + lineTotal;
    }, 0);
    const shipping = this.hasResolvedInitialShipping
      ? Number(((subtotal * (this.shippingRatePercent || 0)) / 100).toFixed(2))
      : typeof currentSummary.shipping === "number"
        ? currentSummary.shipping
        : null;
    const salesTax =
      typeof currentSummary.salesTax === "number" ? currentSummary.salesTax : 0;

    return {
      ...currentSummary,
      currencyIsoCode,
      subtotal,
      shipping,
      salesTax,
      total: subtotal + (shipping ?? 0) + salesTax,
      subtotalLabel: formatCurrency(subtotal, currencyIsoCode),
      shippingLabel:
        shipping === null ? "" : formatCurrency(shipping, currencyIsoCode),
      salesTaxLabel: formatCurrency(salesTax, currencyIsoCode),
      totalLabel: formatCurrency(
        subtotal + (shipping ?? 0) + salesTax,
        currencyIsoCode
      )
    };
  }

  async loadShippingRatePercent() {
    this.isLoadingShipping = true;

    try {
      const ratePercent = await getShippingRatePercent();
      this.shippingRatePercent = Number.isFinite(Number(ratePercent))
        ? Number(ratePercent)
        : 0;
    } catch {
      this.shippingRatePercent = 0;
    } finally {
      this.isLoadingShipping = false;
      this.hasResolvedInitialShipping = true;
      this.summary = this.buildOptimisticSummary(this.cartItems);
      persistCartPageCache(this.cartItems, this.summary);
    }
  }

  async refreshCartItemsFromServer() {
    if (!this.webStoreId) {
      return false;
    }

    try {
      const response = await fetch(
        buildAddToCartEndpoint({
          storeName: this.storeName,
          webStoreId: this.webStoreId,
          cartStateOrId: "current",
          asGuest: this.isGuest
        }),
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return this.applyCartItemsPayload(data);
    } catch {
      return false;
    }
  }

  async applyCartItemsPayload(data) {
    const requestId = ++this._cartItemsRequestId;
    const sourceItems = extractCartItems(data).filter((item) =>
      isProductCartLine(item)
    );
    const productIds = [
      ...new Set(
        sourceItems.map((item) => this.getProductId(item)).filter(Boolean)
      )
    ];

    let productMap = new Map();
    if (productIds.length && this.webStoreId) {
      productMap = await fetchStorefrontProductDetails({
        productIds,
        storeName: this.storeName,
        webStoreId: this.webStoreId
      });
    }

    if (requestId !== this._cartItemsRequestId) {
      return false;
    }

    const nextItems = sourceItems.map((item) =>
      normalizeCartItem(item, {
        storeName: this.storeName,
        fallbackProductDetails: productMap.get(this.getProductId(item))
      })
    );

    this.cartItems = mergeCartItems(this.cartItems, nextItems);
    this.summary = this.buildOptimisticSummary(this.cartItems);
    persistCartPageCache(this.cartItems, this.summary);
    return true;
  }

  getProductId(item) {
    return String(
      item?.productId || item?.productDetails?.productId || ""
    ).trim();
  }

  normalizeError(error) {
    return (
      error?.body?.message ||
      error?.message ||
      "Something went wrong while updating the cart."
    );
  }

  addHoverClassHandler(event) {
    event.currentTarget.classList.add("show-arrows");
  }

  removeHoverClassHandler(event) {
    event.currentTarget.classList.remove("show-arrows");
  }
}