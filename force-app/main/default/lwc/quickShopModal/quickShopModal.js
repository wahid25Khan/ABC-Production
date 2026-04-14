import { LightningElement, api } from "lwc";
import {
  toNumber,
  parsePositiveInteger,
  formatCurrency,
  resolveUnitPriceForQuantity,
  syncFavoriteState,
  doToggleFavorite,
  DEFAULT_WEBSTORE_ID
} from "c/utils";

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
      priceClass: `td price${index > 0 ? " price-red" : ""}`
    }));
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

  get heartIcon() {
    return this.isFavorite ? "utility:favorite" : "utility:favorite_alt";
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
    if (
      !productId ||
      this.favoritePending ||
      productId === this.favoriteProductId
    ) {
      return;
    }

    syncFavoriteState(this, productId, this.webStoreId || DEFAULT_WEBSTORE_ID);
  }

  handleToggleFavorite() {
    doToggleFavorite(this, this.selectedProductId, this.webStoreId || DEFAULT_WEBSTORE_ID);
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