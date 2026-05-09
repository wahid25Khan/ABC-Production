import { LightningElement, api, track } from "lwc";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";

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
  @api minimumQuantity = 10;
  @api maximumQuantity = 50;
  @api trialUrl = "";
  @api showTrialButton;

  @track loading = true;
  @track product = null;
  @track variationPricing = null;
  @track errorMessage = "";

  quantity = 10;
  selectedVariationIndex = 0;
  isFavorite = false;
  favoritePending = false;
  favoriteProductId = "";
  isAddingToCart = false;
  isSuccessModalOpen = false;
  successModalData = null;

  featuresLeft = ["Answer Key", "Posttest", "Pretest"];
  featuresRight = [
    "eBook",
    "Table of Content",
    "Teacher Guide",
    "CourseWave Online Testing"
  ];

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
    return resolveUnitPriceForQuantity(
      this.selectedVariation,
      this.quantity,
      this.minQty
    );
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

      formattedPrice: formatCurrency(
        toNumber(tier.price),
        this.currencyIsoCode || DEFAULT_CURRENCY
      ),
      priceClass: `td price${index > 0 ? " price-red" : ""}`
    }));
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
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
  }

  // Upper bound: ignore values > 9999 which indicate "no maximum" in Salesforce (e.g. 100,000,000)
  get maxQty() {
    const variationMax = parsePositiveInteger(
      this.selectedVariation?.maximumQuantity
    );
    if (variationMax !== null && variationMax <= 9999) {
      return variationMax;
    }

    const rule = this.product?.purchaseQuantityRule;
    const ruleMax = rule?.maximum ?? rule?.Maximum ?? null;
    if (Number.isFinite(ruleMax) && ruleMax > 0 && ruleMax <= 9999)
      return ruleMax;

    const apiMax = parsePositiveInteger(this.maximumQuantity);
    return apiMax !== null ? apiMax : 99999;
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

  get heartIcon() {
    return this.isFavorite ? "utility:favorite" : "utility:favorite_alt";
  }

  get isFavoriteDisabled() {
    return this.favoritePending || !this.selectedProductId;
  }

  get formattedUnitPrice() {
    return formatCurrency(
      toNumber(this.selectedUnitPrice),
      this.currencyIsoCode || DEFAULT_CURRENCY
    );
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

      // Load variation + tier pricing from Apex
      try {
        this.variationPricing = await getVariationPricing({
          productId: currentProductId,
          webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
        });
      } catch {
        // variation pricing unavailable
      }

      await syncFavoriteState(
        this,
        this.selectedProductId || currentProductId,
        this.webStoreId || DEFAULT_WEBSTORE_ID
      );
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
      queryParams.get("productId") || queryParams.get("product_id");
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
      if (nextProductId && nextProductId !== this.favoriteProductId) {
        syncFavoriteState(
          this,
          nextProductId,
          this.webStoreId || DEFAULT_WEBSTORE_ID
        );
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
    if (raw === "") return;
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

  async toggleFavorite() {
    const productId = this.selectedProductId || this.product?.id || "";
    doToggleFavorite(this, productId, this.webStoreId || DEFAULT_WEBSTORE_ID);
  }
}
