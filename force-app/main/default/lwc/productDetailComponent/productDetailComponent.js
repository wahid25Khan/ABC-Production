import { LightningElement, api, track } from "lwc";
import getVariationPricing from "@salesforce/apex/ProductVariationController.getVariationPricing";
import getFavoriteState from "@salesforce/apex/WishlistController.getFavoriteState";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";

const DEFAULT_STORE_NAME = "AmericanBookCompany";
const DEFAULT_WEBSTORE_ID = "0ZEam000004dJDNGA2";
const DEFAULT_CURRENCY = "USD";
const PRODUCT_ID_PATTERN = /01t[a-zA-Z0-9]{12,15}/;
const PRODUCT_DETAIL_FIELDS = [
  "StockKeepingUnit",
  "Name",
  "purchaseQuantityRule"
];
const STOREFRONT_REQUEST_PARAMS = Object.freeze({
  language: "en-US",
  asGuest: "true",
  htmlEncode: "false"
});

export default class ProductDetailComponent extends LightningElement {
  @api storeName = DEFAULT_STORE_NAME;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api productId = "";
  @api cartStateOrId = "current";
  @api minimumQuantity = 10;
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

  featuresLeft = ["Answer Key", "Posttest", "Pretest"];
  featuresRight = ["eBook"];

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
    return this.resolveUnitPriceForQuantity(this.quantity);
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

      formattedPrice: this.formatPrice(tier.price),
      priceClass: `td price${index > 0 ? " price-red" : ""}`
    }));
  }

  get hasTiers() {
    return this.displayTiers.length > 0;
  }

  get minQty() {
    const variationMin = this.parsePositiveInteger(
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
    const variationMax = this.parsePositiveInteger(
      this.selectedVariation?.maximumQuantity
    );
    if (variationMax !== null && variationMax <= 9999) {
      return variationMax;
    }

    const rule = this.product?.purchaseQuantityRule;
    const ruleMax = rule?.maximum ?? rule?.Maximum ?? null;
    if (Number.isFinite(ruleMax) && ruleMax > 0 && ruleMax <= 9999)
      return ruleMax;
    return 50;
  }

  get incrementQty() {
    const variationIncrement = this.parsePositiveInteger(
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
    return this.formatPrice(this.selectedUnitPrice);
  }

  // Live order total: current tier unit price × total quantity
  get totalPrice() {
    const unit = this.selectedUnitPrice;
    const qty = Number(this.quantity) || this.minQty;
    if (!unit || !qty) return "";
    return this.formatPrice(unit * qty);
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
      } catch (apexError) {
        console.warn("Failed to load variation pricing.", apexError);
      }

      await this.syncFavoriteState(this.selectedProductId || currentProductId);
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

    const queryParams = new URLSearchParams(
      globalThis.window.location.search || ""
    );
    const fromQuery =
      queryParams.get("pid") ||
      queryParams.get("productId") ||
      queryParams.get("product_id");

    if (fromQuery) {
      return String(fromQuery).trim();
    }

    const fullUrl = globalThis.window.location.href || "";
    const sfProductId = PRODUCT_ID_PATTERN.exec(fullUrl);
    if (sfProductId?.[0]) {
      return sfProductId[0];
    }

    const parts = (globalThis.window.location.pathname || "")
      .split("/")
      .filter(Boolean);
    const lastSegment = parts.length ? decodeURIComponent(parts.at(-1)) : "";
    return PRODUCT_ID_PATTERN.test(lastSegment) ? lastSegment : "";
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
        const products = this.extractProductCollection(data);
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
    const params = new URLSearchParams({
      [idParamName]: productIds.join(",")
    });

    params.set("fields", PRODUCT_DETAIL_FIELDS.join(","));
    Object.entries(STOREFRONT_REQUEST_PARAMS).forEach(([key, value]) => {
      params.set(key, value);
    });

    return `${base}?${params.toString()}`;
  }

  extractProductCollection(data) {
    const list =
      data?.products ||
      data?.productCollection?.products ||
      data?.productPage?.products ||
      data?.productsPage?.products;

    return Array.isArray(list) ? list : [];
  }

  normalizeProduct(item) {
    const id = String(item?.id || "").trim();
    if (!id) {
      return null;
    }

    const name = String(item?.name || "").trim() || "Untitled";

    return {
      ...item,
      id,
      name,
      imageUrl: this.resolveProductImageUrl(item),
      sku: this.resolveStockKeepingUnit(item),
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
      return this.extractPricingMap(data);
    } catch {
      return new Map();
    }
  }

  buildPricingEndpoint(productIds) {
    const base = `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/pricing/products`;
    const params = new URLSearchParams({
      productIds: productIds.join(",")
    });

    Object.entries(STOREFRONT_REQUEST_PARAMS).forEach(([key, value]) => {
      params.set(key, value);
    });

    return `${base}?${params.toString()}`;
  }

  extractPricingMap(data) {
    const root = data && typeof data === "object" ? data : {};
    let rows;
    if (Array.isArray(root.pricingLineItemResults)) {
      rows = root.pricingLineItemResults;
    } else if (Array.isArray(root.pricingResults)) {
      rows = root.pricingResults;
    } else {
      rows = [];
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
          DEFAULT_CURRENCY,
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
    const directCandidates = [
      item?.defaultImage?.url,
      item?.image?.url,
      item?.imageUrl
    ];

    for (const value of directCandidates) {
      if (typeof value === "string" && value.trim()) {
        return this.normalizeImageUrl(value.trim());
      }
    }

    const mediaGroups = Array.isArray(item?.mediaGroups)
      ? item.mediaGroups
      : [];
    for (const group of mediaGroups) {
      const mediaItems = Array.isArray(group?.mediaItems)
        ? group.mediaItems
        : [];
      for (const media of mediaItems) {
        const url = media?.url || media?.image?.url;
        if (typeof url === "string" && url.trim()) {
          return this.normalizeImageUrl(url.trim());
        }
      }
    }

    return "";
  }

  normalizeImageUrl(url) {
    const value = String(url || "")
      .trim()
      .replaceAll(/\s/g, "%20");
    if (!value) {
      return "";
    }

    if (/^(https?:|data:)/i.test(value)) {
      return value;
    }

    if (value.startsWith("//")) {
      return `https:${value}`;
    }

    if (globalThis.window?.location?.origin) {
      if (value.startsWith("/")) {
        return `${globalThis.window.location.origin}${value}`;
      }

      return `${globalThis.window.location.origin}/${value.replace(/^\/+/, "")}`;
    }

    return value;
  }

  resolveStockKeepingUnit(item) {
    return this.firstString([
      item?.sku,
      item?.stockKeepingUnit,
      this.resolveByPath(item, "fields.StockKeepingUnit")
    ]);
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
        this.syncFavoriteState(nextProductId);
      }
    }
  }

  async syncFavoriteState(productId) {
    if (!productId) {
      this.isFavorite = false;
      this.favoriteProductId = "";
      return;
    }

    try {
      const result = await getFavoriteState({
        productId,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });

      if ((this.selectedProductId || this.product?.id || "") !== productId) {
        return;
      }

      this.isFavorite = Boolean(result?.favorite);
      this.favoriteProductId = productId;
    } catch (error) {
      console.warn("Failed to load wishlist state.", error);
      this.isFavorite = false;
      this.favoriteProductId = productId;
    }
  }

  parsePositiveInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  resolveUnitPriceForQuantity(quantity) {
    const variation = this.selectedVariation;
    if (!variation) {
      return null;
    }

    const tiers = variation.tiers;
    const fallbackPrice = this.toNumber(variation.unitPrice);
    if (!tiers?.length) {
      return fallbackPrice;
    }

    const qty = this.parsePositiveInteger(quantity) ?? this.minQty;
    for (const tier of tiers) {
      const lower = this.toNumber(tier?.lowerBound);
      const upper = this.toNumber(tier?.upperBound);
      const price = this.toNumber(tier?.price);

      if (price === null || lower === null) {
        continue;
      }

      if (qty >= lower && (upper === null || qty <= upper)) {
        return price;
      }
    }

    return fallbackPrice;
  }

  get isMinQty() {
    return this.quantity <= this.minQty;
  }

  get isMaxQty() {
    return this.quantity >= this.maxQty;
  }

  handleQtyChange(event) {
    let value = Number.parseInt(event?.target?.value, 10);
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
    event.target.value = String(value); // force-sync when clamped value equals current quantity
  }

  handleQtyDecrement() {
    const next = this.quantity - this.incrementQty;
    this.quantity = Math.max(next, this.minQty);
  }

  handleQtyIncrement() {
    const next = this.quantity + this.incrementQty;
    this.quantity = Math.min(next, this.maxQty);
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
      const added = await this.addProductToCart(productId, this.quantity);
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
        globalThis.window.location.href = `/${this.storeName || DEFAULT_STORE_NAME}/cart`;
      }
    } finally {
      this.isAddingToCart = false;
    }
  }

  async addProductToCart(productId, quantity) {
    const payload = {
      productId,
      quantity,
      type: "Product"
    };

    try {
      const response = await fetch(
        this.buildAddToCartEndpoint(this.cartStateOrId || "current"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  buildAddToCartEndpoint(cartStateOrId) {
    const targetCart = String(cartStateOrId || "current").trim() || "current";
    const params = new URLSearchParams(STOREFRONT_REQUEST_PARAMS);

    return `/${this.storeName || DEFAULT_STORE_NAME}/webruntime/api/services/data/v66.0/commerce/webstores/${this.webStoreId || DEFAULT_WEBSTORE_ID}/carts/${targetCart}/cart-items?${params.toString()}`;
  }

  handleTrial() {
    this.dispatchEvent(
      new CustomEvent("trial", {
        detail: {
          plan: this.selectedPlan,
          isbn: this.isbn,
          title: this.title
        }
      })
    );

    if (this.trialUrl && globalThis.window !== undefined) {
      globalThis.window.location.href = this.trialUrl;
    }
  }

  async toggleFavorite() {
    const productId = this.selectedProductId || this.product?.id || "";
    if (!productId || this.favoritePending) {
      return;
    }

    this.favoritePending = true;
    const previous = this.isFavorite;

    try {
      const result = await toggleFavorite({
        productId,
        webStoreId: this.webStoreId || DEFAULT_WEBSTORE_ID
      });

      if (result?.success === false) {
        this.isFavorite = previous;
        return;
      }

      this.isFavorite = Boolean(result?.favorite);
      this.favoriteProductId = productId;
      this.dispatchEvent(
        new CustomEvent("favoritechange", {
          detail: {
            favorite: this.isFavorite,
            productId,
            wishlistId: result?.wishlistId || null,
            wishlistItemId: result?.wishlistItemId || null
          }
        })
      );
    } catch (error) {
      console.warn("Failed to update wishlist state.", error);
      this.isFavorite = previous;
    } finally {
      this.favoritePending = false;
    }
  }

  resolvePrice(source, paths) {
    for (const path of paths) {
      const value = this.resolveByPath(source, path);
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

  formatPrice(value) {
    const normalized = this.toNumber(value);
    if (normalized === null) {
      return "—";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: this.currencyIsoCode || DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(normalized);
  }

  firstString(values) {
    for (const value of values || []) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (value && typeof value === "object") {
        if (typeof value.value === "string" && value.value.trim()) {
          return value.value.trim();
        }

        if (
          typeof value.displayValue === "string" &&
          value.displayValue.trim()
        ) {
          return value.displayValue.trim();
        }
      }
    }

    return "";
  }
}
