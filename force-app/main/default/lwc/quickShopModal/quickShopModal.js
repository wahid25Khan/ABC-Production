import { LightningElement, api } from "lwc";
import isGuest from "@salesforce/user/isGuest";
import {
  toNumber,
  parsePositiveInteger,
  formatCurrency,
  resolveUnitPriceForQuantity,
  syncFavoriteState,
  doToggleFavorite,
  DEFAULT_WEBSTORE_ID
} from "c/utils";

const LOGIN_URL = "/AmericanBookCompany/login";
const HEART_REGULAR_PATH =
  "M225.8 468.2l-2.5-2.3L48.1 303.2C17.4 274.7 0 234.7 0 192.8v-3.3c0-70.4 50-130.8 119.2-144C158.6 37.9 198.9 47 231 69.6c9 6.4 17.4 13.8 25 22.3c4.2-4.8 8.7-9.2 13.5-13.3c3.7-3.2 7.5-6.2 11.5-9c0 0 0 0 0 0C313.1 47 353.4 37.9 392.8 45.4C462 58.6 512 119.1 512 189.5v3.3c0 41.9-17.4 81.9-48.1 110.4L288.7 465.9l-2.5 2.3c-8.2 7.6-19 11.9-30.2 11.9s-22-4.2-30.2-11.9zM239.1 145c-.4-.3-.7-.7-1-1.1l-17.8-20c0 0-.1-.1-.1-.1c0 0 0 0 0 0c-23.1-25.9-58-37.7-92-31.2C81.6 101.5 48 142.1 48 189.5v3.3c0 28.5 11.9 55.8 32.8 75.2L256 430.7 431.2 268c20.9-19.4 32.8-46.7 32.8-75.2v-3.3c0-47.3-33.6-88-80.1-96.9c-34-6.5-69 5.4-92 31.2c0 0 0 0-.1 .1s0 0-.1 .1l-17.8 20c-.3 .4-.7 .7-1 1.1c-4.5 4.5-10.6 7-16.9 7s-12.4-2.5-16.9-7z";
const HEART_SOLID_PATH =
  "M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z";

export default class QuickShopModal extends LightningElement {
  @api title = "";
  @api isbn = "";
  @api productId = "";
  @api bookImageUrl;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api currencyIsoCode = "USD";
  @api minimumQuantity = 10;
  @api maximumQuantity = 99999;
  @api incrementQuantity = 1;
  @api pricingLoading = false;
  @api pricingError = false;
  @api cartError = "";

  _variationPricing;

  // default selected variation
  selectedVariationIndex = 0;
  quantity = 10;

  isFavorite = false;
  favoritePending = false;
  favoriteProductId = "";

  @api
  get variationPricing() {
    return this._variationPricing;
  }

  set variationPricing(value) {
    this._variationPricing = value;
    this.selectedVariationIndex = 0;
    this.quantity = this.normalizeQuantity(this.quantity || this.minQty);
    this.favoriteProductId = "";
  }

  get showLoadingOverlay() {
    return (
      this.pricingLoading ||
      (!this.pricingError && (!this.title || !this.variationPricing))
    );
  }

  get showPricingError() {
    return Boolean(this.pricingError);
  }

  get disableAddToCart() {
    return (
      this.showLoadingOverlay || this.pricingError || !this.selectedProductId
    );
  }

  get disableViewDetails() {
    return !this.title && !this.productId;
  }

  // features layout as screenshot
  featuresLeft = ["Answer Key", "Posttest", "Pretest"];
  featuresRight = ["eBook"];

  // ─── Variation getters ──────────────────────────────────────────────────

  get variationsList() {
    return this._variationPricing?.variations ?? [];
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
      tabIndex: this.selectedVariationIndex === i ? 0 : -1
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

  get displayTiers() {
    const tiers = this.selectedVariation?.tiers;
    if (!tiers?.length) return [];
    return tiers.map((tier, index) => ({
      key: `tier-${index}`,
      qtyLabel:
        tier.upperBound == null
          ? `${tier.lowerBound}+`
          : `${tier.lowerBound}\u2013${tier.upperBound}`,

      formattedPrice: formatCurrency(toNumber(tier.price), this.currencyIsoCode || "USD"),
      priceClass: 'td' // `td price${index > 0 ? " price-red" : ""}`
    })).filter((_, index) => tiers.length === 1 || index > 0);
  }

  get hasTiers() {
    return this.displayTiers.length > 0;
  }

  get selectedProductId() {
    return this.selectedVariation?.productId ?? this.productId ?? null;
  }

  get minQty() {
    const variationMin = parsePositiveInteger(
      this.selectedVariation?.minimumQuantity
    );
    if (variationMin !== null) {
      return variationMin;
    }

    const parsed = parsePositiveInteger(this.minimumQuantity);
    if (parsed === null) {
      return 10;
    }

    return parsed;
  }

  get maxQty() {
    const variationMax = parsePositiveInteger(
      this.selectedVariation?.maximumQuantity
    );
    if (variationMax !== null) {
      return variationMax;
    }

    const parsed = parsePositiveInteger(this.maximumQuantity);
    return parsed !== null ? parsed : 99999;
  }

  get incrementQty() {
    const variationIncrement = parsePositiveInteger(
      this.selectedVariation?.incrementQuantity
    );
    if (variationIncrement !== null) {
      return variationIncrement;
    }

    const parsed = parsePositiveInteger(this.incrementQuantity);
    if (parsed === null) {
      return 1;
    }

    return parsed;
  }

  get formattedUnitPrice() {
    return formatCurrency(this.selectedUnitPrice, this.currencyIsoCode || "USD");
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

  // Live order total: current tier unit price × total quantity
  get totalPrice() {
    const unit = this.selectedUnitPrice;
    const qty = Number(this.quantity) || this.minQty;
    if (!unit || !qty) return "";
    return formatCurrency(unit * qty, this.currencyIsoCode || "USD");
  }

  // ---------- open/close ----------

  @api close() {
    this.dispatchEvent(new CustomEvent("close"));
  }

  handleClose() {
    this.close();
  }

  handleBackdropClick() {
    this.close();
  }

  // ---------- tab selection ----------
  handleTabClick(event) {
    const index = Number.parseInt(event.currentTarget.dataset.index, 10);
    if (
      Number.isFinite(index) &&
      index >= 0 &&
      index < this.variationsList.length
    ) {
      this.selectedVariationIndex = index;
      this.quantity = this.normalizeQuantity(this.minQty);
      const variation = this.variationsList[index];
      this.dispatchEvent(
        new CustomEvent("planchange", {
          detail: { format: variation.format, productId: variation.productId }
        })
      );
    }
  }

  // ---------- qty ----------
  get isMinQty() {
    return this.quantity <= this.minQty;
  }

  get isMaxQty() {
    return this.quantity >= this.maxQty;
  }

  handleQtyChange(e) {
    const raw = e.target.value;
    if (raw === '') return;
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.quantity = parsed;
    }
  }

  handleQtyBlur(e) {
    this.quantity = this.normalizeQuantity(this.quantity);
    e.target.value = String(this.quantity);
  }

  handleQtyDecrement() {
    const next = this.quantity - this.incrementQty;
    this.quantity = this.normalizeQuantity(next);
  }

  handleQtyIncrement() {
    const next = this.quantity + this.incrementQty;
    this.quantity = this.normalizeQuantity(next);
  }

  // ---------- actions ----------
  handleAddToCart() {
    if (this.disableAddToCart) return;

    this.dispatchEvent(
      new CustomEvent("addtocart", {
        detail: {
          productId: this.selectedProductId,
          format: this.selectedVariation?.format,
          quantity: this.quantity,
          isbn: this.isbn,
          title: this.title,
          unitPrice: this.selectedUnitPrice,
          currencyIsoCode: this.currencyIsoCode || "USD"
        }
      })
    );
  }

  handleTrial() {
    this.dispatchEvent(
      new CustomEvent("trial", {
        detail: {
          productId: this.selectedProductId,
          format: this.selectedVariation?.format,
          isbn: this.isbn,
          title: this.title
        }
      })
    );
  }

  handleViewDetails() {
    if (this.disableViewDetails) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("viewdetails", {
        detail: {
          productId: this.selectedProductId,
          isbn: this.isbn,
          title: this.title
        }
      })
    );
  }

  renderedCallback() {
    const productId = this.selectedProductId;
    if (isGuest) {
      this.isFavorite = false;
      this.favoriteProductId = "";
      return;
    }

    if (
      !productId ||
      this.favoritePending ||
      productId === this.favoriteProductId
    ) {
      return;
    }

    syncFavoriteState(this, productId, this.webStoreId || DEFAULT_WEBSTORE_ID);
  }

  redirectGuestToLogin() {
    const location = globalThis.location || globalThis.window?.location;
    if (!location) {
      return;
    }

    const startUrl = `${location.pathname || ""}${location.search || ""}${location.hash || ""}`;
    location.assign(`${LOGIN_URL}?startURL=${encodeURIComponent(startUrl)}`);
  }

  async handleToggleFavorite() {
    if (isGuest) {
      this.redirectGuestToLogin();
      return;
    }

    await doToggleFavorite(
      this,
      this.selectedProductId,
      this.webStoreId || DEFAULT_WEBSTORE_ID
    );
  }

  // ESC close
  connectedCallback() {
    this.quantity = this.normalizeQuantity(this.minQty);
    this._handleKeydown = (evt) => {
      if (evt.key === "Escape") this.close();
    };
    globalThis.window.addEventListener("keydown", this._handleKeydown);
  }

  disconnectedCallback() {
    globalThis.window.removeEventListener("keydown", this._handleKeydown);
  }

  normalizeQuantity(value) {
    let normalized = parsePositiveInteger(value) ?? this.minQty;
    const min = this.minQty;
    const max = this.maxQty;
    const increment = this.incrementQty;

    if (normalized < min) normalized = min;
    if (normalized > max) normalized = max;

    if (increment > 1) {
      const steps = Math.round((normalized - min) / increment);
      normalized = min + steps * increment;
      if (normalized > max) {
        normalized = min + Math.floor((max - min) / increment) * increment;
      }
      if (normalized < min) {
        normalized = min;
      }
    }

    return normalized;
  }
}