import { LightningElement, api } from "lwc";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";
import SCORE_GUARANTEE from "@salesforce/resourceUrl/ScoreGuarantee";
import {
  STATE_CHANGE_EVENT_NAMES,
  readStateFromStorage,
  decodeUrlValue,
  ALL_STATES,
  normalizeProduct as sharedNormalizeProduct,
  extractProductList as sharedExtractProductList,
  buildProductDetailPath as sharedBuildProductDetailPath,
  buildFreeTrialPath as sharedBuildFreeTrialPath,
  addProductToCart as sharedAddProductToCart,
  buildAddToCartSuccessModalData,
  resolvePrice,
  extractPricingMap as sharedExtractPricingMap,
  resolveStockKeepingUnit as sharedResolveStockKeepingUnit,
  resolveCurrencyIsoCode as sharedResolveCurrencyIsoCode,
  applyStorefrontGuestParams,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME
} from "c/utils";

const SHOP_ALL_URL =
  "https://americanbookcompany.my.site.com/AmericanBookCompany/global-search/all";
const DEFAULT_STATE = "Georgia";
const REFINEMENT_PARAM = "refinement";
const REFINEMENTS_PARAM = "refinements";
const SEARCH_PRODUCT_FIELDS = ["StockKeepingUnit"];
export default class FeaturedStateBooks extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api maxProducts = 9;
  @api refinementKey = "State__c";
  @api gridColumns = 4;
  @api shopAllUrl = SHOP_ALL_URL;
  @api cartStateOrId = "current";
  @api fallbackState = DEFAULT_STATE;

  products = [];

  loading = false;
  showProducts = false;
  selectedState = "";
  isModalOpen = false;
  modalProduct = null;
  modalVariationPricing = null;
  isAddingToCart = false;
  isModalPricingLoading = false;
  modalPricingLoadError = false;
  isSuccessModalOpen = false;
  successModalData = null;

  _boundStateSyncHandler;

  scoreGuaranteeLogo = SCORE_GUARANTEE;

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

  // ─── Derived getters ──────────────────────────────────────────────────────

  get normalizedMaxProducts() {
    const parsed = Number.parseInt(this.maxProducts, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 9;
  }

  get normalizedGridColumns() {
    const parsed = Number.parseInt(this.gridColumns, 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(6, parsed) : 4;
  }

  get headingText() {
    const state = (this.selectedState || "").trim();
    return state ? `Featured ${state} Books` : "Featured Books";
  }

  get normalizedFallbackState() {
    const state = String(this.fallbackState || "").trim();
    return ALL_STATES.includes(state) ? state : DEFAULT_STATE;
  }

  get featuredProduct() {
    return this.products.length > 0 ? this.products[0] : null;
  }

  get gridProducts() {
    return this.products.length > 1 ? this.products.slice(1) : [];
  }

  get gridClass() {
    return `products-grid columns-${this.normalizedGridColumns}`;
  }

  get resolvedShopAllUrl() {
    return this.shopAllUrl || SHOP_ALL_URL;
  }

  get showEmptyState() {
    return !this.loading && !this.showProducts;
  }

  get emptyStateMessage() {
    const state = String(this.selectedState || "").trim();
    return state
      ? `No featured books are available for ${state} right now.`
      : "No featured books are available right now.";
  }

  get modalTitle() {
    return this.modalProduct ? this.modalProduct.name : "";
  }

  get modalProductId() {
    return this.modalProduct?.id || "";
  }

  get modalIsbn() {
    return this.modalProduct ? this.modalProduct.isbn || "" : "";
  }

  get modalImageUrl() {
    return this.modalProduct ? this.modalProduct.imageUrl : "";
  }

  get modalCurrencyIsoCode() {
    return this.modalProduct
      ? this.modalProduct.currencyIsoCode || "USD"
      : "USD";
  }

  get modalMinimumQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleMin = rule?.minimum ?? rule?.Minimum ?? null;
    if (Number.isFinite(ruleMin) && ruleMin > 0) return ruleMin;
    return 10;
  }

  get modalMaximumQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleMax = rule?.maximum ?? rule?.Maximum ?? null;
    if (Number.isFinite(ruleMax) && ruleMax > 0 && ruleMax <= 9999) {
      return ruleMax;
    }
    return 50;
  }

  get modalIncrementQuantity() {
    const rule = this.modalProduct?.purchaseQuantityRule;
    const ruleInc = rule?.increment ?? rule?.Increment ?? null;
    if (Number.isFinite(ruleInc) && ruleInc > 0) return ruleInc;
    return 1;
  }

  get successProductName() {
    return this.successModalData?.productName || "";
  }

  get successProductImageUrl() {
    return this.successModalData?.productImageUrl || "";
  }

  get successProductUrl() {
    return this.successModalData?.productUrl || "";
  }

  get successCartUrl() {
    return this.successModalData?.cartUrl || "";
  }

  // ─── Initialise ───────────────────────────────────────────────────────────

  async initialize() {
    this.loading = true;

    try {
      this.selectedState = this.resolveSelectedState();
      const fetched = await this.fetchProductsByState(this.selectedState);
      const baseProducts = fetched
        .map((item) => this.normalizeProduct(item))
        .filter(Boolean)
        .slice(0, this.normalizedMaxProducts);

      this.products = await this.enrichProductsWithPricing(baseProducts);

      this.showProducts = this.products.length > 0;
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
  }

  // ─── State resolution ─────────────────────────────────────────────────────

  resolveSelectedState() {
    return (
      this.getStoredState() ||
      this.getStateFromParams() ||
      this.getStateFromHash() ||
      this.getStateFromPath() ||
      this.normalizedFallbackState
    );
  }

  getStoredState() {
    const fromStorage = readStateFromStorage();
    return ALL_STATES.includes(fromStorage) ? fromStorage : "";
  }

  getStateFromHash() {
    const hashValue = String(globalThis.location?.hash || "")
      .replace(/^#/, "")
      .trim();
    if (!hashValue) {
      return "";
    }

    const decodedHash = decodeUrlValue(hashValue);
    return ALL_STATES.includes(decodedHash) ? decodedHash : "";
  }

  getStateFromParams() {
    try {
      const url = new URL(globalThis.location.href);
      const refinementsRaw = url.searchParams.get(REFINEMENTS_PARAM);
      if (refinementsRaw) {
        const result = this.getStateFromRefinementsList(refinementsRaw);
        if (result) {
          return result;
        }
      }

      const refinement = url.searchParams.get(REFINEMENT_PARAM);
      if (refinement) {
        const decodedRefinement = decodeUrlValue(refinement);
        const prefix = `${this.refinementKey}:`;
        if (decodedRefinement.startsWith(prefix)) {
          const stateValue = decodedRefinement.slice(prefix.length).trim();
          return ALL_STATES.includes(stateValue) ? stateValue : "";
        }
      }
    } catch {
      return "";
    }

    return "";
  }

  getStateFromRefinementsList(refinementsRaw) {
    try {
      const refinementList = JSON.parse(decodeUrlValue(refinementsRaw));
      const stateEntry = Array.isArray(refinementList)
        ? refinementList.find((entry) => entry?.nameOrId === this.refinementKey)
        : null;

      if (
        stateEntry &&
        Array.isArray(stateEntry.values) &&
        stateEntry.values.length
      ) {
        const selectedState = String(stateEntry.values[0] || "").trim();
        return ALL_STATES.includes(selectedState) ? selectedState : "";
      }
    } catch {
      return "";
    }

    return "";
  }

  getStateFromPath() {
    if (globalThis.window === undefined || !globalThis.location?.pathname) {
      return "";
    }

    const path = globalThis.location.pathname;
    const marker = "/global-search/";
    const markerIndex = path.indexOf(marker);
    if (markerIndex === -1) return "";

    const afterMarker = path.slice(markerIndex + marker.length);
    const firstSegment = afterMarker.split("/")[0] || "";
    if (!firstSegment || firstSegment.toLowerCase() === "all") return "";

    try {
      return decodeURIComponent(firstSegment).trim();
    } catch {
      return firstSegment.trim();
    }
  }

  // ─── API fetch ────────────────────────────────────────────────────────────

  async fetchProductsByState(stateValue) {
    try {
      const response = await fetch(this.buildSearchEndpoint(stateValue), {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) return [];

      const data = await response.json();
      return sharedExtractProductList(data);
    } catch {
      return [];
    }
  }

  async enrichProductsWithPricing(products) {
    const productIds = products.map((item) => item.id).filter(Boolean);
    if (!productIds.length) {
      return products;
    }

    const pricingMap = await this.fetchPricingForProducts(productIds);
    if (!pricingMap.size) {
      return products;
    }

    return products.map((product) => {
      const priceInfo = pricingMap.get(product.id);
      if (!priceInfo) {
        return product;
      }

      const basePrice =
        priceInfo.unitPrice ??
        priceInfo.salesPrice ??
        priceInfo.negotiatedPrice ??
        priceInfo.listPrice ??
        product.listPrice;

      return {
        ...product,
        currencyIsoCode:
          priceInfo.currencyIsoCode || product.currencyIsoCode || "USD",
        listPrice: priceInfo.listPrice ?? product.listPrice ?? basePrice ?? null
      };
    });
  }

  async fetchPricingForProducts(productIds) {
    try {
      const response = await fetch(this.buildPricingEndpoint(productIds), {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        return new Map();
      }

      const data = await response.json();
      return sharedExtractPricingMap(data);
    } catch {
      return new Map();
    }
  }

  buildPricingEndpoint(productIds) {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/pricing/products`;
    const params = applyStorefrontGuestParams(
      new URLSearchParams({
        productIds: productIds.join(",")
      })
    );

    return `${base}?${params.toString()}`;
  }

  buildSearchEndpoint(stateValue) {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/search/products`;
    const params = applyStorefrontGuestParams(
      new URLSearchParams({
        searchTerm: this.buildSearchTermWithState(stateValue),
        page: "0",
        pageSize: String(this.normalizedMaxProducts + 4),
        refinement: `${this.refinementKey}:${stateValue}`
      })
    );

    SEARCH_PRODUCT_FIELDS.forEach((fieldName) => {
      params.append("fields", fieldName);
    });

    return `${base}?${params.toString()}`;
  }

  buildSearchTermWithState(stateValue) {
    const state = String(stateValue || "").trim();
    return state || "all";
  }

  // ─── Normalization ────────────────────────────────────────────────────────

  normalizeProduct(item) {
    const base = sharedNormalizeProduct(item);
    if (!base) return null;

    const isbn = sharedResolveStockKeepingUnit(item);
    const currencyIsoCode = sharedResolveCurrencyIsoCode(item);
    const listPrice = resolvePrice(item, [
      "prices.negotiatedPrice",
      "prices.salesPrice",
      "prices.listPrice",
      "fields.Price__c",
      "price"
    ]);

    return {
      ...base,
      isbn,
      currencyIsoCode,
      listPrice
    };
  }

  getProductById(productId) {
    if (!productId) {
      return null;
    }

    return this.products.find((item) => item.id === productId) || null;
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  handleClickProduct(event) {
    const productId = event.currentTarget.dataset.pid;
    if (!productId) return;

    const product = this.getProductById(productId);
    if (!product) return;

    globalThis.location.href = sharedBuildProductDetailPath(
      product,
      this.storeName || DEFAULT_STORE_NAME
    );
  }

  handleQuickShop(event) {
    event.stopPropagation();
    this.handleSuccessModalClose();
    const productId = event.currentTarget.dataset.pid;
    if (!productId) return;

    const product = this.getProductById(productId);
    if (!product) return;

    this.modalProduct = product;
    this.modalVariationPricing = null;
    this.modalPricingLoadError = false;
    this.isModalPricingLoading = true;
    this.isModalOpen = true;

    this.loadVariationPricing(productId);
  }

  async loadVariationPricing(productId) {
    try {
      const result = await getVariationPricing({
        productId,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });
      this.modalVariationPricing = result;
    } catch {
      this.modalVariationPricing = null;
      this.modalPricingLoadError = true;
    } finally {
      this.isModalPricingLoading = false;
    }
  }

  handleModalClose() {
    this.isModalOpen = false;
    this.modalProduct = null;
    this.modalVariationPricing = null;
    this.isModalPricingLoading = false;
    this.modalPricingLoadError = false;
  }

  handleSuccessModalClose() {
    this.isSuccessModalOpen = false;
    this.successModalData = null;
  }

  showAddToCartSuccessModal(productId) {
    const product = this.getProductById(productId) || this.modalProduct;
    this.successModalData = buildAddToCartSuccessModalData(
      product,
      this.storeName || DEFAULT_STORE_NAME
    );
    this.isSuccessModalOpen = true;
  }

  openModalProductDetails() {
    if (!this.modalProduct) {
      return;
    }

    const targetPath = sharedBuildProductDetailPath(
      this.modalProduct,
      this.storeName || DEFAULT_STORE_NAME
    );
    this.handleModalClose();
    globalThis.location.href = targetPath;
  }

  handleViewDetails() {
    this.openModalProductDetails();
  }

  handleLookInside() {
    globalThis.window.open("https://coursewave.com/login", "_blank", "noopener");
  }

  handleTrial() {
    if (!this.modalProduct) return;

    const trialPath = sharedBuildFreeTrialPath(
      this.modalProduct,
      this.storeName || DEFAULT_STORE_NAME
    );
    this.handleModalClose();
    if (trialPath) {
      globalThis.location.href = trialPath;
    }
  }

  async handleAddToCart(event) {
    if (this.isAddingToCart) return;

    const productId = event?.detail?.productId || this.modalProduct?.id || "";
    if (!productId) {
      return;
    }

    const requestedQty = Number.parseInt(event?.detail?.quantity, 10);
    const quantity =
      Number.isFinite(requestedQty) && requestedQty > 0 ? requestedQty : 1;

    this.isAddingToCart = true;
    try {
      const { ok: added } = await sharedAddProductToCart({
        productId,
        quantity,
        storeName: this.storeName || DEFAULT_STORE_NAME,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });
      if (added) {
        this.showAddToCartSuccessModal(productId);
      }
    } finally {
      this.isAddingToCart = false;
    }
  }

  handleShopAll(event) {
    event.preventDefault();
    const url = this.resolvedShopAllUrl;
    globalThis.location.href = url;
  }
}