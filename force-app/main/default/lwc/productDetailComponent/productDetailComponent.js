import { LightningElement, api, track } from "lwc";
import isGuest from "@salesforce/user/isGuest";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";
import { trackViewProduct } from "commerce/activitiesApi";

import {
  normalizeProduct as sharedNormalizeProduct,
  resolveProductImageUrl as sharedResolveProductImageUrl,
  normalizeImageUrl,
  toNumber,
  extractPricingMap as sharedExtractPricingMap,
  extractProductList,
  formatCurrency,
  resolveStockKeepingUnit,
  parsePositiveInteger,
  resolveUnitPriceForQuantity,
  addProductToCart as sharedAddProductToCart,
  buildAddToCartSuccessModalData,
  buildFreeTrialPath,
  syncFavoriteState,
  doToggleFavorite,
  getCurrentProductId,
  applyStorefrontGuestParams,
  DEFAULT_WEBSTORE_ID,
  DEFAULT_STORE_NAME
} from "c/utils";

const DEFAULT_CURRENCY = "USD";
const LOGIN_URL = "/AmericanBookCompany/login";
const HEART_REGULAR_PATH =
  "M225.8 468.2l-2.5-2.3L48.1 303.2C17.4 274.7 0 234.7 0 192.8v-3.3c0-70.4 50-130.8 119.2-144C158.6 37.9 198.9 47 231 69.6c9 6.4 17.4 13.8 25 22.3c4.2-4.8 8.7-9.2 13.5-13.3c3.7-3.2 7.5-6.2 11.5-9c0 0 0 0 0 0C313.1 47 353.4 37.9 392.8 45.4C462 58.6 512 119.1 512 189.5v3.3c0 41.9-17.4 81.9-48.1 110.4L288.7 465.9l-2.5 2.3c-8.2 7.6-19 11.9-30.2 11.9s-22-4.2-30.2-11.9zM239.1 145c-.4-.3-.7-.7-1-1.1l-17.8-20c0 0-.1-.1-.1-.1c0 0 0 0 0 0c-23.1-25.9-58-37.7-92-31.2C81.6 101.5 48 142.1 48 189.5v3.3c0 28.5 11.9 55.8 32.8 75.2L256 430.7 431.2 268c20.9-19.4 32.8-46.7 32.8-75.2v-3.3c0-47.3-33.6-88-80.1-96.9c-34-6.5-69 5.4-92 31.2c0 0 0 0-.1 .1s0 0-.1 .1l-17.8 20c-.3 .4-.7 .7-1 1.1c-4.5 4.5-10.6 7-16.9 7s-12.4-2.5-16.9-7z";
const HEART_SOLID_PATH =
  "M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z";
const PRODUCT_DETAIL_FIELDS = [
  "StockKeepingUnit",
  "Name",
  "purchaseQuantityRule"
];
export default class ProductDetailComponent extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api productId = "";
  @api cartStateOrId = "current";
  @api minimumQuantity = 25; // 10;
  @api trialUrl = "";
  @api showTrialButton;

  @track loading = true;
  @track product = null;
  @track variationPricing = null;
  @track errorMessage = "";

  quantity = 25; // 10; 
  // to change Initial Default Quanitity make sure to update
  // quantity, minimumQuantity in js file
  // minimumQuantity in meta file as well
  
  selectedVariationIndex = 0;
  isFavorite = false;
  favoritePending = false;
  favoriteProductId = "";
  isAddingToCart = false;
  isSuccessModalOpen = false;
  successModalData = null;
  trackedViewProductId = "";

  featuresLeft = ["Answer Key", "Posttest", "Pretest"];
  featuresRight = ["eBook", "Table of Content", "Teacher Guide", "CourseWave Online Testing"];

  connectedCallback() {
    this.quantity = this.minQty;
    this.initialize();
  }

  get hasProduct() {
    return Boolean(this.product);
  }

  get showError() {
    return !this.loading && !this.hasProduct && Boolean(this.errorMessage);
  }

  get title() {
    return this.product?.name || "";
  }

  get isbn() {
    return this.product?.sku || "";
  }

  get bookImageUrl() {
    return this.product?.imageUrl || "";
  }

  get currencyIsoCode() {
    return this.product?.currencyIsoCode || DEFAULT_CURRENCY;
  }

  get displayTrialButton() {
    return this.showTrialButton !== false && this.showTrialButton !== "false";
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

  // ─── Variation getters ──────────────────────────────────────────────────

  get variationsList() {
    return this.variationPricing?.variations ?? [];
  }

  get hasMultipleVariations() {
    return this.variationsList.length > 1;
  }

  get variations() {
    return this.variationsList.map((v, i) => ({
      ...v,
      index: i,
      label: v.format || "Standard",
      tabClass: `plan-option ${this.selectedVariationIndex === i ? "active" : ""}`,
      isSelected: this.selectedVariationIndex === i
    }));
  }

  get selectedVariation() {
    const list = this.variationsList;
    if (!list.length) return null;
    const idx =
      this.selectedVariationIndex < list.length
        ? this.selectedVariationIndex
        : 0;
    return list[idx];
  }

  get selectedUnitPrice() {
    return resolveUnitPriceForQuantity(this.selectedVariation, this.quantity, this.minQty);
  }

  get selectedProductId() {
    return this.selectedVariation?.productId ?? this.product?.id ?? "";
  }

  get displayTiers() {
    const tiers = this.selectedVariation?.tiers;
    if (!tiers?.length) return [];
    return tiers.map((tier, index) => ({
      key: `tier-${index}`,
      qtyLabel:
        tier.upperBound == null
          ? `${tier.lowerBound}+`
          : `${tier.lowerBound}\u2013${tier.upperBound}`,

      formattedPrice: formatCurrency(toNumber(tier.price), this.currencyIsoCode || DEFAULT_CURRENCY),
      priceClass: 'td' // `td price${index > 0 ? " price-red" : ""}`
    })).filter((_, index) => tiers.length === 1 || index > 0);
  }

  get hasTiers() {
    return this.displayTiers.length > 0;
  }

  get minQty() {
    const variationMin = parsePositiveInteger(
      this.selectedVariation?.minimumQuantity
    );
    if (variationMin !== null) return variationMin;

    const rule = this.product?.purchaseQuantityRule;
    const ruleMin = rule?.minimum ?? rule?.Minimum ?? null;
    if (Number.isFinite(ruleMin) && ruleMin > 0) return ruleMin;
    const parsed = Number.parseInt(this.minimumQuantity, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25; // 10;
  }

  // Upper bound: ignore values > 9999 which indicate "no maximum" in Salesforce (e.g. 100,000,000)
  get maxQty() {
    const variationMax = parsePositiveInteger(
      this.selectedVariation?.maximumQuantity
    );
    if (variationMax !== null) {
      return variationMax;
    }

    const rule = this.product?.purchaseQuantityRule;
    const ruleMax = rule?.maximum ?? rule?.Maximum ?? null;
    if (Number.isFinite(ruleMax) && ruleMax > 0 && ruleMax <= 9999)
      return ruleMax;
    return 99999;
  }

  get incrementQty() {
    const variationIncrement = parsePositiveInteger(
      this.selectedVariation?.incrementQuantity
    );
    if (variationIncrement !== null) return variationIncrement;

    const rule = this.product?.purchaseQuantityRule;
    const ruleInc = rule?.increment ?? rule?.Increment ?? null;
    if (Number.isFinite(ruleInc) && ruleInc > 0) return ruleInc;
    return 1;
  }

  get favoriteIconPath() {
    return this.isFavorite ? HEART_SOLID_PATH : HEART_REGULAR_PATH;
  }

  get favoriteButtonLabel() {
    if (isGuest) {
      return "Log in to add to Wishlist";
    }

    return this.isFavorite ? "Remove from Wishlist" : "Add to Wishlist";
  }

  get isFavoriteDisabled() {
    return this.favoritePending || !this.selectedProductId;
  }

  get formattedUnitPrice() {
    return formatCurrency(toNumber(this.selectedUnitPrice), this.currencyIsoCode || DEFAULT_CURRENCY);
  }

  // Live order total: current tier unit price × total quantity
  get totalPrice() {
    const unit = this.selectedUnitPrice;
    const qty = Number(this.quantity) || this.minQty;
    if (!unit || !qty) return "";
    return formatCurrency(unit * qty, this.currencyIsoCode || DEFAULT_CURRENCY);
  }

  async initialize() {
    this.loading = true;
    this.errorMessage = "";

    try {
      const currentProductId = this.resolveCurrentProductId();
      if (!currentProductId) {
        this.product = null;
        this.errorMessage = "Unable to determine the current product.";
        return;
      }

      const rawProduct = await this.fetchProductDetails(currentProductId);
      if (!rawProduct) {
        this.product = null;
        this.errorMessage = "Unable to load product details.";
        return;
      }

      const baseProduct = this.normalizeProduct(rawProduct);
      const pricingMap = await this.fetchPricingForProducts([currentProductId]);
      this.product = this.applyPricing(
        baseProduct,
        pricingMap.get(currentProductId)
      );
      this.quantity = this.minQty;
      this.trackCurrentProductView();

      // Load variation + tier pricing from Apex
      try {
        this.variationPricing = await getVariationPricing({
          productId: currentProductId,
          webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
        });
        this.quantity = this.minQty;
      } catch {
        // variation pricing unavailable
      }

      if (isGuest) {
        this.isFavorite = false;
        this.favoriteProductId = "";
      } else {
        await syncFavoriteState(
          this,
          this.selectedProductId || currentProductId,
          this.webStoreId || DEFAULT_WEBSTORE_ID
        );
      }
    } catch {
      this.product = null;
      this.errorMessage = "Unable to load product details.";
    } finally {
      this.loading = false;
    }
  }

  resolveCurrentProductId() {
    const configured = String(this.productId || "").trim();
    if (configured) {
      return configured;
    }

    if (!globalThis.window?.location) {
      return "";
    }

    // Check extra query params not covered by getCurrentProductId
    const queryParams = new URLSearchParams(
      globalThis.window.location.search || ""
    );
    const fromExtraParams =
      queryParams.get("productId") ||
      queryParams.get("product_id");
    if (fromExtraParams) {
      return String(fromExtraParams).trim();
    }

    return getCurrentProductId();
  }

  async fetchProductDetails(productId) {
    const endpoints = [
      this.buildProductsEndpoint([productId], "ids"),
      this.buildProductsEndpoint([productId], "productIds")
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "include"
        });

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const products = extractProductList(data);
        if (products.length) {
          return products[0];
        }
      } catch {
        // try the next supported query shape
      }
    }

    return null;
  }

  buildProductsEndpoint(productIds, idParamName) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/products`;
    const params = applyStorefrontGuestParams(
      new URLSearchParams({
        [idParamName]: productIds.join(",")
      })
    );

    params.set("fields", PRODUCT_DETAIL_FIELDS.join(","));

    return `${base}?${params.toString()}`;
  }

  normalizeProduct(item) {
    const base = sharedNormalizeProduct(item);
    if (!base) {
      return null;
    }

    return {
      ...base,
      imageUrl: this.resolveProductImageUrl(item),
      sku: resolveStockKeepingUnit(item),
      currencyIsoCode: DEFAULT_CURRENCY,
      listPrice: null,
      startingPrice: null
    };
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
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/pricing/products`;
    const params = applyStorefrontGuestParams(
      new URLSearchParams({
        productIds: productIds.join(",")
      })
    );

    return `${base}?${params.toString()}`;
  }

  applyPricing(product, priceInfo) {
    if (!product || !priceInfo) {
      return product;
    }

    const basePrice =
      priceInfo.unitPrice ??
      priceInfo.salesPrice ??
      priceInfo.negotiatedPrice ??
      priceInfo.listPrice ??
      null;

    return {
      ...product,
      currencyIsoCode:
        priceInfo.currencyIsoCode ||
        product.currencyIsoCode ||
        DEFAULT_CURRENCY,
      listPrice: priceInfo.listPrice ?? basePrice ?? null,
      startingPrice: basePrice ?? null
    };
  }

  resolveProductImageUrl(item) {
    const url = sharedResolveProductImageUrl(item);
    return url ? normalizeImageUrl(url) : "";
  }

  trackCurrentProductView() {
    const productId = String(this.product?.id || "").trim();
    if (!productId || productId === this.trackedViewProductId) {
      return;
    }

    try {
      trackViewProduct({
        id: productId,
        sku: this.product?.sku || ""
      });
      this.trackedViewProductId = productId;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to track product view activity", error);
    }
  }

  handleTabClick(event) {
    const index = Number.parseInt(event.currentTarget.dataset.index, 10);
    if (
      Number.isFinite(index) &&
      index >= 0 &&
      index < this.variationsList.length
    ) {
      this.selectedVariationIndex = index;
      this.quantity = this.minQty;
      const variation = this.variationsList[index];
      const nextProductId = variation?.productId || this.product?.id || "";
      if (!isGuest && nextProductId && nextProductId !== this.favoriteProductId) {
        syncFavoriteState(this, nextProductId, this.webStoreId || DEFAULT_WEBSTORE_ID);
      }
    }
  }

  get isMinQty() {
    return this.quantity <= this.minQty;
  }

  get isMaxQty() {
    return this.quantity >= this.maxQty;
  }

  handleQtyChange(event) {
    const raw = event?.target?.value;
    if (raw === '') return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.quantity = parsed;
    }
  }

  handleQtyBlur(event) {
    let value = this.quantity;
    if (!Number.isFinite(value)) value = this.minQty;

    const min = this.minQty;
    const max = this.maxQty;
    const inc = this.incrementQty;

    if (value < min) value = min;
    if (value > max) value = max;

    // Snap to nearest valid increment step
    if (inc > 1) {
      const steps = Math.round((value - min) / inc);
      value = min + steps * inc;
      if (value > max) value = min + Math.floor((max - min) / inc) * inc;
      if (value < min) value = min;
    }

    this.quantity = value;
    event.target.value = String(value);
  }

  handleQtyDecrement() {
    const next = this.quantity - this.incrementQty;
    this.quantity = Math.max(next, this.minQty);
  }

  handleQtyIncrement() {
    const next = this.quantity + this.incrementQty;
    this.quantity = Math.min(next, this.maxQty);
  }

  handleSuccessModalClose() {
    this.isSuccessModalOpen = false;
    this.successModalData = null;
  }

  showAddToCartSuccessModal() {
    this.successModalData = buildAddToCartSuccessModalData(
      this.product,
      this.storeName || DEFAULT_STORE_NAME
    );
    this.isSuccessModalOpen = true;
  }

  async handleAddToCart() {
    if (this.isAddingToCart) return;

    // Clamp and validate quantity at submission time
    let qty = this.quantity;
    if (qty < this.minQty) qty = this.minQty;
    if (qty > this.maxQty) qty = this.maxQty;
    this.quantity = qty;

    // Use the selected variation's product ID for the cart
    const productId = this.selectedProductId || this.product?.id || "";
    if (!productId) {
      return;
    }

    this.isAddingToCart = true;
    try {
      const { ok: added } = await sharedAddProductToCart({
        productId,
        quantity: this.quantity,
        storeName: this.storeName || DEFAULT_STORE_NAME,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });
      this.dispatchEvent(
        new CustomEvent("addtocart", {
          detail: {
            added,
            productId,
            quantity: this.quantity,
            format: this.selectedVariation?.format,
            isbn: this.isbn,
            title: this.title,
            unitPrice: this.selectedUnitPrice,
            currencyIsoCode: this.currencyIsoCode
          }
        })
      );

      if (added) {
        this.showAddToCartSuccessModal();
      }
    } finally {
      this.isAddingToCart = false;
    }
  }

  handleTrial() {
    this.dispatchEvent(
      new CustomEvent("trial", {
        detail: {
          isbn: this.isbn,
          title: this.title
        }
      })
    );

    const productId = this.selectedProductId || this.product?.id || "";
    if (productId && this.product) {
      const trialPath = buildFreeTrialPath(
        { ...this.product, id: productId },
        this.storeName || DEFAULT_STORE_NAME
      );
      globalThis.window.location.href = trialPath;
      return;
    }

    if (this.trialUrl && globalThis.window !== undefined) {
      globalThis.window.location.href = this.trialUrl;
    }
  }

  redirectGuestToLogin() {
    const location = globalThis.location || globalThis.window?.location;
    if (!location) {
      return;
    }

    const startUrl = `${location.pathname || ""}${location.search || ""}${location.hash || ""}`;
    location.assign(`${LOGIN_URL}?startURL=${encodeURIComponent(startUrl)}`);
  }

  async toggleFavorite() {
    const productId = this.selectedProductId || this.product?.id || "";
    if (isGuest) {
      this.redirectGuestToLogin();
      return;
    }

    await doToggleFavorite(
      this,
      productId,
      this.webStoreId || DEFAULT_WEBSTORE_ID
    );
  }
}