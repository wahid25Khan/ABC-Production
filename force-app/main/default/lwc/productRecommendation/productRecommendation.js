import { LightningElement, api } from "lwc";
import {
  applyStorefrontRequestParams,
  normalizeProduct,
  extractProductList,
  buildProductDetailPath,
  scrollCarouselToIndex,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME
} from "c/utils";

export default class ProductRecommendation extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api recommender = "RecentlyViewed";
  @api anchorValues = "";
  @api maxProducts = 18;
  @api visibleCount = 6;

  products = [];
  loading = false;
  showProducts = false;
  loadError = false;
  currentIndex = 0;
  _boundRouteRefreshHandler = null;

  connectedCallback() {
    this._boundRouteRefreshHandler = () => {
      this.loadProductRecommendations();
    };
    globalThis.addEventListener("hashchange", this._boundRouteRefreshHandler);
    globalThis.addEventListener("popstate", this._boundRouteRefreshHandler);
    globalThis.addEventListener("pageshow", this._boundRouteRefreshHandler);
    this.loadProductRecommendations();
  }

  disconnectedCallback() {
    if (this._boundRouteRefreshHandler) {
      globalThis.removeEventListener(
        "hashchange",
        this._boundRouteRefreshHandler
      );
      globalThis.removeEventListener(
        "popstate",
        this._boundRouteRefreshHandler
      );
      globalThis.removeEventListener(
        "pageshow",
        this._boundRouteRefreshHandler
      );
      this._boundRouteRefreshHandler = null;
    }
  }

  get headingText() {
    const count = this.products.length;
    return `Recently Viewed (${count})`;
  }

  get normalizedMaxProducts() {
    const parsed = Number.parseInt(this.maxProducts, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 18;
  }

  get normalizedVisibleCount() {
    const parsed = Number.parseInt(this.visibleCount, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
  }

  get normalizedVisibleColumns() {
    return Math.min(8, Math.max(1, this.normalizedVisibleCount));
  }

  get canGoLeft() {
    return this.currentIndex > 0;
  }

  get canGoRight() {
    return (
      this.currentIndex + this.normalizedVisibleCount < this.products.length
    );
  }

  get disablePrev() {
    return !this.canGoLeft;
  }

  get disableNext() {
    return !this.canGoRight;
  }

  get productsTrackClass() {
    return `products-track columns-${this.normalizedVisibleColumns}`;
  }

  get showEmptyState() {
    return !this.loading && !this.showProducts;
  }

  get emptyStateText() {
    return this.loadError
      ? "We couldn't load your recently viewed books right now."
      : "Browse a few books and your recently viewed books will appear here.";
  }

  async loadProductRecommendations() {
    this.loading = true;
    this.loadError = false;

    try {
      const endpoint = this.buildEndpoint();

      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const fetchedProducts = extractProductList(data);

      this.products = fetchedProducts
        .map((item) => normalizeProduct(item))
        .filter(Boolean)
        .slice(0, this.normalizedMaxProducts);

      this.showProducts = this.products.length > 0;
      this.currentIndex = 0;
      if (this.showProducts) {
        scrollCarouselToIndex(this.template, this.currentIndex, "auto");
      }
    } catch (error) {
      // Keep the section visible instead of silently disappearing when the API fails.
      // eslint-disable-next-line no-console
      console.error("Failed to load recently viewed products", error);
      this.products = [];
      this.showProducts = false;
      this.loadError = true;
      this.currentIndex = 0;
    } finally {
      this.loading = false;
    }
  }

  handleClickProduct(event) {
    const productId = event.currentTarget.dataset.pid;
    if (!productId) {
      return;
    }

    const product = this.products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    globalThis.location.href = buildProductDetailPath(
      product,
      this.storeName || DEFAULT_STORE_NAME
    );
  }

  handlePrev() {
    if (!this.canGoLeft) {
      return;
    }

    this.currentIndex = Math.max(0, this.currentIndex - 1);
    scrollCarouselToIndex(this.template, this.currentIndex, "smooth");
  }

  handleNext() {
    if (!this.canGoRight) {
      return;
    }

    const maxStart = Math.max(
      0,
      this.products.length - this.normalizedVisibleCount
    );
    this.currentIndex = Math.min(maxStart, this.currentIndex + 1);
    scrollCarouselToIndex(this.template, this.currentIndex, "smooth");
  }

  buildEndpoint() {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const baseUrl = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/ai/recommendations`;
    const recommendersToSend = this.recommender || "RecentlyViewed";
    const params = applyStorefrontRequestParams(
      new URLSearchParams({
        recommender: recommendersToSend
      })
    );

    if (this.anchorValues) {
      params.append("anchorValues", this.anchorValues);
    }

    return `${baseUrl}?${params.toString()}`;
  }
}
