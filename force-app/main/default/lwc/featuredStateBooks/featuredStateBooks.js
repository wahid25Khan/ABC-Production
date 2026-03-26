import { LightningElement, api } from "lwc";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";
import SCORE_GUARANTEE from "@salesforce/resourceUrl/ScoreGuarantee";

const DEFAULT_STORE_NAME = "AmericanBookCompany";
const DEFAULT_WEBSTORE_ID = "0ZEam000004dJDNGA2";
const STATE_STORAGE_KEY = "abc_selected_state";
const SHOP_ALL_URL =
  "https://americanbookcompany.my.site.com/AmericanBookCompany/global-search/all";
const SEARCH_PRODUCT_FIELDS = ["StockKeepingUnit"];

export default class FeaturedStateBooks extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api maxProducts = 9;
  @api refinementKey = "State__c";
  @api gridColumns = 4;
  @api shopAllUrl = SHOP_ALL_URL;
  @api cartStateOrId = "current";

  products = [];

  loading = false;
  showProducts = false;
  selectedState = "";
  isModalOpen = false;
  modalProduct = null;
  modalVariationPricing = null;

  scoreGuaranteeLogo = SCORE_GUARANTEE;

  connectedCallback() {
    this.initialize();
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

  get modalTitle() {
    return this.modalProduct ? this.modalProduct.name : "";
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

  // ─── Initialise ───────────────────────────────────────────────────────────

  async initialize() {
    this.loading = true;

    try {
      this.selectedState = this.resolveSelectedState();

      if (!this.selectedState) {
        this.resetProducts();
        return;
      }

      const fetched = await this.fetchProductsByState(this.selectedState);
      const baseProducts = fetched
        .map((item) => this.normalizeProduct(item))
        .filter(Boolean)
        .slice(0, this.normalizedMaxProducts);

      this.products = await this.enrichProductsWithPricing(baseProducts);

      this.showProducts = this.products.length > 0;
    } catch (error) {
      console.warn("Failed to load featured products.", error);
      this.resetProducts();
    } finally {
      this.loading = false;
    }
  }

  resetProducts() {
    this.products = [];
    this.showProducts = false;
  }

  // ─── State resolution ─────────────────────────────────────────────────────

  resolveSelectedState() {
    const fromStorage = this.readStateFromStorage();
    if (fromStorage) return fromStorage;

    return this.getStateFromPath();
  }

  readStateFromStorage() {
    try {
      return (globalThis.localStorage.getItem(STATE_STORAGE_KEY) || "").trim();
    } catch (error) {
      console.debug("localStorage unavailable.", error);
      return "";
    }
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
    } catch (error) {
      console.debug("Failed to decode path segment.", error);
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
      return this.extractProductList(data);
    } catch (error) {
      console.debug("Failed to fetch products by state.", error);
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
      return this.extractPricingMap(data);
    } catch (error) {
      console.debug("Failed to fetch pricing.", error);
      return new Map();
    }
  }

  buildPricingEndpoint(productIds) {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/pricing/products`;
    const params = new URLSearchParams({
      productIds: productIds.join(",")
    });

    return `${base}?${params.toString()}`;
  }

  extractPricingMap(data) {
    const root = data && typeof data === "object" ? data : {};

    let rows = [];
    if (Array.isArray(root.pricingLineItemResults)) {
      rows = root.pricingLineItemResults;
    } else if (Array.isArray(root.pricingResults)) {
      rows = root.pricingResults;
    }

    const pricingByProductId = new Map();

    for (const row of rows) {
      const productId = String(
        row?.productId ||
          row?.pricingLineItem?.productId ||
          row?.product?.id ||
          row?.product?.productId ||
          ""
      ).trim();

      if (!productId) {
        continue;
      }

      pricingByProductId.set(productId, {
        currencyIsoCode:
          this.firstString([row?.currencyIsoCode, root?.currencyIsoCode]) ||
          "USD",
        listPrice: this.resolvePrice(row, [
          "listPrice",
          "pricebookPrice",
          "listUnitPrice"
        ]),
        salesPrice: this.resolvePrice(row, [
          "salesPrice",
          "unitPrice",
          "unitAdjustedPrice",
          "price"
        ]),
        negotiatedPrice: this.resolvePrice(row, ["negotiatedPrice"]),
        unitPrice: this.resolvePrice(row, [
          "unitPrice",
          "salesPrice",
          "unitAdjustedPrice",
          "price"
        ])
      });
    }

    return pricingByProductId;
  }

  buildSearchEndpoint(stateValue) {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    const base = `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/search/products`;
    const params = new URLSearchParams({
      language: "en-US",
      asGuest: "true",
      searchTerm: stateValue,
      page: "0",
      pageSize: String(this.normalizedMaxProducts + 4),
      refinement: `${this.refinementKey}:${stateValue}`
    });

    SEARCH_PRODUCT_FIELDS.forEach((fieldName) => {
      params.append("fields", fieldName);
    });

    return `${base}?${params.toString()}`;
  }

  extractProductList(data) {
    if (!data || typeof data !== "object") return [];

    const list =
      data.productsPage?.products ||
      data.productPage?.products ||
      data.productSearchResult?.products ||
      data.searchProductResult?.products ||
      data.products;

    return Array.isArray(list) ? list : [];
  }

  // ─── Normalization ────────────────────────────────────────────────────────

  normalizeProduct(item) {
    const id = String(item.id || "").trim();
    if (!id) return null;

    const name = String(item.name || "").trim() || "Untitled";
    const imageUrl = this.resolveProductImageUrl(item);
    const urlName = String(item.urlName || item.slug || "").trim();
    const isbn = this.resolveStockKeepingUnit(item);
    const currencyIsoCode = this.resolveCurrencyIsoCode(item);
    const listPrice = this.resolvePrice(item, [
      "prices.negotiatedPrice",
      "prices.salesPrice",
      "prices.listPrice",
      "fields.Price__c",
      "price"
    ]);

    return {
      ...item,
      id,
      name,
      imageUrl,
      urlName,
      isbn,
      currencyIsoCode,
      listPrice
    };
  }

  resolveCurrencyIsoCode(item) {
    const resolved = this.firstString([
      this.resolveByPath(item, "prices.currencyIsoCode"),
      this.resolveByPath(item, "fields.CurrencyIsoCode"),
      item?.currencyIsoCode
    ]);

    return resolved || "USD";
  }

  resolveStockKeepingUnit(item) {
    return this.firstString([
      item?.stockKeepingUnit,
      item?.StockKeepingUnit,
      this.resolveByPath(item, "fields.StockKeepingUnit"),
      this.resolveByPath(item, "fields.StockKeepingUnit__c"),
      this.resolveByPath(item, "fields.stockKeepingUnit")
    ]);
  }

  resolvePrice(item, paths) {
    for (const path of paths) {
      const value = this.resolveByPath(item, path);
      const normalized = this.toNumber(value);
      if (normalized !== null) {
        return normalized;
      }
    }

    return null;
  }

  resolveByPath(source, path) {
    if (!source || !path) {
      return undefined;
    }

    return path.split(".").reduce((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) {
        return acc[key];
      }

      return undefined;
    }, source);
  }

  toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "object") {
      if (typeof value.amount === "number" && Number.isFinite(value.amount)) {
        return value.amount;
      }

      if (typeof value.value === "number" && Number.isFinite(value.value)) {
        return value.value;
      }
    }

    const normalized = Number(String(value).replaceAll(/[^0-9.-]/g, ""));
    return Number.isFinite(normalized) ? normalized : null;
  }

  resolveProductImageUrl(item) {
    const candidates = [
      item?.defaultImage?.url,
      item?.image?.url,
      item?.imageUrl
    ];

    for (const v of candidates) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }

    const groups = Array.isArray(item.mediaGroups) ? item.mediaGroups : [];
    for (const g of groups) {
      for (const m of Array.isArray(g?.mediaItems) ? g.mediaItems : []) {
        const url = m?.url || m?.image?.url;
        if (typeof url === "string" && url.trim()) return url.trim();
      }
    }

    return "";
  }

  buildProductDetailPath(product) {
    const nameSource = product.urlName || product.name || "detail";
    const recordName = String(nameSource)
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "");

    return `/${this.storeName || DEFAULT_STORE_NAME}/product/${recordName || "detail"}/${product.id}`;
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

    globalThis.location.href = this.buildProductDetailPath(product);
  }

  handleQuickShop(event) {
    event.stopPropagation();
    const productId = event.currentTarget.dataset.pid;
    if (!productId) return;

    const product = this.getProductById(productId);
    if (!product) return;

    this.modalProduct = product;
    this.modalVariationPricing = null;
    this.isModalOpen = true;

    Promise.resolve().then(() => {
      const modal = this.template.querySelector("c-quick-shop-modal");
      if (modal && typeof modal.open === "function") {
        modal.open();
      }
    });

    this.loadVariationPricing(productId);
  }

  async loadVariationPricing(productId) {
    try {
      const result = await getVariationPricing({
        productId,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });
      this.modalVariationPricing = result;
    } catch (error) {
      console.warn("Failed to load variation pricing.", error);
    }
  }

  handleModalClose() {
    this.isModalOpen = false;
    this.modalProduct = null;
    this.modalVariationPricing = null;
  }

  handleViewDetails() {
    if (!this.modalProduct) {
      return;
    }

    globalThis.location.href = this.buildProductDetailPath(this.modalProduct);
  }

  async handleAddToCart(event) {
    const productId = event?.detail?.productId || this.modalProduct?.id || "";
    if (!productId) {
      return;
    }

    const requestedQty = Number.parseInt(event?.detail?.quantity, 10);
    const quantity =
      Number.isFinite(requestedQty) && requestedQty > 0 ? requestedQty : 1;

    const added = await this.addProductToCart(productId, quantity);
    if (added) {
      this.handleModalClose();
      globalThis.window.location.href = `/${
        this.storeName || DEFAULT_STORE_NAME
      }/cart`;
    }
  }

  async addProductToCart(productId, quantity) {
    const targetCart =
      String(this.cartStateOrId || "current").trim() || "current";
    const payload = {
      productId,
      quantity,
      type: "Product"
    };

    try {
      const response = await fetch(this.buildAddToCartEndpoint(targetCart), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return true;
      }
    } catch (error) {
      console.debug("Failed to add product to cart.", error);
    }

    return false;
  }

  buildAddToCartEndpoint(cartStateOrId = "current") {
    const storeName = this.storeName || DEFAULT_STORE_NAME;
    const webStoreId = this.webStoreId || DEFAULT_WEBSTORE_ID;
    return `/${storeName}/webruntime/api/services/data/v66.0/commerce/webstores/${webStoreId}/carts/${cartStateOrId}/cart-items`;
  }

  firstString(values) {
    for (const value of values) {
      const normalized = this.toDisplayString(value);
      if (normalized) {
        return normalized;
      }
    }

    return "";
  }

  toDisplayString(value, depth = 0) {
    if (depth > 4) {
      return "";
    }

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "object") {
      const objectCandidates = [
        value.displayValue,
        value.value,
        value.rawValue,
        value.label,
        value.text,
        value.name,
        value.StockKeepingUnit
      ];

      for (const candidate of objectCandidates) {
        const nested = this.toDisplayString(candidate, depth + 1);
        if (nested) {
          return nested;
        }
      }

      const nestedValues = Object.values(value);
      for (const nestedValue of nestedValues) {
        const nested = this.toDisplayString(nestedValue, depth + 1);
        if (nested) {
          return nested;
        }
      }
    }

    return "";
  }

  handleShopAll(event) {
    event.preventDefault();
    const url = this.resolvedShopAllUrl;
    globalThis.location.href = url;
  }
}
