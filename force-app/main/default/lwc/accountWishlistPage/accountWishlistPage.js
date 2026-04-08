import { LightningElement, api } from "lwc";
import getWishlistPage from "@salesforce/apex/WishlistController.getWishlistPage";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";
import {
  buildProductDetailPath,
  DEFAULT_STORE_NAME,
  DEFAULT_WEBSTORE_ID,
  resolveProductImageUrl,
  normalizeImageUrl,
  extractPricingMap,
  formatCurrency,
  resolveStockKeepingUnit
} from "c/utils";

const PRODUCT_BATCH_SIZE = 20;
const PRICING_BATCH_SIZE = 200;
const PRODUCT_FIELDS = ["StockKeepingUnit", "Name"];

export default class AccountWishlistPage extends LightningElement {
  @api heading = "My Wishlist";
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;

  isLoading = true;
  isHydrating = false;
  errorMessage = "";
  items = [];
  pendingProductId = "";
  _productIdParamName = "";
  _copyLinkLabel = "Copy link to share";

  connectedCallback() {
    this.loadWishlist();
  }

  get hasItems() {
    return this.items.length > 0;
  }

  get showEmptyState() {
    return !this.isLoading && !this.errorMessage && !this.hasItems;
  }

  get itemCountLabel() {
    return `${this.items.length} item${this.items.length === 1 ? "" : "s"}`;
  }

  get shopAllUrl() {
    return `/${this.storeName}/global-search/all`;
  }

  get wishlistPageUrl() {
    return `${globalThis.location?.origin || ""}/${this.storeName}/native-mylists`;
  }

  get copyLinkLabel() {
    return this._copyLinkLabel;
  }

  /* ── Share / Copy handlers ── */

  handleShareEmail() {
    const subject = encodeURIComponent("Check out my wishlist");
    const body = encodeURIComponent(
      `Here's my wishlist: ${this.wishlistPageUrl}`
    );
    globalThis.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  }

  handleCopyLink() {
    const url = this.wishlistPageUrl;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this._copyLinkLabel = "Link copied!";
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
          this._copyLinkLabel = "Copy link to share";
        }, 2000);
      });
    }
  }

  /* ── Phase 1: Apex + Phase 2: Commerce REST hydration ── */

  async loadWishlist() {
    this.isLoading = true;
    this.errorMessage = "";

    try {
      const result = await getWishlistPage({ webStoreId: this.webStoreId });
      if (!result?.success) {
        this.items = [];
        this.errorMessage =
          result?.message || "Wishlist is currently unavailable.";
        return;
      }

      const rawItems = result.items || [];
      if (!rawItems.length) {
        this.items = [];
        return;
      }

      const baseItems = rawItems.map((item) => ({
        ...item,
        detailPath: buildProductDetailPath(
          { id: item.productId, name: item.productName },
          this.storeName
        ),
        imageUrl: "",
        priceLabel: "",
        startingPrice: null,
        currencyIsoCode: "USD",
        sku: item.stockKeepingUnit || "",
        isRemoving: false
      }));

      this.items = baseItems;
      this.isLoading = false;
      this.isHydrating = true;

      const productIds = rawItems.map((item) => item.productId).filter(Boolean);

      const [productMap, pricingMap] = await Promise.all([
        this.fetchProductDetails(productIds),
        this.fetchPricing(productIds)
      ]);

      this.items = baseItems.map((item) => {
        const detail = productMap.get(item.productId);
        const pricing = pricingMap.get(item.productId);

        let imageUrl = "";
        if (detail) {
          const rawUrl = resolveProductImageUrl(detail);
          imageUrl = rawUrl ? normalizeImageUrl(rawUrl) : "";
        }

        let startingPrice = null;
        let currencyIsoCode = "USD";
        if (pricing) {
          startingPrice =
            pricing.unitPrice ??
            pricing.salesPrice ??
            pricing.negotiatedPrice ??
            pricing.listPrice ??
            null;
          currencyIsoCode = pricing.currencyIsoCode || "USD";
        }

        const sku = (detail ? resolveStockKeepingUnit(detail) : "") || item.sku;

        return {
          ...item,
          imageUrl,
          startingPrice,
          currencyIsoCode,
          sku,
          priceLabel:
            startingPrice === null
              ? ""
              : formatCurrency(startingPrice, currencyIsoCode)
        };
      });
    } catch (error) {
      this.items = [];
      this.errorMessage = this.normalizeError(error);
    } finally {
      this.pendingProductId = "";
      this.isLoading = false;
      this.isHydrating = false;
    }
  }

  /* ── Remove handler ── */

  async handleRemove(event) {
    const productId = event.currentTarget.dataset.productId;
    if (!productId || this.pendingProductId) {
      return;
    }

    this.pendingProductId = productId;
    this.items = this.items.map((item) => ({
      ...item,
      isRemoving: item.productId === productId
    }));

    try {
      const result = await toggleFavorite({
        productId,
        webStoreId: this.webStoreId
      });
      if (!result?.success) {
        throw new Error(result?.message || "Unable to update wishlist.");
      }

      await this.loadWishlist();
    } catch (error) {
      this.pendingProductId = "";
      this.items = this.items.map((item) => ({ ...item, isRemoving: false }));
      this.errorMessage = this.normalizeError(error);
    }
  }

  /* ── Commerce REST: product details (images) ── */

  async fetchProductDetails(productIds) {
    const uniqueIds = [...new Set(productIds)];
    if (!uniqueIds.length) return new Map();

    const batches = this.chunkArray(uniqueIds, PRODUCT_BATCH_SIZE);
    const merged = new Map();

    const batchMaps = await Promise.all(
      batches.map((batch) => this.fetchProductBatch(batch))
    );

    for (const batchMap of batchMaps) {
      batchMap.forEach((value, key) => merged.set(key, value));
    }
    return merged;
  }

  async fetchProductBatch(productIds) {
    const paramNames = this._productIdParamName
      ? [this._productIdParamName]
      : ["ids", "productIds"];

    for (const paramName of paramNames) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(
          this.buildProductsEndpoint(productIds, paramName),
          { method: "GET", credentials: "include" }
        );

        if (!response.ok) continue;

        // eslint-disable-next-line no-await-in-loop
        const data = await response.json();
        const rows =
          data?.products ||
          data?.productCollection?.products ||
          data?.productPage?.products ||
          data?.productsPage?.products ||
          [];

        const map = new Map();
        for (const item of Array.isArray(rows) ? rows : []) {
          const id = String(item?.id || "").trim();
          if (id) map.set(id, item);
        }

        if (map.size) {
          this._productIdParamName = paramName;
          return map;
        }
      } catch {
        /* try next param name */
      }
    }
    return new Map();
  }

  /* ── Commerce REST: pricing ── */

  async fetchPricing(productIds) {
    const uniqueIds = [...new Set(productIds)];
    if (!uniqueIds.length) return new Map();

    const batches = this.chunkArray(uniqueIds, PRICING_BATCH_SIZE);
    const merged = new Map();

    const batchMaps = await Promise.all(
      batches.map(async (batch) => {
        try {
          const response = await fetch(this.buildPricingEndpoint(batch), {
            method: "GET",
            credentials: "include"
          });
          if (!response.ok) return new Map();
          const data = await response.json();
          return extractPricingMap(data);
        } catch {
          return new Map();
        }
      })
    );

    for (const batchMap of batchMaps) {
      batchMap.forEach((value, key) => merged.set(key, value));
    }
    return merged;
  }

  /* ── Endpoint builders ── */

  buildProductsEndpoint(productIds, idParamName) {
    const store = this.storeName || DEFAULT_STORE_NAME;
    const wsId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${store}/webruntime/api/services/data/v66.0/commerce/webstores/${wsId}/products`;
    const params = new URLSearchParams({ [idParamName]: productIds.join(",") });
    params.set("fields", PRODUCT_FIELDS.join(","));
    return `${base}?${params.toString()}`;
  }

  buildPricingEndpoint(productIds) {
    const store = this.storeName || DEFAULT_STORE_NAME;
    const wsId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${store}/webruntime/api/services/data/v66.0/commerce/webstores/${wsId}/pricing/products`;
    const params = new URLSearchParams({ productIds: productIds.join(",") });
    return `${base}?${params.toString()}`;
  }

  /* ── Helpers ── */

  chunkArray(values, chunkSize) {
    const chunks = [];
    for (let i = 0; i < values.length; i += chunkSize) {
      chunks.push(values.slice(i, i + chunkSize));
    }
    return chunks;
  }

  normalizeError(error) {
    if (error?.body?.message) {
      return error.body.message;
    }
    if (error?.message) {
      return error.message;
    }
    return "Wishlist is currently unavailable.";
  }
}
