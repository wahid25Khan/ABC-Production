import { LightningElement, api } from "lwc";
import getFavoriteState from "@salesforce/apex/WishlistController.getFavoriteState";
import toggleFavorite from "@salesforce/apex/WishlistController.toggleFavorite";

const DEFAULT_WEBSTORE_ID = "0ZEam000004dJDNGA2";

export default class QuickShopModal extends LightningElement {
  @api title = "";
  @api isbn = "";
  @api bookImageUrl;
  @api variationPricing;
  @api webStoreId = DEFAULT_WEBSTORE_ID;
  @api currencyIsoCode = "USD";
  @api minimumQuantity = 10;
  @api maximumQuantity = 50;
  @api incrementQuantity = 1;

  // default selected variation
  selectedVariationIndex = 0;
  quantity = 10;

  isFavorite = false;
  isOpen = true;
  favoritePending = false;
  favoriteProductId = "";

  get isLoading() {
    return !this.title || !this.variationPricing;
  }

  // features layout as screenshot
  featuresLeft = ["Answer Key", "Posttest", "Pretest"];
  featuresRight = ["eBook"];

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
      ariaSelected: this.selectedVariationIndex === i
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

  get selectedProductId() {
    return this.selectedVariation?.productId ?? null;
  }

  get minQty() {
    const variationMin = this.parsePositiveInteger(
      this.selectedVariation?.minimumQuantity
    );
    if (variationMin !== null) {
      return variationMin;
    }

    const parsed = this.parsePositiveInteger(this.minimumQuantity);
    if (parsed === null) {
      return 10;
    }

    return parsed;
  }

  get maxQty() {
    const variationMax = this.parsePositiveInteger(
      this.selectedVariation?.maximumQuantity
    );
    if (variationMax !== null && variationMax <= 9999) {
      return variationMax;
    }

    const parsed = this.parsePositiveInteger(this.maximumQuantity);
    return parsed !== null && parsed <= 9999 ? parsed : 50;
  }

  get incrementQty() {
    const variationIncrement = this.parsePositiveInteger(
      this.selectedVariation?.incrementQuantity
    );
    if (variationIncrement !== null) {
      return variationIncrement;
    }

    const parsed = this.parsePositiveInteger(this.incrementQuantity);
    if (parsed === null) {
      return 1;
    }

    return parsed;
  }

  get formattedUnitPrice() {
    return this.formatPrice(this.selectedUnitPrice);
  }

  get formattedBulkPrice() {
    const tiers = this.selectedVariation?.tiers;
    if (!tiers || tiers.length < 2) return "—";
    return this.formatPrice(tiers[tiers.length - 1].price);
  }

  get hasBulkPrice() {
    const tiers = this.selectedVariation?.tiers;
    return tiers && tiers.length > 1;
  }

  get bulkThreshold() {
    const tiers = this.selectedVariation?.tiers;
    if (!tiers || tiers.length < 2) return 25;
    return tiers[tiers.length - 1].lowerBound || 25;
  }

  get standardQtyRange() {
    const min = this.minQty;
    if (!this.hasBulkPrice) return `${min}+`;
    return `${min}-${this.bulkThreshold - 1}`;
  }

  get bulkQtyLabel() {
    return `${this.bulkThreshold}+`;
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
    return this.formatPrice(unit * qty);
  }

  // ---------- open/close ----------

  @api open() {
    this.isOpen = true;
  }

  @api close() {
    this.isOpen = false;
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
      this.quantity = this.minQty;
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
    let val = Number.parseInt(e.target.value, 10);
    if (Number.isNaN(val)) val = this.minQty;

    const min = this.minQty;
    const max = this.maxQty;
    const inc = this.incrementQty;

    if (val < min) val = min;
    if (val > max) val = max;

    // Snap to nearest valid increment step
    if (inc > 1) {
      const steps = Math.round((val - min) / inc);
      val = min + steps * inc;
      if (val > max) val = min + Math.floor((max - min) / inc) * inc;
      if (val < min) val = min;
    }

    this.quantity = val;
    e.target.value = String(val); // force-sync when clamped value equals current quantity
  }

  handleQtyDecrement() {
    const next = this.quantity - this.incrementQty;
    this.quantity = Math.max(next, this.minQty);
  }

  handleQtyIncrement() {
    const next = this.quantity + this.incrementQty;
    this.quantity = Math.min(next, this.maxQty);
  }

  // ---------- actions ----------
  handleAddToCart() {
    if (!this.selectedProductId) return;
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
          format: this.selectedVariation?.format,
          isbn: this.isbn,
          title: this.title
        }
      })
    );
  }

  handleViewDetails() {
    this.dispatchEvent(
      new CustomEvent("viewdetails", {
        detail: { isbn: this.isbn, title: this.title }
      })
    );
  }

  toggleFavorite() {
    this.handleToggleFavorite();
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

    this.syncFavoriteState(productId);
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

      if (this.selectedProductId !== productId) {
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

  async handleToggleFavorite() {
    const productId = this.selectedProductId;
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

  // ESC close
  connectedCallback() {
    this.quantity = this.minQty;
    this._handleKeydown = (evt) => {
      if (this.isOpen && evt.key === "Escape") this.close();
    };
    globalThis.window.addEventListener("keydown", this._handleKeydown);
  }

  disconnectedCallback() {
    globalThis.window.removeEventListener("keydown", this._handleKeydown);
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

  formatPrice(value) {
    const normalized = this.toNumber(value);
    if (normalized === null) {
      return "—";
    }

    const currency = this.currencyIsoCode || "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(normalized);
  }
}
