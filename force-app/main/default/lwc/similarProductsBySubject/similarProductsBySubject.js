import { LightningElement, api } from "lwc";
import {
  STATE_CHANGE_EVENT_NAMES,
  readStateFromStorage,
  getCurrentProductId,
  normalizeProduct,
  extractProductList,
  buildProductDetailPath,
  scrollCarouselToIndex,
  applyStorefrontGuestParams,
  DEFAULT_STORE_NAME,
  DEFAULT_WEBSTORE_ID
} from "c/utils";
const RESIZE_DEBOUNCE_MS = 150;

export default class SimilarProductsBySubject extends LightningElement {
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
  selectedSubject = "";
  _effectiveVisible = 6;
  _resizeHandler = null;
  _resizeTimerId = null;
  _boundStateSyncHandler = null;

  connectedCallback() {
    this._updateEffectiveVisible();
    this._resizeHandler = () => {
      if (this._resizeTimerId) {
        clearTimeout(this._resizeTimerId);
      }
      this._resizeTimerId = setTimeout(() => {
        this._updateEffectiveVisible();
        this._resizeTimerId = null;
      }, RESIZE_DEBOUNCE_MS);
    };
    globalThis.addEventListener("resize", this._resizeHandler);
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
    if (this._resizeHandler) {
      globalThis.removeEventListener("resize", this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._resizeTimerId) {
      clearTimeout(this._resizeTimerId);
      this._resizeTimerId = null;
    }
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

  get baseSearchTerm() {
    const value = String(this.searchTerm || "").trim();
    return value || "*";
  }

  get canGoLeft() {
    return this.currentIndex > 0;
  }

  get canGoRight() {
    return this.currentIndex + this._effectiveVisible < this.products.length;
  }

  _updateEffectiveVisible() {
    const innerWidth = globalThis.innerWidth ?? 1280;
    // Mirror the CSS breakpoints: <=768px caps at 2 cols, <=1200px caps at 4 cols
    let cssMax;
    if (innerWidth <= 768) {
      cssMax = 2;
    } else if (innerWidth <= 1200) {
      cssMax = 4;
    } else {
      cssMax = this.normalizedVisibleColumns;
    }
    this._effectiveVisible = Math.min(cssMax, this.normalizedVisibleColumns);
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
    return "You might also like";
  }

  async initialize() {
    this.loading = true;

    try {
      this.currentProductId = getCurrentProductId();
      this.selectedState = readStateFromStorage();
      this.selectedSubject = this.getSelectedSubject();

      if (!this.selectedSubject) {
        this.resetProducts();
        return;
      }

      const fetchedProducts = await this.fetchProducts();
      this.products = fetchedProducts
        .map((item) => normalizeProduct(item))
        .filter(Boolean)
        .filter((item) => !this.isCurrentProduct(item))
        .filter((item) => this.matchesSubject(item))
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
    const nextState = readStateFromStorage();
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

  async fetchProducts() {
    try {
      const response = await fetch(this.buildSearchEndpoint(), {
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

  buildSearchEndpoint() {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/search/products`;
    const state = String(this.selectedState || "").trim();

    const params = applyStorefrontGuestParams(
      new URLSearchParams({
        searchTerm: this.buildSearchTermWithStateAndSubject(),
        page: "0",
        pageSize: String(
          this.normalizedMaxProducts + this.normalizedVisibleCount
        )
      })
    );

    if (state) {
      params.set("refinement", `${this.refinementKey}:${state}`);
    }

    return `${base}?${params.toString()}`;
  }

  buildSearchTermWithStateAndSubject() {
    const terms = [];
    const base = this.baseSearchTerm;
    const state = String(this.selectedState || "").trim();
    const subject = String(this.selectedSubject || "").trim();

    if (base && base !== "*") {
      terms.push(base);
    }

    if (state) {
      terms.push(state);
    }

    if (subject) {
      terms.push(subject);
    }

    const deduped = [];
    const seen = new Set();

    for (const entry of terms) {
      const normalized = entry.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduped.push(entry);
      }
    }

    if (deduped.length) return deduped.join(" ");
    const fallback = String(this.searchTerm || "").trim();
    return fallback && fallback !== "*" ? fallback : "all";
  }

  getSelectedSubject() {
    const slug = this.getProductSlugFromPath();
    const match = /-grade-\d+-(.+)$/i.exec(slug);
    const subjectSlug = match?.[1] ?? "";

    if (!subjectSlug) {
      return "";
    }

    return subjectSlug
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ")
      .trim();
  }

  getProductSlugFromPath() {
    if (!globalThis.location?.pathname) {
      return "";
    }

    const parts = globalThis.location.pathname.split("/").filter(Boolean);
    const productIndex = parts.findIndex(
      (segment) => segment.toLowerCase() === "product"
    );

    if (productIndex === -1 || productIndex + 1 >= parts.length) {
      return "";
    }

    try {
      return decodeURIComponent(parts[productIndex + 1]).trim();
    } catch {
      return parts[productIndex + 1].trim();
    }
  }

  isCurrentProduct(product) {
    const currentId = String(this.currentProductId || "")
      .trim()
      .toLowerCase();
    const productId = String(product?.id || "")
      .trim()
      .toLowerCase();

    if (!currentId || !productId) {
      return false;
    }

    return currentId === productId;
  }

  matchesSubject(product) {
    const subject = String(this.selectedSubject || "")
      .trim()
      .toLowerCase();
    if (!subject) {
      return true;
    }

    const name = String(product?.name || "").toLowerCase();
    return name.includes(subject);
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

    const maxStart = Math.max(0, this.products.length - this._effectiveVisible);
    this.currentIndex = Math.min(maxStart, this.currentIndex + 1);
    this.scrollToCurrentIndex("smooth");
  }

  scrollToCurrentIndex(behavior = "smooth") {
    scrollCarouselToIndex(this.template, this.currentIndex, behavior);
  }
}
