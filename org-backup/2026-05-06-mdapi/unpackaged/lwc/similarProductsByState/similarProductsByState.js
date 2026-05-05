import { LightningElement, api } from "lwc";
import {
  STATE_CHANGE_EVENT_NAMES,
  resolveSelectedStateFromLocation,
  getCurrentProductId,
  normalizeProduct,
  extractProductList,
  buildProductDetailPath,
  scrollCarouselToIndex,
  applyStorefrontGuestParams,
  DEFAULT_STORE_NAME,
  DEFAULT_WEBSTORE_ID
} from "c/utils";

export default class SimilarProductsByState extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api maxProducts = 18;
  @api visibleCount = 6;
  @api refinementKey = "State__c";
  @api searchTerm = "";

  products = [];

  loading = false;
  showProducts = false;
  currentIndex = 0;
  currentProductId = "";
  selectedState = "";
  _boundStateSyncHandler = null;

  connectedCallback() {
    this._boundStateSyncHandler = () => {
      this.handleSharedStateUpdate();
    };
    STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
      globalThis.addEventListener(eventName, this._boundStateSyncHandler);
    });
    globalThis.addEventListener("hashchange", this._boundStateSyncHandler);
    globalThis.addEventListener("popstate", this._boundStateSyncHandler);
    this.initialize();
  }

  disconnectedCallback() {
    STATE_CHANGE_EVENT_NAMES.forEach((eventName) => {
      globalThis.removeEventListener(eventName, this._boundStateSyncHandler);
    });
    globalThis.removeEventListener("hashchange", this._boundStateSyncHandler);
    globalThis.removeEventListener("popstate", this._boundStateSyncHandler);
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

  get normalizedSearchTerm() {
    const value = String(this.searchTerm || "").trim();
    return value && value !== "*" ? value : "all";
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

  get headingText() {
    const state = (this.selectedState || "").trim();
    return state
      ? `Looking for additional ${state} books?`
      : "Looking for additional books?";
  }

  async initialize() {
    this.loading = true;

    try {
      this.currentProductId = getCurrentProductId();
      this.selectedState = this.resolveSelectedState();

      if (!this.selectedState) {
        this.resetProducts();
        return;
      }

      const fetchedProducts = await this.fetchProductsByState(
        this.selectedState
      );
      this.products = fetchedProducts
        .map((item) => normalizeProduct(item))
        .filter(Boolean)
        .filter((item) => !this.isCurrentProduct(item))
        .slice(0, this.normalizedMaxProducts);

      this.showProducts = this.products.length > 0;
      this.currentIndex = 0;
      this.scrollToCurrentIndex("auto");
    } catch {
      this.resetProducts();
    } finally {
      this.loading = false;
    }
  }

  async handleSharedStateUpdate() {
    const nextState = this.resolveSelectedState();
    if (nextState === this.selectedState && this.showProducts) {
      return;
    }

    await this.initialize();
  }

  resetProducts() {
    this.products = [];
    this.showProducts = false;
    this.currentIndex = 0;
  }

  resolveSelectedState() {
    return resolveSelectedStateFromLocation({
      refinementKey: this.refinementKey
    });
  }

  async fetchProductsByState(stateValue) {
    try {
      const response = await fetch(this.buildSearchEndpoint(stateValue), {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return extractProductList(data);
    } catch {
      return [];
    }
  }

  buildSearchEndpoint(stateValue) {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/search/products`;
    const params = applyStorefrontGuestParams(
      new URLSearchParams({
        searchTerm: this.buildSearchTermWithState(stateValue),
        page: "0",
        pageSize: String(
          this.normalizedMaxProducts + this.normalizedVisibleCount
        ),
        refinement: `${this.refinementKey}:${stateValue}`
      })
    );

    return `${base}?${params.toString()}`;
  }

  buildSearchTermWithState(stateValue) {
    const state = String(stateValue || "").trim();
    const baseSearchTerm = this.normalizedSearchTerm;

    if (!state) {
      return baseSearchTerm;
    }

    if (baseSearchTerm === "*" || baseSearchTerm === "all") {
      return state;
    }

    if (baseSearchTerm.toLowerCase().includes(state.toLowerCase())) {
      return baseSearchTerm;
    }

    return `${baseSearchTerm} ${state}`;
  }

  isCurrentProduct(product) {
    const currentId = String(this.currentProductId || "")
      .trim()
      .toLowerCase();
    const productId = String(product?.id ?? "")
      .trim()
      .toLowerCase();

    if (!currentId || !productId) {
      return false;
    }

    return currentId === productId;
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

    globalThis.location.href = buildProductDetailPath(product, this.storeName);
  }

  handlePrev() {
    if (!this.canGoLeft) {
      return;
    }

    this.currentIndex = Math.max(0, this.currentIndex - 1);
    this.scrollToCurrentIndex("smooth");
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
    this.scrollToCurrentIndex("smooth");
  }

  scrollToCurrentIndex(behavior = "smooth") {
    scrollCarouselToIndex(this.template, this.currentIndex, behavior);
  }
}